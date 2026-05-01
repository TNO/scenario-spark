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

type ComponentValue = {
  id: ID;
  label: string;
};

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
  onactivate?: () => void;
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
        onactivate,
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

              onactivate?.();

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

const KeyboardLegend: FactoryComponent = () => {
  return {
    view: () =>
      m('.card.nav-legend-card', [
        m('.nav-legend-row.nav-legend-row-combinations', [
          m('.nav-legend-item', [
            m(Icon, {
              className: 'inconsistency-cell-possible nav-legend-icon',
              iconName: 'check_circle_outline',
            }),
            m('span', t('COMBINATIONS', 'POSSIBLE')),
          ]),
          m('.nav-legend-item', [
            m(Icon, {
              className: 'inconsistency-cell-impossible nav-legend-icon',
              iconName: 'radio_button_unchecked',
            }),
            m('span', t('COMBINATIONS', 'IMPOSSIBLE')),
          ]),
          m('.nav-legend-item', [
            m(Icon, {
              className: 'inconsistency-cell-improbable nav-legend-icon',
              iconName: 'blur_circular',
            }),
            m('span', t('COMBINATIONS', 'IMPROBABLE')),
          ]),
        ]),
        m('.nav-legend-row.nav-legend-row-keyboard', [
          m('strong.nav-legend-keyboard-label', `${t('INCONSISTENCIES', 'NAV_TITLE')}:`),
          m('.nav-legend-item', [
            m(Icon, {
              iconName: 'open_with',
              className: 'nav-legend-icon',
            }),
            m('span', t('INCONSISTENCIES', 'NAV_ARROWS')),
          ]),
          m('.nav-legend-item', [
            m(Icon, {
              iconName: 'keyboard_return',
              className: 'nav-legend-icon',
            }),
            m('span', t('INCONSISTENCIES', 'NAV_TOGGLE')),
          ]),
        ]),
      ]),
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

const getInconsistencyValue = (
  inconsistencies: Inconsistencies,
  rowId: ID,
  colId: ID
) => {
  const row = inconsistencies[rowId];
  return typeof row !== 'undefined' ? row[colId] : undefined;
};

const cycleInconsistencyValue = (
  inconsistencies: Inconsistencies,
  rowId: ID,
  colId: ID
) => {
  const v = getInconsistencyValue(inconsistencies, rowId, colId);

  switch (v) {
    case true:
      inconsistencies[rowId][colId] = inconsistencies[colId][rowId] = false;
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
      inconsistencies[rowId][colId] = inconsistencies[colId][rowId] = true;
      break;
  }
};

const hasValues = (comp: ScenarioComponent) =>
  Array.isArray(comp.values) && comp.values.length > 0;

const firstSelectableComponentId = (
  components: ScenarioComponent[],
  excludedId?: ID
) => {
  const candidate = components.find(
    (comp) => hasValues(comp) && (!excludedId || comp.id !== excludedId)
  );
  return candidate?.id || '';
};

const cycleComponentId = (
  components: ScenarioComponent[],
  currentId: ID,
  direction: 1 | -1,
  excludedId?: ID
) => {
  if (!components.length) return '';

  const ids = components
    .filter((comp) => hasValues(comp))
    .map((comp) => comp.id)
    .filter((id) => !excludedId || id !== excludedId);

  if (!ids.length) return '';

  const currentIndex = ids.indexOf(currentId);
  const start = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (start + direction + ids.length) % ids.length;
  return ids[nextIndex];
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const focusedCellAttrs = (isFocused: boolean) => {
  if (!isFocused) {
    return {};
  }
  return {
    oncreate: ({ dom }: { dom: Element }) => {
      dom.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
    onupdate: ({ dom }: { dom: Element }) => {
      dom.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    },
  };
};

// Main inconsistencies editor component
export const InconsistenciesEditor: MeiosisComponent = () => {
  let rowCategoryId: ID = '';
  let colCategoryId: ID = '';
  let activeRowCompId: ID = '';
  let activeColCompId: ID = '';
  let activeCellRow = 0;
  let activeCellCol = 0;
  let colHeaderHeight = 0;
  let colHeaderResizeObserver: ResizeObserver | undefined;

  const syncColHeaderHeight = (dom: Element) => {
    const nextHeight = Math.ceil((dom as HTMLElement).getBoundingClientRect().height);
    if (nextHeight > 0 && nextHeight !== colHeaderHeight) {
      colHeaderHeight = nextHeight;
      m.redraw();
    }
  };

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
    onremove: () => {
      colHeaderResizeObserver?.disconnect();
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

      const usingSameCategory = rowCategoryId === colCategoryId;
      const rowComponents = (rowCategory?.components || []).filter(hasValues);
      const colComponents = (colCategory?.components || []).filter(hasValues);

      if (!activeRowCompId || !rowComponents.some((c) => c.id === activeRowCompId)) {
        activeRowCompId = firstSelectableComponentId(rowComponents);
      }

      if (
        !activeColCompId ||
        !colComponents.some((c) => c.id === activeColCompId) ||
        (usingSameCategory && activeColCompId === activeRowCompId)
      ) {
        activeColCompId = firstSelectableComponentId(
          colComponents,
          usingSameCategory ? activeRowCompId : undefined
        );
      }

      if (usingSameCategory && activeRowCompId === activeColCompId) {
        activeRowCompId = firstSelectableComponentId(
          rowComponents,
          activeColCompId
        );
      }

      const activeRowComp = rowComponents.find((c) => c.id === activeRowCompId);
      const activeColComp = colComponents.find((c) => c.id === activeColCompId);

      const rowValues: ComponentValue[] = activeRowComp?.values || [];
      const colValues: ComponentValue[] = activeColComp?.values || [];
      const hasActiveDrivers =
        Boolean(activeRowComp) && Boolean(activeColComp) && rowValues.length > 0 && colValues.length > 0;

      if (rowValues.length > 0) {
        activeCellRow = clamp(activeCellRow, 0, rowValues.length - 1);
      } else {
        activeCellRow = 0;
      }

      if (colValues.length > 0) {
        activeCellCol = clamp(activeCellCol, 0, colValues.length - 1);
      } else {
        activeCellCol = 0;
      }

      const onMatrixKeyDown = async (e: KeyboardEvent) => {
        if (!hasActiveDrivers) {
          return;
        }

        const { key, shiftKey } = e;

        if (shiftKey) {
          if (key === 'ArrowUp' || key === 'ArrowDown') {
            e.preventDefault();
            const direction: 1 | -1 = key === 'ArrowDown' ? 1 : -1;
            const nextRowCompId = cycleComponentId(
              rowComponents,
              activeRowCompId,
              direction,
              usingSameCategory ? activeColCompId : undefined
            );
            if (nextRowCompId) {
              activeRowCompId = nextRowCompId;
              activeCellRow = 0;
              activeCellCol = 0;
            }
            return;
          }

          if (key === 'ArrowLeft' || key === 'ArrowRight') {
            e.preventDefault();
            const direction: 1 | -1 = key === 'ArrowRight' ? 1 : -1;
            const nextColCompId = cycleComponentId(
              colComponents,
              activeColCompId,
              direction,
              usingSameCategory ? activeRowCompId : undefined
            );
            if (nextColCompId) {
              activeColCompId = nextColCompId;
              activeCellRow = 0;
              activeCellCol = 0;
            }
            return;
          }
        }

        if (key === 'ArrowUp') {
          e.preventDefault();
          activeCellRow = clamp(activeCellRow - 1, 0, rowValues.length - 1);
          return;
        }

        if (key === 'ArrowDown') {
          e.preventDefault();
          activeCellRow = clamp(activeCellRow + 1, 0, rowValues.length - 1);
          return;
        }

        if (key === 'ArrowLeft') {
          e.preventDefault();
          activeCellCol = clamp(activeCellCol - 1, 0, colValues.length - 1);
          return;
        }

        if (key === 'ArrowRight') {
          e.preventDefault();
          activeCellCol = clamp(activeCellCol + 1, 0, colValues.length - 1);
          return;
        }

        if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
          e.preventDefault();
          const rowValue = rowValues[activeCellRow];
          const colValue = colValues[activeCellCol];
          if (!rowValue || !colValue) {
            return;
          }
          cycleInconsistencyValue(inconsistencies, rowValue.id, colValue.id);
          await saveModel(attrs, model);
        }
      };

      return m('.inconsistencies-editor', { tabindex: 0, onkeydown: onMatrixKeyDown }, [
        m('.category-selectors.row', [
          // Row category selector
          m(Select, {
            checkedId: rowCategoryId,
            iconName: 'view_stream',
            className: 'col s12 m6',
            placeholder: t('i18n', 'pickOne'),
            label: t('INCONSISTENCIES', 'SELECT_ROW_CATEGORY'),
            options: categoriesWithComponents.map((c) => ({
              id: c.id,
              label: c.label,
            })),
            onchange: (ids) => {
              rowCategoryId = ids[0] as string;
              const nextRowCategory = categoriesWithComponents.find(
                (c) => c.id === rowCategoryId
              );
              const nextRowComponents = (nextRowCategory?.components || []).filter(
                hasValues
              );
              const nextColCategory = categoriesWithComponents.find(
                (c) => c.id === colCategoryId
              );
              const isSame = rowCategoryId === colCategoryId;
              activeRowCompId = firstSelectableComponentId(
                nextRowComponents,
                isSame ? activeColCompId : undefined
              );

              if (isSame && activeColCompId === activeRowCompId) {
                activeColCompId = firstSelectableComponentId(
                  (nextColCategory?.components || []).filter(hasValues),
                  activeRowCompId
                );
              }
              activeCellRow = 0;
              activeCellCol = 0;
            },
          }),

          // Column category selector
          m(Select, {
            checkedId: colCategoryId,
            iconName: 'view_column',
            className: 'col s12 m6',
            placeholder: t('i18n', 'pickOne'),
            label: t('INCONSISTENCIES', 'SELECT_COLUMN_CATEGORY'),
            options: categoriesWithComponents.map((c) => ({
              id: c.id,
              label: c.label,
            })),
            onchange: (ids) => {
              colCategoryId = ids[0] as string;
              const nextColCategory = categoriesWithComponents.find(
                (c) => c.id === colCategoryId
              );
              const nextColComponents = (nextColCategory?.components || []).filter(
                hasValues
              );
              const nextRowCategory = categoriesWithComponents.find(
                (c) => c.id === rowCategoryId
              );
              const isSame = rowCategoryId === colCategoryId;
              activeColCompId = firstSelectableComponentId(
                nextColComponents,
                isSame ? activeRowCompId : undefined
              );

              if (isSame && activeRowCompId === activeColCompId) {
                activeRowCompId = firstSelectableComponentId(
                  (nextRowCategory?.components || []).filter(hasValues),
                  activeColCompId
                );
              }
              activeCellRow = 0;
              activeCellCol = 0;
            },
          }),
        ]),

        rowCategory &&
          colCategory &&
          m('.kd-selector-outer', [
            m('.kd-left-col', [
              m('.kd-left-spacer', {
                style:
                  colHeaderHeight > 0
                    ? `height: ${colHeaderHeight}px;`
                    : undefined,
              }),
              m(
                '.row-kd-sidebar',
                rowComponents.map((rowComp) => {
                  const isDisabled =
                    usingSameCategory && rowComp.id === activeColCompId;
                  const isActive = activeRowCompId === rowComp.id;
                  return m(
                    'button.row-kd-item',
                    {
                      type: 'button',
                      className: [
                        isActive ? 'kd-active' : 'kd-inactive',
                        isDisabled ? 'kd-disabled' : '',
                      ].join(' '),
                      disabled: isDisabled,
                      onclick: () => {
                        if (isDisabled) return;
                        activeRowCompId = rowComp.id;
                        activeCellRow = 0;
                        activeCellCol = 0;
                      },
                      title: rowComp.label,
                    },
                    rowComp.label
                  );
                })
              ),
            ]),
            m('.kd-right-col', [
              m(
                '.col-kd-header',
                {
                  oncreate: ({ dom }: { dom: Element }) => {
                    syncColHeaderHeight(dom);
                    if (typeof ResizeObserver !== 'undefined') {
                      colHeaderResizeObserver?.disconnect();
                      colHeaderResizeObserver = new ResizeObserver((entries) => {
                        if (!entries.length) return;
                        const nextHeight = Math.ceil(entries[0].contentRect.height);
                        if (nextHeight > 0 && nextHeight !== colHeaderHeight) {
                          colHeaderHeight = nextHeight;
                          m.redraw();
                        }
                      });
                      colHeaderResizeObserver.observe(dom as HTMLElement);
                    }
                  },
                  onupdate: ({ dom }: { dom: Element }) => syncColHeaderHeight(dom),
                },
                colComponents.map((colComp) => {
                  const isDisabled =
                    usingSameCategory && colComp.id === activeRowCompId;
                  const isActive = activeColCompId === colComp.id;
                  return m(
                    'button.col-kd-item',
                    {
                      type: 'button',
                      className: [
                        isActive ? 'kd-active' : 'kd-inactive',
                        isDisabled ? 'kd-disabled' : '',
                      ].join(' '),
                      disabled: isDisabled,
                      onclick: () => {
                        if (isDisabled) return;
                        activeColCompId = colComp.id;
                        activeCellRow = 0;
                        activeCellCol = 0;
                      },
                      title: colComp.label,
                    },
                    m('span.kd-label', colComp.label)
                  );
                })
              ),
              hasActiveDrivers
                ? m('.editing-table-area', [
                    m('.inconsistency-matrix.card', [
                      m('table.matrix-table.highlight.matrix-table-themed', [
                        m('thead', [
                          m('tr', [
                            m('th.component-name.active-driver-header', {
                              rowspan: 2,
                            }, activeRowComp?.label),
                            m('th.col-driver-title', {
                              colspan: colValues.length,
                            }, activeColComp?.label),
                          ]),
                          m('tr', [
                            ...colValues.map((colVal) =>
                              m('th.value-header.active-driver-header', m('div', colVal.label))
                            ),
                          ]),
                        ]),
                        m(
                          'tbody',
                          rowValues.map((rowVal, rowValIdx) =>
                            m('tr', [
                              m('th.value-name', rowVal.label),
                              ...colValues.map((colVal, colValIdx) => {
                                const isFocused =
                                  rowValIdx === activeCellRow &&
                                  colValIdx === activeCellCol;
                                return m(
                                  'td.matrix-cell',
                                  {
                                    className: isFocused
                                      ? 'matrix-cell-focused'
                                      : '',
                                    'data-row': rowValIdx,
                                    'data-col': colValIdx,
                                    onclick: () => {
                                      activeCellRow = rowValIdx;
                                      activeCellCol = colValIdx;
                                    },
                                    ...focusedCellAttrs(isFocused),
                                  },
                                  m(InconsistencyCell, {
                                    rowId: rowVal.id,
                                    colId: colVal.id,
                                    inconsistencies,
                                    onactivate: () => {
                                      activeCellRow = rowValIdx;
                                      activeCellCol = colValIdx;
                                    },
                                    callback: async () => await saveModel(attrs, model),
                                    rowComponent: activeRowComp?.label || '',
                                    rowValue: rowVal.label,
                                    colComponent: activeColComp?.label || '',
                                    colValue: colVal.label,
                                  })
                                );
                              }),
                            ])
                          )
                        ),
                      ]),
                    ]),
                  ])
                : m(
                    '.editing-table-area.no-drivers-area',
                    m('p.flow-text', t('INCONSISTENCIES', 'NO_DRIVERS'))
                  ),
            ]),
          ]),

        m('.row', [
          m('.col.s12', m(KeyboardLegend)),
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
