import m, { FactoryComponent } from 'mithril';
import { Icon, Select } from 'mithril-materialized';
import {
  ID,
  Inconsistencies,
  ScenarioComponent,
} from '../../models/data-model';
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

// Component data structure
interface ComponentWithValues {
  id: ID;
  label: string;
  values: Array<{
    id: ID;
    label: string;
  }>;
  category?: string;
}

// Enhanced category for UI display with components
interface CategoryWithComponents extends Category {
  components: ScenarioComponent[];
}

// Component to manage cell state toggling
const InconsistencyCell: FactoryComponent<{
  inconsistencies: Inconsistencies;
  rowId: ID;
  colId: ID;
  callback: () => Promise<void>;
  disabled?: boolean;
}> = () => {
  return {
    view: ({
      attrs: { rowId, colId, inconsistencies, callback, disabled },
    }) => {
      const row = inconsistencies[rowId];
      const v = typeof row !== 'undefined' ? row[colId] : undefined;
      const iconName =
        typeof v === 'undefined'
          ? 'check_circle_outline'
          : v
          ? 'radio_button_unchecked'
          : 'blur_circular';

      return m(Icon, {
        className: disabled ? 'disabled-cell' : 'clickable',
        style: disabled ? 'opacity: 0.3; cursor: not-allowed;' : '',
        iconName,
        onclick: async () => {
          if (disabled) return;

          switch (v) {
            case true:
              inconsistencies[rowId][colId] = inconsistencies[colId][rowId] =
                false;
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
              inconsistencies[rowId][colId] = inconsistencies[colId][rowId] =
                true;
              break;
          }
          await callback();
        },
      });
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

  // Assign components to categories
  components.forEach((comp) => {
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

// Legend component to explain cell states
const InconsistencyLegend: FactoryComponent = () => {
  return {
    view: () => {
      return m(
        '.card.legend-card',
        {
          style: 'padding: 10px;',
        },
        [
          m('h6', t('INCONSISTENCIES', 'LEGEND')),
          m(
            'ul.legend-list',
            {
              style: 'list-style-type: none; padding-left: 0;',
            },
            [
              m('li', [
                m(Icon, {
                  style: 'vertical-align: middle',
                  iconName: 'check_circle_outline',
                }),
                ' ' + t('COMBINATIONS', 'POSSIBLE'),
              ]),
              m('li', [
                m(Icon, {
                  style: 'vertical-align: middle',
                  iconName: 'radio_button_unchecked',
                }),
                ' ' + t('COMBINATIONS', 'IMPOSSIBLE'),
              ]),
              m('li', [
                m(Icon, {
                  style: 'vertical-align: middle',
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

// Main inconsistencies editor component
export const InconsistenciesEditor: MeiosisComponent = () => {
  let rowCategoryId: ID = '';
  let colCategoryId: ID = '';

  return {
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
          const startIndex = currentIndex;
          currentIndex += comp.values?.length ?? 0;
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

      // Only display components not already shown in rows when using same category
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
            className: 'col s12 m5',
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
            className: 'col s12 m5',
            placeholder: t('i18n', 'pickOne'),
            label: t('INCONSISTENCIES', 'SELECT_COLUMN_CATEGORY'),
            options: categoriesWithComponents.map((c) => ({
              id: c.id,
              label: c.label,
            })),
            onchange: (ids) => (colCategoryId = ids[0] as string),
          }),

          // Legend
          m('.col.s12.m2', m(InconsistencyLegend)),
        ]),

        // Only show the matrix when both categories are selected
        rowCategory &&
          colCategory &&
          rowData &&
          colData &&
          m('.matrix-container.row', [
            m('.col.s12', [
              m(
                '.inconsistency-matrix.card',
                {
                  style: 'overflow-x: auto; padding: 1rem;',
                },
                [
                  m(
                    'table.matrix-table.highlight',
                    {
                      style: 'border-collapse: collapse;',
                    },
                    [
                      // Header row with column category components and values
                      m('thead', [
                        // First row: Empty corner
                        m('tr', [
                          // Empty corner cells for the row headers
                          m('th.corner-cell', {
                            style: 'border-bottom: 2px solid #333;',
                            colspan: 2,
                          }),
                          // Column components headers (vertical)
                          ...columnComponents.map((colComp, colIdx) =>
                            m(
                              'th.component-header',
                              {
                                colspan: colComp.values?.length,
                                style: `
                          text-align: center;
                          border-left: ${
                            colIdx === 0 ? '1px' : '2px'
                          } solid #333;
                          border-bottom: 2px solid #333;
                          background-color: ${
                            colIdx % 2 === 0 ? '#f5f9ff' : '#ffffff'
                          };
                        `,
                              },
                              colComp.label
                            )
                          ),
                        ]),
                        // Second row: Value headers (vertical)
                        m('tr.value-header-row', [
                          // Empty cells for row labels
                          m('th', { colspan: 2 }),
                          // Value headers
                          ...columnComponents.flatMap((comp, compIdx) =>
                            comp.values?.map((val) =>
                              m(
                                'th.value-header',
                                {
                                  style: `
                            min-width: 60px;
                            text-align: center;
                            font-weight: normal;
                            vertical-align: bottom;
                            padding: 10px 5px;
                            background-color: ${
                              compIdx % 2 === 0 ? '#f5f9ff' : '#ffffff'
                            };
                          `,
                                },
                                [
                                  // Rotate the text to display vertically
                                  m(
                                    'div',
                                    {
                                      style: `
                              writing-mode: vertical-rl;
                              transform: rotate(180deg);
                              white-space: nowrap;
                            `,
                                    },
                                    val.label
                                  ),
                                ]
                              )
                            )
                          ),
                        ]),
                      ]),

                      // Table body with row components and matrix cells
                      m('tbody', [
                        // For each component in the row category
                        ...rowCategory.components.flatMap(
                          (rowComp, rowCompIdx) => [
                            // For each value in the component
                            ...rowComp.values.map((rowVal, rowValIdx) => {
                              const rowIndexObj = rowData.indexes.find(
                                (i) => i.component.id === rowComp.id
                              );
                              const rowIndex = rowIndexObj
                                ? rowIndexObj.startIndex + rowValIdx
                                : 0;

                              return m(
                                'tr',
                                {
                                  style: `
                          background-color: ${
                            rowCompIdx % 2 === 0 ? '#f5f9ff' : '#ffffff'
                          };
                          ${
                            rowValIdx === 0 ? 'border-top: 2px solid #333;' : ''
                          }
                        `,
                                },
                                [
                                  // Display component name for first value only (merged cells)
                                  rowValIdx === 0
                                    ? m(
                                        'th.component-name',
                                        {
                                          rowspan: rowComp.values?.length,
                                          style: `
                                padding: 10px;
                                border-right: 1px solid #ddd;
                                font-weight: bold;
                                text-align: right;
                              `,
                                        },
                                        rowComp.label
                                      )
                                    : null,

                                  // Value name
                                  m(
                                    'th.value-name',
                                    {
                                      style: `
                            padding: 10px;
                            font-weight: normal;
                            text-align: right;
                            border-right: 1px solid #333;
                          `,
                                    },
                                    rowVal.label
                                  ),

                                  // Matrix cells - one for each column value
                                  ...columnComponents.flatMap(
                                    (colComp, colCompIdx) =>
                                      colComp.values?.map(
                                        (colVal, colValIdx) => {
                                          const colIndexObj =
                                            colData.indexes.find(
                                              (i) =>
                                                i.component.id === colComp.id
                                            );
                                          const colIndex = colIndexObj
                                            ? colIndexObj.startIndex + colValIdx
                                            : 0;

                                          // Check if this is a component comparing against itself
                                          const isSameComponent =
                                            rowComp.id === colComp.id;
                                          // Check if this is in the upper triangle when not using same component
                                          const isUpperTriangle =
                                            usingSameCategory &&
                                            rowCompIdx > colCompIdx;

                                          // Cells are disabled if:
                                          // 1. Same component (comparing component with itself is not valid)
                                          // 2. In the upper triangle when displaying same category on both axes
                                          const isDisabled =
                                            isSameComponent || isUpperTriangle;

                                          return m(
                                            'td.matrix-cell',
                                            {
                                              style: `
                                text-align: center;
                                padding: 8px;
                                background-color: ${
                                  isDisabled
                                    ? '#f0f0f0'
                                    : (colCompIdx % 2 === 0 &&
                                        rowCompIdx % 2 === 0) ||
                                      (colCompIdx % 2 === 1 &&
                                        rowCompIdx % 2 === 1)
                                    ? '#f5f9ff'
                                    : '#ffffff'
                                };
                                ${
                                  colValIdx === 0
                                    ? 'border-left: 2px solid #333;'
                                    : ''
                                }
                              `,
                                            },
                                            isDisabled
                                              ? m(
                                                  '.disabled-cell',
                                                  { style: 'color: #ccc;' },
                                                  '—'
                                                )
                                              : m(InconsistencyCell, {
                                                  rowId: rowVal.id,
                                                  colId: colVal.id,
                                                  inconsistencies,
                                                  callback: async () =>
                                                    await saveModel(
                                                      attrs,
                                                      model
                                                    ),
                                                })
                                          );
                                        }
                                      )
                                  ),
                                ]
                              );
                            }),
                          ]
                        ),
                      ]),
                    ]
                  ),
                ]
              ),
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
