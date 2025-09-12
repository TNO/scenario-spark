import m, { FactoryComponent } from 'mithril';
import { Icon, Select } from 'mithril-materialized';
import { ID, Inconsistencies } from '../../models/data-model';
import { MeiosisComponent, saveModel, t } from '../../services';

// Interface for component categories based on your provided type
type Item = {
  id: ID;
  label: string;
  desc?: string;
};

type Category = Item & {
  decisionSupport?: boolean;
  includeLLM?: boolean;
  componentIds?: ID[];
};

type ScenarioComponent = Item & {
  /** Optional sort order */
  order?: number;
  /** Manual mode - if so, do not automatically generate a value for it */
  manual?: boolean;
  values?: Array<{
    id: ID;
    label: string;
  }>;
  category?: string;
};

// Enhanced category for UI display with components
interface CategoryWithComponents extends Category {
  components: ScenarioComponent[];
}

// Tooltip component for cell info
const CellTooltip: FactoryComponent<{
  rowComponent: string;
  rowValue: string;
  colComponent: string;
  colValue: string;
}> = () => {
  return {
    view: ({ attrs: { rowComponent, rowValue, colComponent, colValue } }) => {
      return m('.tooltip-content', [
        m('strong', 'Combination:'),
        m('div', `${rowComponent}: ${rowValue}`),
        m('div', `${colComponent}: ${colValue}`),
      ]);
    },
  };
};

// Simplified cell component with tooltip
const InconsistencyCell: FactoryComponent<{
  inconsistencies: Inconsistencies;
  rowId: ID;
  colId: ID;
  callback: () => Promise<void>;
  disabled?: boolean;
  rowComponent: string;
  rowValue: string;
  colComponent: string;
  colValue: string;
}> = () => {
  let tooltipVisible = false;

  return {
    view: ({
      attrs: {
        rowId,
        colId,
        inconsistencies,
        callback,
        disabled,
        rowComponent,
        rowValue,
        colComponent,
        colValue,
      },
    }) => {
      const row = inconsistencies[rowId];
      const v = typeof row !== 'undefined' ? row[colId] : undefined;

      // Simplified icon selection
      const iconName =
        typeof v === 'undefined'
          ? 'check_circle_outline'
          : v
          ? 'radio_button_unchecked'
          : 'blur_circular';

      const cellClassName =
        typeof v === 'undefined'
          ? 'inconsistency-cell-possible' // green for possible
          : v
          ? 'inconsistency-cell-impossible' // red for impossible
          : 'inconsistency-cell-improbable'; // orange for improbable

      return m(
        '.cell-with-tooltip',
        {
          style: 'position: relative;',
          onmouseover: () => {
            tooltipVisible = true;
          },
          onmouseout: () => {
            tooltipVisible = false;
          },
        },
        [
          m(Icon, {
            className: disabled 
              ? 'disabled-cell' 
              : `clickable ${cellClassName}`,
            style: disabled
              ? 'opacity: 0.3; cursor: not-allowed; font-size: 1.2rem;'
              : 'font-size: 1.2rem;',
            iconName,
            onclick: async (e: MouseEvent) => {
              e.stopPropagation();
              if (disabled) return;

              switch (v) {
                case true:
                  inconsistencies[rowId][colId] = inconsistencies[colId][
                    rowId
                  ] = false;
                  break;
                case false:
                  delete inconsistencies[rowId][colId];
                  delete inconsistencies[colId][rowId];
                  break;
                default:
                  if (!inconsistencies[rowId]) {
                    inconsistencies[rowId] = {};
                  }
                  if (!inconsistencies[colId]) {
                    inconsistencies[colId] = {};
                  }
                  inconsistencies[rowId][colId] = inconsistencies[colId][
                    rowId
                  ] = true;
                  break;
              }
              await callback();
            },
          }),
          tooltipVisible &&
            m(
              '.inconsistency-tooltip',
              {},
              m(CellTooltip, {
                rowComponent,
                rowValue,
                colComponent,
                colValue,
              })
            ),
        ]
      );
    },
  };
};

// Legend component to explain cell states
const InconsistencyLegend: FactoryComponent = () => {
  return {
    view: () => {
      return m(
        '.card.legend-card',
        {
          style: 'padding: 4px; margin: 0;',
        },
        [
          // m('h6', t('INCONSISTENCIES', 'LEGEND')),
          m(
            'ul.legend-list',
            {
              style: 'list-style-type: none; padding-left: 0; margin: 0;',
            },
            [
              m('li', [
                m(Icon, {
                  className: 'inconsistency-cell-possible',
                  style: 'vertical-align: middle;',
                  iconName: 'check_circle_outline',
                }),
                ' ' + t('COMBINATIONS', 'POSSIBLE'),
              ]),
              m('li', [
                m(Icon, {
                  className: 'inconsistency-cell-impossible',
                  style: 'vertical-align: middle;',
                  iconName: 'radio_button_unchecked',
                }),
                ' ' + t('COMBINATIONS', 'IMPOSSIBLE'),
              ]),
              m('li', [
                m(Icon, {
                  className: 'inconsistency-cell-improbable',
                  style: 'vertical-align: middle;',
                  iconName: 'blur_circular',
                }),
                ' ' + t('COMBINATIONS', 'IMPROBABLE'),
              ]),
            ]
          ),
        ]
      );
    },
  };
};

// Group components by category to make selection easier
const groupComponentsByCategory = (
  components: ScenarioComponent[],
  categories: Category[]
): CategoryWithComponents[] => {
  const categoryMap: Record<string, CategoryWithComponents> = {};

  // Initialize categories
  categories.forEach((cat) => {
    categoryMap[cat.id] = {
      ...cat,
      components: [],
    };
  });

  // Assign components to categories - only include components with values
  components.forEach((comp) => {
    // Skip components without values
    if (!comp.values || comp.values.length === 0) return;

    const categoryIds = categories
      .filter((cat) => cat.componentIds?.includes(comp.id))
      .map((cat) => cat.id);

    if (categoryIds.length) {
      categoryIds.forEach((catId) => {
        if (categoryMap[catId]) {
          categoryMap[catId].components.push(comp);
        }
      });
    } else {
      // Add to uncategorized if no category found
      if (!categoryMap['uncategorized']) {
        categoryMap['uncategorized'] = {
          id: 'uncategorized',
          label: 'Uncategorized',
          components: [],
        };
      }
      categoryMap['uncategorized'].components.push(comp);
    }
  });

  // Return only categories with components
  return Object.values(categoryMap).filter((cat) => cat.components.length > 0);
};

// Main inconsistencies editor component
export const InconsistenciesEditor: MeiosisComponent = () => {
  let rowCategoryId: ID = '';
  let colCategoryId: ID = '';

  return {
    oninit: ({ attrs }) => {
      const {
        model: { scenario: { categories } = { categories: [] } } = {
          scenario: {},
        },
      } = attrs.state;
      if (categories && categories.length) {
        rowCategoryId = colCategoryId = categories[0].id;
      }
    },
    view: ({ attrs }) => {
      const { model } = attrs.state;
      const { inconsistencies } = model.scenario;
      const components = model.scenario.components.filter(
        (c) => c.id && c.label
      );
      const categories = model.scenario.categories || [];

      // Group components by category
      const categoriesWithComponents = groupComponentsByCategory(
        components,
        categories
      );

      // Get selected categories
      const rowCategory = categoriesWithComponents.find(
        (c) => c.id === rowCategoryId
      );
      const colCategory = categoriesWithComponents.find(
        (c) => c.id === colCategoryId
      );

      // Check if using the same category for both axes
      const usingSameCategory = rowCategoryId === colCategoryId;

      // Calculate total cells and indexes for each component's values
      const calculateValueIndexes = (category: CategoryWithComponents) => {
        let result = [];
        let currentIndex = 0;

        for (const comp of category.components) {
          if (!comp.values || comp.values.length === 0) continue;

          const startIndex = currentIndex;
          currentIndex += comp.values.length;
          result.push({
            component: comp,
            startIndex,
            endIndex: currentIndex - 1,
          });
        }

        return {
          indexes: result,
          totalValues: currentIndex,
        };
      };

      const rowData = rowCategory ? calculateValueIndexes(rowCategory) : null;
      const colData = colCategory ? calculateValueIndexes(colCategory) : null;

      // Get column components - when using the same category but different arrangement
      const getColumnComponents = () => {
        if (!usingSameCategory || !colCategory)
          return colCategory?.components || [];

        return colCategory.components;
      };

      const columnComponents = getColumnComponents();

      return m('.inconsistencies-editor', [
        m('.category-selectors.row', [
          // Row category selector
          m(Select, {
            checkedId: rowCategoryId,
            iconName: 'view_stream',
            className: 'col s12 m4',
            placeholder: t('i18n', 'pickOne'),
            label: t('INCONSISTENCIES', 'SELECT_ROW_CATEGORY'),
            options: categoriesWithComponents.map((c) => ({
              id: c.id,
              label: c.label,
            })),
            onchange: (ids) => (rowCategoryId = ids[0] as string),
          }),

          // Column category selector
          m(Select, {
            checkedId: colCategoryId,
            iconName: 'view_column',
            className: 'col s12 m4',
            placeholder: t('i18n', 'pickOne'),
            label: t('INCONSISTENCIES', 'SELECT_COLUMN_CATEGORY'),
            options: categoriesWithComponents.map((c) => ({
              id: c.id,
              label: c.label,
            })),
            onchange: (ids) => (colCategoryId = ids[0] as string),
          }),

          // Legend
          m('.col.s12.m4', m(InconsistencyLegend)),
        ]),

        // Only show the matrix when both categories are selected
        rowCategory &&
          colCategory &&
          rowData &&
          colData &&
          m('.matrix-container.row', [
            m('.col.s12', [
              m('.inconsistency-matrix.card', [
                m(
                  'table.matrix-table.highlight.matrix-table-themed',
                  {
                    style: 'border-collapse: collapse; position: relative;',
                  },
                  [
                    // Header row with column category components and values - fixed position
                    m(
                      'thead',
                      {
                        style: 'position: sticky; top: 0; z-index: 20;',
                      },
                      [
                        // First row: Empty corner
                        m('tr', [
                          // Empty corner cells for the row headers - fixed position
                          m('th.corner-cell', {
                            rowspan: 2,
                            colspan: 2,
                          }),
                          // Column components headers
                          ...columnComponents
                            .map((colComp, colIdx) => {
                              return m(
                                'th.component-header',
                                {
                                  colspan: colComp.values!.length,
                                  className: colIdx % 2 === 0 ? 'matrix-cell-alt-bg' : '',
                                },
                                colComp.label
                              );
                            })
                            .filter(Boolean),
                        ]),
                        // Second row: Value headers
                        m('tr.value-header-row', [
                          // Value headers with dividers between components
                          ...columnComponents.flatMap((comp, compIdx) => {
                            if (!comp.values || comp.values.length === 0)
                              return [];

                            return comp.values.map((val, valIdx) =>
                              m(
                                'th.value-header',
                                {
                                  className: compIdx % 2 === 0 ? 'matrix-cell-alt-bg' : '',
                                  style: valIdx === 0
                                    ? 'border-left: 2px solid var(--mm-border-color);'
                                    : '',
                                },
                                m('div', val.label)
                              )
                            );
                          }),
                        ]),
                      ]
                    ),

                    // Table body with row components and matrix cells
                    m('tbody', [
                      // For each component in the row category
                      ...rowCategory.components
                        // .filter((rowComp, i) => i > 0)
                        .flatMap((rowComp, rowCompIdx) => {
                          if (!rowComp.values || rowComp.values.length === 0)
                            return [];

                          // For each value in the component
                          return rowComp.values.map((rowVal, rowValIdx) => {
                            // Calculate left position for sticky columns
                            // First column (component name) width
                            const firstColWidth = 120;

                            return m(
                              'tr',
                              {
                                className: rowCompIdx % 2 === 0 ? 'matrix-cell-alt-bg' : '',
                                style: rowValIdx === 0
                                  ? 'border-top: 2px solid var(--mm-border-color);'
                                  : '',
                              },
                              [
                                // Display component name for first value only (merged cells) - fixed position
                                rowValIdx === 0
                                  ? m(
                                      'th.component-name',
                                      {
                                        rowspan: rowComp.values?.length,
                                        className: rowCompIdx % 2 === 0 ? 'matrix-cell-alt-bg' : '',
                                      },
                                      rowComp.label
                                    )
                                  : null,

                                // Value name - fixed position
                                m(
                                  'th.value-name',
                                  {
                                    className: rowCompIdx % 2 === 0 ? 'matrix-cell-alt-bg' : '',
                                    style: `left: ${firstColWidth}px;`,
                                  },
                                  rowVal.label
                                ),

                                // Matrix cells - one for each column value
                                ...columnComponents.flatMap(
                                  (colComp, colCompIdx) => {
                                    if (
                                      !colComp.values ||
                                      colComp.values.length === 0
                                    )
                                      return [];

                                    return colComp.values.map(
                                      (colVal, colValIdx) => {
                                        // Cells should be disabled if:
                                        // 1. Same component (comparing component with itself is not valid)
                                        // 2. In the upper triangle when the same category is used on both axes
                                        const isSameComponent =
                                          rowComp.id === colComp.id;

                                        // When using same category, display only half of the matrix
                                        // We'll use the lower triangle: only show cells where rowCompIdx >= colCompIdx
                                        const isInHiddenTriangle =
                                          usingSameCategory &&
                                          (rowCompIdx < colCompIdx ||
                                            (rowCompIdx === colCompIdx &&
                                              rowValIdx < colValIdx));

                                        const isDisabled =
                                          isSameComponent || isInHiddenTriangle;

                                        return m(
                                          'td.matrix-cell',
                                          {
                                            className: isDisabled
                                              ? 'matrix-disabled-cell'
                                              : (colCompIdx % 2 === 0 &&
                                                  rowCompIdx % 2 === 0) ||
                                                (colCompIdx % 2 === 1 &&
                                                  rowCompIdx % 2 === 1)
                                              ? 'matrix-cell-alt-bg'
                                              : '',
                                            style: colValIdx === 0
                                              ? 'border-left: 2px solid var(--mm-border-color);'
                                              : '',
                                          },
                                          !isDisabled &&
                                            m(InconsistencyCell, {
                                              rowId: rowVal.id,
                                              colId: colVal.id,
                                              inconsistencies,
                                              callback: async () =>
                                                await saveModel(attrs, model),
                                              rowComponent: rowComp.label,
                                              rowValue: rowVal.label,
                                              colComponent: colComp.label,
                                              colValue: colVal.label,
                                              disabled: isDisabled,
                                            })
                                        );
                                      }
                                    );
                                  }
                                ),
                              ]
                            );
                          });
                        }),
                    ]),
                  ]
                ),
              ]),
            ]),
          ]),

        // Show message when categories aren't selected
        (!rowCategory || !colCategory) &&
          m(
            '.col.s12.center-align',
            m('p.flow-text', t('INCONSISTENCIES', 'SELECT_CATEGORIES_TO_START'))
          ),
      ]);
    },
  };
};
