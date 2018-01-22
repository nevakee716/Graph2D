/* Copyright (c) 2012-2013 Casewise Systems Ltd (UK) - All rights reserved */



/*global cwAPI, jQuery */
(function(cwApi, $) {
    "use strict";
    // constructor
    var cwLayoutGraph2D = function(options, viewSchema) {
        cwApi.extend(this, cwApi.cwLayouts.CwLayout, options, viewSchema); // heritage
        cwApi.registerLayoutForJSActions(this); // execute le applyJavaScript après drawAssociations
        this.objects = {};
        this.layoutsByNodeId = {};
        this.init = true;
        this.configuration = {
            "hiddenNodes": [""],
            "disable0": true,
            "mesurementNodes": {
                "mesure_20115_1779468335": {
                    "propertyXScriptname": ["datedemesure"],
                    "propertyYScriptname": ["valeurattentue", "valeurmesurée"]
                }
            }
        };
        this.groups = {};
        this.configuration = JSON.parse(this.options.CustomOptions['configuration']);
        this.items = [];

    };



    cwLayoutGraph2D.prototype.getItemDisplayString = function(item) {
        var l, getDisplayStringFromLayout = function(layout) {
            return layout.displayProperty.getDisplayString(item);
        };
        if (item.nodeID === this.nodeID) {
            return this.displayProperty.getDisplayString(item);
        }
        if (!this.layoutsByNodeId.hasOwnProperty(item.nodeID)) {
            if (this.viewSchema.NodesByID.hasOwnProperty(item.nodeID)) {
                var layoutOptions = this.viewSchema.NodesByID[item.nodeID].LayoutOptions;
                this.layoutsByNodeId[item.nodeID] = new cwApi.cwLayouts[item.layoutName](layoutOptions, this.viewSchema);
            } else {
                return item.name;
            }
        }
        return getDisplayStringFromLayout(this.layoutsByNodeId[item.nodeID]);
    };

    cwLayoutGraph2D.prototype.simplify = function(child, fatherID) {
        var childrenArray = [];
        var filterArray = [];
        var filtersGroup = [];
        var filteredFields = [];
        var groupFilter = {};
        var element, filterElement, groupFilter;
        var nextChild, x, groupBase, group, y, groupItem;
        var self = this;
        for (var associationNode in child.associations) {
            if (child.associations.hasOwnProperty(associationNode)) {
                for (var i = 0; i < child.associations[associationNode].length; i += 1) {
                    nextChild = child.associations[associationNode][i];
                    if (!this.configuration.mesurementNodes.hasOwnProperty(associationNode)) { // jumpAndMerge when hidden
                        this.simplify(nextChild, fatherID);
                    } else { // adding mesurement
                        x = nextChild.properties[this.configuration.mesurementNodes[associationNode].propertyXScriptname];
                        groupBase = child.name + " # ";
                        groupItem = {};
                        groupItem.name = child.name;
                        groupItem.property = [];
                        this.configuration.mesurementNodes[associationNode].propertyYScriptname.forEach(function(property) {
                            y = nextChild.properties[property];
                            group = groupBase + cwAPI.mm.getProperty(nextChild.objectTypeScriptName, property).name;
                            if (self.configuration.disable0 === false || y !== 0) {
                                self.items.push({x,y,group});
                                self.isData = "cw-visible";
                            }
                            groupItem.property.push(cwAPI.mm.getProperty(nextChild.objectTypeScriptName, property).name);
                        });
                        if (!this.groups.hasOwnProperty(groupItem.name)) this.groups[child.name] = groupItem;
                    }
                }
            }
        }

        return childrenArray;
    };



    cwLayoutGraph2D.prototype.multiLine = function(name, size) {
        if (size !== "" && size > 0) {
            var nameSplit = name.split(" ");
            var carry = 0;
            var multiLineName = "";
            for (var i = 0; i < nameSplit.length - 1; i += 1) {
                if (nameSplit[i].length > size || carry + nameSplit[i].length > size) {
                    multiLineName += nameSplit[i] + "\n";
                    carry = 0;
                } else {
                    carry += nameSplit[i].length + 1;
                    multiLineName += nameSplit[i] + " ";
                }
            }
            multiLineName = multiLineName + nameSplit[nameSplit.length - 1];

            return multiLineName;
        } else {
            return name;
        }


    };


    // obligatoire appeler par le system
    cwLayoutGraph2D.prototype.drawAssociations = function(output, associationTitleText, object) {
        var cpyObj = $.extend({}, object);
        var assoNode = {};
        this.isData = "";

        assoNode[this.mmNode.NodeID] = object.associations[this.mmNode.NodeID];
        cpyObj.associations = assoNode;
        this.JSONobjects = cpyObj;
        this.simplify(this.JSONobjects, null);

        output.push('<div id="cwLayoutGraph2DGlobal_' + this.nodeID + '" class=' + this.isData + '>');
        output.push('<div id="cwLayoutGraph2DLegend_' + this.nodeID + '" class="cwLayoutGraph2D_external-legend"></div>');
        output.push('<div id="cwLayoutGraph2D_' + this.nodeID + '">');
        output.push('</div>');

        



    };


    cwLayoutGraph2D.prototype.applyJavaScript = function() {
        if (this.init) {
            this.init = false;
            var self = this;
            var libToLoad = [];

            if (cwAPI.isDebugMode() === true) {
                self.createGraph2D();
            } else {
                libToLoad = ['modules/vis/vis.min.js'];
                // AsyncLoad
                cwApi.customLibs.aSyncLayoutLoader.loadUrls(libToLoad, function(error) {
                    if (error === null) {
                        self.createGraph2D();
                    } else {
                        cwAPI.Log.Error(error);
                    }
                });
            }
        }
    };


    // Building network
    cwLayoutGraph2D.prototype.createGraph2D = function() {


        



        var groups = new vis.DataSet();
        this.groupsVIS = groups;
        for (var group in this.groups) {
            if(this.groups.hasOwnProperty(group)) {
                this.groups[group].property.forEach(function(groupProperty) {
                    groups.add({
                        id: group + " # " + groupProperty,
                        content: groupProperty,
                    });
                });                           
            }
        }


        var graph2DContainer = document.getElementById("cwLayoutGraph2D_" + this.nodeID);



        var dataset = new vis.DataSet(this.items);
        var canvaHeight = window.innerHeight - document.getElementsByClassName("page-content")[0].offsetHeight - document.getElementsByClassName("page-title")[0].offsetHeight;

        var options = {

        };
        this.graph2d = new vis.Graph2d(graph2DContainer, this.items, groups, options);

        this.populateExternalLegend();
    };


    /**
     * this function fills the external legend with content using the getLegend() function.
     */
    cwLayoutGraph2D.prototype.populateExternalLegend = function() {

        var legendDiv = document.getElementById("cwLayoutGraph2DLegend_" + this.nodeID);
        legendDiv.innerHTML = "";
        var self = this;



        // get for all groups:
        for (var group in this.groups) {
            if(this.groups.hasOwnProperty(group)) {
                var groupDiv = document.createElement("div");
                groupDiv.className = 'legend-group-container';
                groupDiv.innerHTML = "<h1>" + group + "</h1>";
                var groupDivLegend = document.createElement("div");


                this.groups[group].property.forEach(function(groupProperty) {
                    // create divs
                    var containerDiv = document.createElement("div");
                    var iconDiv = document.createElement("div");
                    var descriptionDiv = document.createElement("div");

                    // give divs classes and Ids where necessary
                    containerDiv.className = 'legend-element-container';
                    containerDiv.id = group + " # " + groupProperty + "_legendContainer";
                    iconDiv.className = "icon-container";
                    descriptionDiv.className = "description-container";

                    // get the legend for this group.
                    var legend = self.graph2d.getLegend(group + " # " + groupProperty, 30, 30);
                    try{
                        // append class to icon. All styling classes from the vis.css/vis-timeline-graph2d.min.css have been copied over into the head here to be able to style the
                        // icons with the same classes if they are using the default ones.
                        legend.icon.setAttributeNS(null, "class", "legend-icon");

                        // append the legend to the corresponding divs
                        iconDiv.appendChild(legend.icon);
                        descriptionDiv.innerHTML = legend.label;

                        // determine the order for left and right orientation
                        if (legend.orientation == 'left') {
                            descriptionDiv.style.textAlign = "left";
                            containerDiv.appendChild(iconDiv);
                            containerDiv.appendChild(descriptionDiv);
                        } else {
                            descriptionDiv.style.textAlign = "right";
                            containerDiv.appendChild(descriptionDiv);
                            containerDiv.appendChild(iconDiv);
                        }

                        // append to the legend container div
                        groupDivLegend.appendChild(containerDiv);

                        var groupID = group + " # " + groupProperty;

                        // bind click event to this legend element.
                        containerDiv.onclick = function() {

                            self.toggleGraph(groupID);
                        };
                    } catch(error) {
                      console.log(error);
                      // expected output: SyntaxError: unterminated string literal
                      // Note - error messages will vary depending on browser
                    }
                  
                });
                groupDiv.appendChild(groupDivLegend);
                legendDiv.appendChild(groupDiv);
            }
        }
    };
    /**
     * This function switchs the visible option of the selected group on an off.
     * @param groupId
     */
    cwLayoutGraph2D.prototype.toggleGraph = function(groupId) {
        // get the container that was clicked on.
        var container = document.getElementById("cwLayoutGraph2DLegend_" + this.nodeID);
        // if visible, hide
        if (this.graph2d.isGroupVisible(groupId) == true) {
            this.groupsVIS.update({
                id: groupId,
                visible: false
            });
            container.className = container.className + " notselected";
        } else { // if invisible, show
            this.groupsVIS.update({
                id: groupId,
                visible: true
            });
            container.className = container.className.replace("notselected", "");
        }
    };


    cwLayoutGraph2D.prototype.lookForObjects = function(id, scriptname, child) {
        var childrenArray = [];
        var element;
        var nextChild;
        if (child.objectTypeScriptName === scriptname && child.object_id == id) {
            return child;
        }
        for (var associationNode in child.associations) {
            if (child.associations.hasOwnProperty(associationNode)) {
                for (var i = 0; i < child.associations[associationNode].length; i += 1) {
                    nextChild = child.associations[associationNode][i];
                    element = this.lookForObjects(id, scriptname, nextChild);
                    if (element !== null) {
                        return element;
                    }
                }
            }
        }
        return null;
    };


    cwLayoutGraph2D.prototype.openObjectPage = function(id, scriptname) {
        var object = this.lookForObjects(id, scriptname, this.originalObject);
        if (object) {
            location.href = this.singleLinkMethod(scriptname, object);
        }
    };

    cwLayoutGraph2D.prototype.openPopOut = function(id, scriptname) {

        var object = this.lookForObjects(id, scriptname, this.originalObject);
        if (this.popOut[scriptname]) {
            cwApi.cwDiagramPopoutHelper.openDiagramPopout(object, this.popOut[scriptname]);
        }
    };



    cwApi.cwLayouts.cwLayoutGraph2D = cwLayoutGraph2D;
}(cwAPI, jQuery));