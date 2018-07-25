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
        this.groups = {};
        this.configuration = JSON.parse(this.options.CustomOptions['configuration']);
        this.items = [];
        if (this.configuration.isMinimalist === true) {
            this.isMinimalist = true;
        } else {
            this.isMinimalist = false;
        }

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
        var config;
        for (var associationNode in child.associations) {
            if (child.associations.hasOwnProperty(associationNode)) {
                for (var i = 0; i < child.associations[associationNode].length; i += 1) {
                    nextChild = child.associations[associationNode][i];
                    if (!this.configuration.mesurementNodes.hasOwnProperty(associationNode)) { // jumpAndMerge when hidden
                        this.simplify(nextChild, fatherID);
                    } else { // adding mesurement
                        config = this.configuration.mesurementNodes[associationNode];
                        x = nextChild.properties[config.propertyXScriptname];
                        groupItem = {};

                        if (config.parentName) {
                            groupItem.name = config.parentName;
                            groupItem.merged = true;
                        } else groupItem.name = child.name;



                        groupItem.property = [];
                        config.propertyYScriptname.forEach(function(property) {
                            y = nextChild.properties[property];
                            if (config.name) {
                                group = config.name;
                            } else {
                                group = cwAPI.mm.getProperty(nextChild.objectTypeScriptName, property).name;
                            }

                            if (self.isMinimalist) group = "mini";
                            if (self.configuration.disable0 === false || y !== 0) {
                                self.items.push({
                                    x: x,
                                    y: y,
                                    group: groupItem.name + " # " + group
                                });
                                self.isData = "cw-visible";
                            }
                            groupItem.property.push(group);
                        });
                        if (!this.groups.hasOwnProperty(groupItem.name)) this.groups[groupItem.name] = groupItem;
                        else if (groupItem.merged === true && this.groups[groupItem.name].property.indexOf(groupItem.property) === -1) {
                            this.groups[groupItem.name].property = this.groups[groupItem.name].property.concat(groupItem.property);
                        }
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
        this.uuid = this.nodeID + "_" + object.object_id;

        // keep the node of the layout
        assoNode[this.mmNode.NodeID] = object.associations[this.mmNode.NodeID];
        // complementary node
        if (this.configuration.complementaryNode) {
            this.configuration.complementaryNode.forEach(function(nodeID) {
                if (object.associations[nodeID]) {
                    assoNode[nodeID] = object.associations[nodeID];
                }
            });

        }


        cpyObj.associations = assoNode;
        this.JSONobjects = cpyObj;
        this.simplify(this.JSONobjects, null);

        output.push('<div id="cwLayoutGraph2DGlobal_' + this.uuid + '" class="' + this.isData + ' cwLayoutGraph2D">');
        if (this.isMinimalist === false) {
            output.push('<div id="cwLayoutGraph2DLegend_' + this.uuid + '" class="cwLayoutGraph2D_external-legend"></div>');
        } else {
            output.push('<button class="Graph2D_expendButton" id="Graph2DexpendButtonPlus_' + this.uuid + '"><i class="fa fa-plus" aria-hidden="true"></i></button>');
            output.push('<button class="Graph2D_expendButton" id="Graph2DexpendButtonMinus_' + this.uuid + '"><i class="fa fa-minus" aria-hidden="true"></i></button>');
        }
        output.push('<div id="cwLayoutGraph2D_' + this.uuid + '"></div>');
        output.push('</div>');

    };


    cwLayoutGraph2D.prototype.applyJavaScript = function() {
        if (this.init && this.isData) {
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
            if (this.groups.hasOwnProperty(group)) {
                this.groups[group].property.forEach(function(groupProperty) {
                    groups.add({
                        id: group + " # " + groupProperty,
                        content: groupProperty,
                    });
                });
            }
        }


        var graph2DContainer = document.getElementById("cwLayoutGraph2D_" + this.uuid);

        var dataset = new vis.DataSet(this.items);
        var canvaHeight = window.innerHeight - document.getElementsByClassName("page-content")[0].offsetHeight - document.getElementsByClassName("page-title")[0].offsetHeight;
        var canvaWidth = document.getElementsByClassName("page-content")[0].offsetWidth;
        var options = {
            autoResize: true
        };

        if (this.isMinimalist) {
            //graph2DContainer.style.width = canvaWidth*0.4 + "px";
            //graph2DContainer.style.height = '150px';
            graph2DContainer.parentElement.style.display = "flex";
            options = {
                moveable: false,
                legend: true,
                autoResize: true,
                height: '150px',
                width: canvaWidth * 0.4 + "px"
            };
            groups.add({
                id: "mini",
                content: this.mmNode.NodeName
            });

        }


        this.graph2d = new vis.Graph2d(graph2DContainer, this.items, groups, options);


        if (this.configuration.Graph2dOption !== undefined) {
            this.graph2d.setOptions(this.configuration.Graph2dOption);
        }



        if (this.isMinimalist === false) {
            this.populateExternalLegend();
        } else {
            this.enableExpendButton(options, canvaHeight, canvaWidth);
        }
    };


    cwLayoutGraph2D.prototype.enableExpendButton = function(options, canvaHeight, canvaWidth) {

        var buttonPlus = document.getElementById("Graph2DexpendButtonPlus_" + this.uuid);
        var buttonMinus = document.getElementById("Graph2DexpendButtonMinus_" + this.uuid);

        buttonPlus.style.display = "block";
        buttonMinus.style.display = "none";

        var self = this;
        buttonPlus.onclick = function(target) {
            buttonPlus.style.display = "none";
            buttonMinus.style.display = "block";
            options = {
                width: canvaWidth * 0.9 + "px",
                height: canvaHeight + 'px'
            };

            self.graph2d.setOptions(options);
            window.scrollTo(0, buttonMinus.offsetTop);

        };
        buttonMinus.onclick = function(target) {
            buttonMinus.style.display = "none";
            buttonPlus.style.display = "block";
            options = {
                width: canvaWidth * 0.4 + "px",
                height: '150px'
            };
            self.graph2d.setOptions(options);
        };
    };
    /**
     * this function fills the external legend with content using the getLegend() function.
     */
    cwLayoutGraph2D.prototype.populateExternalLegend = function() {

        var legendDiv = document.getElementById("cwLayoutGraph2DLegend_" + this.uuid);
        legendDiv.innerHTML = "";
        var self = this;

        // get for all groups:
        for (var group in this.groups) {
            if (this.groups.hasOwnProperty(group)) {
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
                    try {
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
                    } catch (error) {
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
        var container = document.getElementById(groupId + "_legendContainer");
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
            container.className = container.className.replace(" notselected", "");
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