(function () {
  'use strict';

  /**
   * @ngdoc overview
   * @name ui.grid.grouping
   * @description
   *
   *  # ui.grid.grouping
   * This module provides grouping to the end user via menu options in the column header
   * <br/>
   * <br/>
   *
   * <div doc-module-components="ui.grid.grouping"></div>
   */

  var module = angular.module('ui.grid.grouping', ['ui.grid']);


  /**
   *  @ngdoc service
   *  @name ui.grid.grouping.service:uiGridGroupingService
   *
   *  @description Services for grouping features
   */
  module.service('uiGridGroupingService', ['gridUtil', 'uiGridConstants', 'i18nService', 'GroupingRow',
    function (gridUtil, uiGridConstants, i18nService, GroupingRow) {
      var service = {
        initializeGrid: function (scope, grid) {

          //add feature namespace and any properties to grid for needed state
          grid.grouping = {};
          grid.grouping.groupings = [];
          grid.grouping.groupCache = [];
          //grid.grouping.parsedRows = [];
          grid.grouping.numberOfGroupings = 0;

          grid.grouping.isGroupingRow = function (row) {
            gridUtil.logDebug("isGrouping: " + row.isGrouping === true);
            return row.isGroupingRow === true;
          };

          service.defaultGridOptions(grid.options);

          // Register a column builder to add new menu items for grouping
          grid.registerColumnBuilder(service.groupingColumnBuilder);

          grid.registerRowsProcessor(service.groupingRowsProcessor);
          grid.registerRowBuilder(service.groupingRowBuilder);


          /**
         *  @ngdoc object
         *  @name ui.grid.grouping.api:PublicApi
         *
         *  @description Public Api for grouping feature
         */
        /**
         *  @ngdoc object
         *  @name ui.grid.grouping.api:GridOptions
         *
         *  @description Options for configuring the groupingRow feature, these are available to be
         *  set using the ui-grid {@link ui.grid.class:GridOptions gridOptions}
         */

        var publicApi = {
          events: {
            grouping: {

            }
          },

          methods: {
            grouping: {

            }
          }
        };
        grid.api.registerEventsFromObject(publicApi.events);
        grid.api.registerMethodsFromObject(publicApi.methods);

        },

        defaultGridOptions: function (gridOptions) {
          //default option to true unless it was explicitly set to false
          /**
           *  @ngdoc object
           *  @name ui.grid.grouping.api:GridOptions
           *
           *  @description GridOptions for grouping feature, these are available to be
           *  set using the ui-grid {@link ui.grid.class:GridOptions gridOptions}
           */

          /**
           *  @ngdoc object
           *  @name enableGrouping
           *  @propertyOf  ui.grid.grouping.api:GridOptions
           *  @description Enable grouping for the entire grid.
           *  <br/>Defaults to true
           */
          gridOptions.enableGrouping = gridOptions.enableGrouping !== false;

          /**
           *  @ngdoc object
           *  @name groupExpandByDefault
           *  @propertyOf  ui.grid.grouping.api:GridOptions
           *  @description Define if grouping rows should be expanded by default
           *  <br/>Defaults to true
           */
          gridOptions.groupExpandByDefault = gridOptions.groupExpandByDefault !== false;

          gridOptions.groupingRowTemplate = gridOptions.groupingRowTemplate || 'ui-grid/groupingRow';

        },

        /**
         * @ngdoc function
         * @name setGroupByColumn
         * @methodOf  ui.grid.grouping.service:uiGridGroupingService
         * @description Set group by column
         * @param {Grid} grid grid object
         * @param {GridColumn} col column that is being grouped by
         * @param {bool} groupBy if true, column will be grouped by
         */
        setGroupByColumn: function (grid, colDef, col, groupBy) {
          var colIndex = grid.grouping.groupings.indexOf(col);
          if (colIndex === -1 && groupBy === true) {
            if (col.grouping === undefined) {
              col.grouping = {};
            }
            // This variable fix so that the sorting is stored over a reset of the sort function.
            // col.grouping.direction = col.sort.direction === undefined ? uiGridConstants.ASC : col.sort.direction;

            grid.grouping.groupings.push(col);
          } else if (colIndex >= 0 && groupBy === false) {
            grid.grouping.groupings.splice(colIndex, 1);
          }

          // gridUtil.logDebug("setGroupByColumn was called");

          //grid.api.core.raise.sortChanged( col, grid.getColumnSorting() );

          grid.refresh();

        },



        createGroups: function (grid, rows, groupByColumns, columns) {
          grid.grouping.groupCache = [];
          grid.grouping.numberOfGroupings = 0;
          grid.grouping.groupedData = {};

          var maxDepth = groupByColumns.length;


          for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            row.visible = grid.options.groupExpandByDefault;

            var ptr = grid.grouping.groupedData;

            for (var x = 0; x < groupByColumns.length; x++) {
              var groupColumn = groupByColumns[x];
              var value = row['entity'][groupColumn.name];
              value = value ? value.toString() : 'null';
              if (!ptr.values) {
                ptr.values = {};
              }
              if (!ptr.values[value]) {
                ptr.values[value] = {};
              }
              if (!ptr.depth) {
                ptr.depth = x;
              }
              if (!ptr.column) {
                ptr.column = groupColumn;
              }
              ptr = ptr.values[value]; // Go one step deeper
            }

            if (!ptr.rows) {
              ptr.rows = [];
            }
            ptr.rows.push(row);
          }

          var parsedRows = [];

          parsedRows = service.parseGroupData(grid, grid.grouping.groupedData, parsedRows, []);

          return parsedRows;
        },

        parseGroupData: function (grid, groupData, parsedRows, parentCache) {

          if (!groupData) {
            return parsedRows;
          }

          if (groupData.rows) {
            // console.log("Number of rows found: " + groupData.rows.length);
            angular.forEach(groupData.rows, function (row, index) {
              parentCache[parentCache.length - 1].rowChildren.push(row);
            });
          }
          else {
            for (var prop in groupData.values) {
              var groupingRow = service.buildGroupingRow( grid, {
                  groupLabel: prop,
                  groupName: groupData.column.name,
                  groupDepth: groupData.depth,
                  rowChildren: [],
                  groupChildren: [],
                  groupingIndex: grid.grouping.numberOfGroupings
                }, 0);

              grid.grouping.numberOfGroupings++;

              groupingRow.parent = parentCache[groupingRow.depth - 1];

              if (groupingRow.parent) {
                groupingRow.parent.collapsed = false;
                groupingRow.groupChildren.push(groupingRow);
              }

              parsedRows.push(groupingRow);

              parentCache[groupingRow.depth] = groupingRow;

              service.parseGroupData(grid, groupData.values[prop], parsedRows, parentCache);
            }
          }

          return parsedRows;
        },

        buildGroupingRow: function (grid, groupingEntity, rowIndex) {
          var groupingRow = grid.grouping.groupCache[groupingEntity.groupingIndex];

          if (!groupingRow) {
            groupingRow = new GroupingRow(grid, groupingEntity, rowIndex, grid.options.groupExpandByDefault);
            grid.grouping.groupCache[groupingEntity.groupingIndex] = groupingRow;
          }
          else {
            groupingRow.rowIndex = rowIndex;
          }


          return groupingRow;

        },

        groupingRowsProcessor: function (renderableRows) {

          if (!renderableRows) {
            return;
          } else if (renderableRows.length === 0) {
            return renderableRows;
          }

          var grid = renderableRows[0].grid;

          if (grid.grouping.groupings.length === 0) {
            return renderableRows;
          }

          var groupingRows = service.createGroups(grid, renderableRows, grid.grouping.groupings, grid.columns);

          return groupingRows;
        },

        groupingRowBuilder: function (row, gridOptions) {
          row.grouping = row.grouping === undefined ? {} : row.grouping;
          row.grouping.expanded = row.grouping.expanded === undefined ? gridOptions.groupExpandByDefault : row.grouping.expanded;

          row.grouping.isGroupingRow = false; //row.grouping.isGroupingRow === true;
          row.isGroupingRow = function () {
            return row.grouping.isGroupingRow;
          };

        },

        groupingColumnBuilder: function (colDef, col, gridOptions) {
          /**
           *  @ngdoc object
           *  @name ui.grid.grouping.api:ColumnDef
           *
           *  @description ColumnDef for grouping feature, these are available to be
           *  set using the ui-grid {@link ui.grid.class:GridOptions.columnDef gridOptions.columnDefs}
           */


          /**
           *  @ngdoc object
           *  @name groupBy
           *  @propertyOf  ui.grid.grouping.api:ColumnDef
           *  @description Enable group by for the individual column.
           *  <br/>Defaults to false
           */
          colDef.isGroupBy = colDef.isGroupBy === true && gridOptions.enableGrouping === true;



          var groupByAction = {
            title: "Group By", //i18nService.getSafeText('grouping.groupBy')
            icon: 'ui-grid-icon-cancel',
            shown: function () {
              return gridOptions.enableGrouping === true && colDef.isGroupBy === false;
              //typeof(col) !== 'undefined' && (typeof(col.sort) !== 'undefined' &&
              //typeof(col.sort.direction) !== 'undefined') && col.sort.direction !== null
            },
            action: function () {
              colDef.isGroupBy = true;
              service.setGroupByColumn(col.grid, colDef, col, colDef.isGroupBy);
            }
          };

          var removeGroupByAction = {
            title: "Ungroup", //i18nService.getSafeText('grouping.ungroup')
            icon: 'ui-grid-icon-cancel',
            shown: function () {
              return gridOptions.enableGrouping === true && colDef.isGroupBy === true;
              //typeof(col) !== 'undefined' && (typeof(col.sort) !== 'undefined' &&
              //typeof(col.sort.direction) !== 'undefined') && col.sort.direction !== null
            },
            action: function () {
              colDef.isGroupBy = false;
              service.setGroupByColumn(col.grid, colDef, col, colDef.isGroupBy);
            }
          };

          col.menuItems.push(groupByAction);
          col.menuItems.push(removeGroupByAction);
        }
      };

      return service;
    }]);


  module.factory('GroupingRow', ['gridUtil', function(gridUtil) {

    function GroupingRow(grid, groupingEntity, rowIndex, groupInitState) {
      this.grid = grid;
      this.rowIndex = rowIndex;
      this.entity = groupingEntity;
      this.label = groupingEntity.groupLabel;
      this.name = groupingEntity.groupName;
      this.depth = groupingEntity.groupDepth;
      this.parent = groupingEntity.groupParent;
      this.rowChildren = groupingEntity.rowChildren;
      this.groupChildren = groupingEntity.groupChildren;
      this.groupingIndex = groupingEntity.groupingIndex;
      this.collapsed = groupInitState;
      this.groupInitState = groupInitState;
      this.grouping = {};
      this.grouping.isGroupingRow = true;
      this.visible = true;
      //this.groupLabelFilter = groupingEntity.groupLabelFilter;

      this.height = grid.options.rowHeight;

    }

    GroupingRow.prototype.toggleExpand = function() {
      this.collapsed = this.collapsed ? false : true;
    };

    GroupingRow.prototype.notifyChildren = function() {

      angular.forEach(this.groupChildren, function (child, index) {
        if (child) {
          child.visible = this.collapsed;
          if (this.collapsed) {
            child.setExpand(this.collapsed);
          }
        }
      });

      angular.forEach(this.rowChildren, function (child, index) {
        child.visible = this.collapsed;
      });
    };

    GroupingRow.prototype.groupingClass = function() {
      return this.collapsed ? "uiGroupingArrowCollapsed" : "uiGroupingArrowExpanded";
    };

    GroupingRow.prototype.isGroupingRow = function() {
      return this.grouping.isGroupingRow;
    };
    return GroupingRow;
  }]);





  module.directive('uiGridGrouping', ['uiGridGroupingService', '$templateCache',
    function (uiGridGroupingService, $templateCache) {
      return {
        replace: true,
        priority: 0,
        require: '^uiGrid',
        scope: false,
        compile: function () {
          return {
            pre: function ($scope, $elm, $attrs, uiGridCtrl) {
              uiGridGroupingService.initializeGrid($scope, uiGridCtrl.grid);
            },
            post: function ($scope, $elm, $attrs, uiGridCtrl) {
            }
          };
        }
      };
    }]);

  module.directive('uiGridViewport',
    ['$compile', 'gridUtil', '$templateCache',
      function ($compile, gridUtil, $templateCache) {
        return {
          priority: -200,
          scope: false,
          compile: function ($elm, $attrs) {
            var rowRepeatDiv = angular.element($elm.children().children()[0]);
            var rowDiv = rowRepeatDiv[0].children[0];
            var groupingRowElement = $templateCache.get('ui-grid/groupingRow');
            rowRepeatDiv.append("<div ui-grid-grouping-row='row' row-render-index='rowRenderIndex' ng-if='row.isGroupingRow(row)'></div>");
            rowDiv.setAttribute("ng-if", "!row.isGroupingRow(row)");
            //rowDiv.setAttribute("ng-if", "false");

/*
            rowRepeatDiv.append(
              "row: {{row.isGroupingRow()}} <br/>" +
              "row2: {{row.isGroupingRow() !== true}} <br/>" +
              "row3: {{!row.isGroupingRow()}}"
            );
*/

            //rowRepeatDiv.append(groupingRowElement);
            return {
              pre: function ($scope, $elm, $attrs, controllers) {
                // $scope.isGroupingRow = function(row) {
                //   return row.grouping && row.grouping.isGroupingRow === true;
                // };
              },
              post: function ($scope, $elm, $attrs, controllers) {
              }
            };
          }
        }; // "<div ui-grid-row="row" row-render-index="rowRenderIndex"></div>"
      }]);

/*
  module.directive('uiGridRow',
    ['$compile', 'gridUtil', '$templateCache',
      function ($compile, gridUtil, $templateCache) {
        return {
          priority: -200,
          //scope: false,
          scope: {
             row: '=uiGridRow',
             //rowRenderIndex is added to scope to give the true visual index of the row to any directives that need it
             rowRenderIndex: '='
          },
          compile: function ($elm, $attrs) {
            return {
              pre: function ($scope, $elm, $attrs, controllers) {

                $scope.groupingRow = {};

                $scope.groupingRow.isGroupingRow = function () {
                  return $scope.row.grid.options.enableGrouping && $scope.row.isGroupingRow === true;
                };
              },
              post: function ($scope, $elm, $attrs, controllers) {
              }
            };
          }
        };
      }]);
*/
  module.directive('uiGridGroupingRow',
    ['$compile', 'gridUtil', '$templateCache',
      function ($compile, gridUtil, $templateCache) {
        return {
          replace: true,
          priority: -200,
          //scope: false,
          scope: {
             row: '=uiGridGroupingRow',
             //rowRenderIndex is added to scope to give the true visual index of the row to any directives that need it
             rowRenderIndex: '='
          },
          compile: function ($elm, $attrs) {
            var groupingRowElement = $templateCache.get('ui-grid/groupingRow');
            $elm.append(groupingRowElement);
            return {
              pre: function ($scope, $elm, $attrs, controllers) {
                /*
                $scope.groupingRow = {};

                $scope.groupingRow.isGroupingRow = function () {
                  return $scope.row.grid.options.enableGrouping && $scope.row.isGroupingRow === true;
                };
                */
                /*
                gridUtil.getTemplate($scope.grid.options.groupingRowTemplate).then(
                  function (template) {
                    var groupingRowElement = $compile(template)($scope);
                    $elm.append(groupingRowElement);
                  }
                );
                */
              },
              post: function ($scope, $elm, $attrs, controllers) {
              }
            };
          }
        };
      }]);

})();
