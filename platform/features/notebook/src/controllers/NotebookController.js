/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2017, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

 /*-- main controller file, here is the core functionality of the notebook plugin --*/

define(
    ['zepto'],
    function ($) {


        function NotebookController(
                $scope,
                dialogService,
                popupService,
                agentService,
                objectService,
                navigationService,
                now,
                actionService,
                $timeout,
                $element,
                $sce
        ) {

            $scope.entriesEl = $(document.body).find('.t-entries-list');
            $scope.sortEntries = '-createdOn';
            $scope.showTime = "0";
            $scope.editEntry = false;
            $scope.entrySearch = '';
            $scope.entryTypes = [];
            $scope.embedActions = [];
            $scope.currentEntryValue = '';

            /*--seconds in an hour--*/

            var SECONDS_IN_AN_HOUR  = 60 * 60 * 1000;

            this.scope = $scope;

            $scope.hoursFilter = function (hours,entryTime) {
                if (+hours) {
                    return entryTime > (Date.now() - SECONDS_IN_AN_HOUR * (+hours));
                }else {
                    return true;
                }
            };

            $scope.scrollToTop = function () {
                var entriesContainer = $scope.entriesEl.parent();
                entriesContainer[0].scrollTop = 0;
            };

            $scope.newEntry = function ($event) {
                $scope.scrollToTop();
                var entries = $scope.domainObject.model.entries;
                var lastEntry = entries[entries.length - 1];
                if (lastEntry === undefined || lastEntry.text || lastEntry.embeds) {
                    $scope.domainObject.useCapability('mutation', function (model) {
                        var id = Date.now();
                        model.entries.push({'id': id, 'createdOn': id});
                    });
                } else {
                    $scope.domainObject.useCapability('mutation', function (model) {
                        model.entries[entries.length - 1].createdOn = Date.now();
                    });
                }
                $scope.entrySearch = '';
            };


            $scope.deleteEntry = function ($event) {
                /* This is really brittle - change the markup and this doesn't work */
                var delId = $event.currentTarget.parentElement.parentElement.id;
                var errorDialog = dialogService.showBlockingMessage({
                    severity: "error",
                    title: "This action will permanently delete this Notebook entry. Do you want to continue?",
                    minimized: true, // want the notification to be minimized initially (don't show banner)
                    options: [{
                        label: "OK",
                        callback: function () {
                            errorDialog.dismiss();
                            var elementPos = $scope.domainObject.model.entries.map(function (x) {
                                return x.id;
                            }).indexOf(+delId.replace('entry_', ''));
                            if (elementPos !== -1) {
                                $scope.domainObject.useCapability('mutation', function (model) {
                                    model.entries.splice(elementPos, 1);
                                });
                            } else {
                                window.console.log('delete error');
                            }

                        }
                    },{
                        label: "Cancel",
                        callback: function () {
                            errorDialog.dismiss();
                        }
                    }]
                });
            };

            $scope.textFocus = function ($event, entryId) {
                if ($event.currentTarget && $event.currentTarget.innerText) {
                    /*
                     On focus, if the currentTarget isn't blank, set the global currentEntryValue = the
                     content of the current focus. This will be used at blur to determine if the
                     current entry has been modified or not.
                     Not sure this is right, would think we'd always want to set curEntVal even if blank
                     */
                    $scope.currentEntryValue = $event.currentTarget.innerText;
                } else {
                    $event.target.innerText = '';
                }
            };

            //On text blur(when focus is removed)
            $scope.textBlur = function ($event, entryId) {
                // entryId is the unique numeric based on the original createdOn
                if ($event.target && $event.target.innerText !== "") {
                    var elementPos = $scope.domainObject.model.entries.map(function (x) {
                        return x.id;
                    }).indexOf(+(entryId));

                    // If the text of an entry has been changed, then update the text and the modifiedOn numeric
                    // Otherwise, don't do anything
                    if ($scope.currentEntryValue !== $event.target.innerText) {
                        $scope.domainObject.useCapability('mutation', function (model) {
                            model.entries[elementPos].text = $event.target.innerText;
                            model.entries[elementPos].modified = Date.now();
                        });
                    }
                }
            };

            $scope.finished = function (model) {
                var lastEntry = model[model.length - 1];
                if (!lastEntry.text) {
                    var newEntry = $scope.entriesEl.children().children()[0];
                    $(newEntry).find('.t-notebook-entry-input').focus();
                }
            };

            $scope.handleActive = function () {
                var newEntry = $scope.entriesEl.find('.active');
                if (newEntry) {
                    newEntry.removeClass('active');
                }
            };


            $scope.clearSearch = function () {
                $scope.entrySearch = '';
            };

            $scope.viewSnapshot = function ($event,snapshot,embedId,entryId,$innerScope,domainObject) {
                var viewAction = $scope.action.getActions({category: 'embed'})[0];
                viewAction.perform($event, snapshot, embedId, entryId, $innerScope, domainObject);
            };


            $scope.parseText = function (text) {
                if (text) {
                    return text.split(/\r\n|\r|\n/gi);
                }
            };

            //parse text and add line breaks where needed
            $scope.trustedHtml = function (text) {
                if (text) {
                    return $sce.trustAsHtml(this.parseText(text).join('<br>'));
                }
            };

            $scope.renderImage = function (img) {
                return URL.createObjectURL(img);
            };

            $scope.getDomainObj = function (id) {
                return objectService.getObjects([id]);
            };

            function refreshComp(change) {
                if (change && change.length) {
                    change[0].getCapability('action').getActions({key: 'remove'})[0].perform();
                }
            }

            $scope.actionToMenuOption = function (action) {
                return {
                    key: action.getMetadata().key,
                    name: action.getMetadata().name,
                    cssClass: action.getMetadata().cssClass,
                    perform: action.perform
                };
            };

            // Maintain all "conclude-editing" and "save" actions in the
            // present context.
            function updateActions() {
                $scope.menuEmbed = $scope.action ?
                        $scope.action.getActions({category: 'embed'}) :
                        [];

                $scope.menuEmbedNoSnap = $scope.action ?
                        $scope.action.getActions({category: 'embed-no-snap'}) :
                        [];

                $scope.menuActions = $scope.action ?
                        $scope.action.getActions({key: 'window'}) :
                        [];
            }

            // Update set of actions whenever the action capability
            // changes or becomes available.
            $scope.$watch("action", updateActions);

            $scope.navigate = function ($event,embedType) {
                if ($event) {
                    $event.preventDefault();
                }
                $scope.getDomainObj(embedType).then(function (resp) {
                    navigationService.setNavigation(resp[embedType]);
                });
            };

            $scope.saveSnap = function (url,embedPos,entryPos) {
                var snapshot = false;
                if (url) {
                    if (embedPos !== -1 && entryPos !== -1) {
                        var reader = new window.FileReader();
                        reader.readAsDataURL(url);
                        reader.onloadend = function () {
                            snapshot = reader.result;
                            $scope.domainObject.useCapability('mutation', function (model) {
                                if (model.entries[entryPos]) {
                                    model.entries[entryPos].embeds[embedPos].snapshot = {
                                        'src': snapshot,
                                        'type': url.type,
                                        'size': url.size,
                                        'modified': Date.now()
                                    };
                                    model.entries[entryPos].embeds[embedPos].id = Date.now();
                                }
                            });
                        };
                    }
                }else {
                    $scope.domainObject.useCapability('mutation', function (model) {
                        model.entries[entryPos].embeds[embedPos].snapshot = snapshot;
                    });
                }
            };

            /*---popups menu embeds----*/

            function getEmbedActions(embedType) {
                if (!$scope.embedActions.length) {
                    $scope.getDomainObj(embedType).then(function (resp) {
                        $scope.embedActions = [];
                        $scope.embedActions.push($scope.actionToMenuOption(
                                                    $scope.action.getActions({key: 'window',selectedObject: resp[embedType]})[0]
                                              ));
                        $scope.embedActions.push({
                                                key: 'navigate',
                                                name: 'Go to Original',
                                                cssClass: '',
                                                perform: function () {
                                                    $scope.navigate('', embedType);
                                                }
                                            });
                    });
                }
            }

            $scope.openMenu = function ($event,embedType) {
                $event.preventDefault();

                getEmbedActions(embedType);

                var body = $(document).find('body'),
                    initiatingEvent = agentService.isMobile() ?
                            'touchstart' : 'mousedown',
                    dismissExistingMenu,
                    menu,
                    popup;

                var container = $($event.currentTarget).parent().parent();

                menu = container.find('.menu-element');

                // Remove the context menu
                function dismiss() {
                    container.find('.hide-menu').append(menu);
                    body.off("mousedown", dismiss);
                    dismissExistingMenu = undefined;
                    $scope.embedActions = [];
                }

                // Dismiss any menu which was already showing
                if (dismissExistingMenu) {
                    dismissExistingMenu();
                }

                // ...and record the presence of this menu.
                dismissExistingMenu = dismiss;

                popup = popupService.display(menu, [$event.pageX,$event.pageY], {
                    marginX: 0,
                    marginY: -50
                });

                // Stop propagation so that clicks or touches on the menu do not close the menu
                menu.on(initiatingEvent, function (event) {
                    event.stopPropagation();
                    $timeout(dismiss, 300);
                });

                // Dismiss the menu when body is clicked/touched elsewhere
                // ('mousedown' because 'click' breaks left-click context menus)
                // ('touchstart' because 'touch' breaks context menus up)
                body.on(initiatingEvent, dismiss);

            };


            $scope.$watchCollection("composition", refreshComp);


            $scope.$on('$destroy', function () {});

        }

        return NotebookController;
    });
