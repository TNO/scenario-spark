import m, { FactoryComponent } from 'mithril';
import { Icon, Select } from 'mithril-materialized';
import { ID, Inconsistencies } from '../../models/data-model';
import { MeiosisComponent, saveModel, t } from '../../services';

export const InconsistencyCheckbox: FactoryComponent<{
  inconsistencies: Inconsistencies;
  rowId: ID;
  colId: ID;
  callback: () => Promise<void>;
}> = () => {
  return {
    view: ({ attrs: { rowId, colId, inconsistencies, callback } }) => {
      const row = inconsistencies[rowId];
      const v = typeof row !== 'undefined' ? row[colId] : undefined;
      const iconName =
        typeof v === 'undefined'
          ? 'check_circle_outline'
          : v
          ? 'radio_button_unchecked'
          : 'blur_circular';
      return m(Icon, {
        className: 'clickable',
        iconName,
        onclick: async () => {
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

export const InconsistenciesEditor: MeiosisComponent = () => {
  let rowId: ID;
  let colId: ID;

  return {
    view: ({ attrs }) => {
      const { model } = attrs.state;
      const { inconsistencies } = model.scenario;
      const comps = model.scenario.components.filter((c) => c.id && c.label);
      const rowComp = rowId && comps.filter((c) => c.id === rowId).shift();
      const colComp = colId && comps.filter((c) => c.id === colId).shift();
      const rValues = rowComp && rowComp.values;
      const cValues = colComp && colComp.values;

      return m(
        '.inconsistencies-editor',
        m(
          '.inconsistencies-settings.row',
          comps.length > 0 && [
            m(Select, {
              checkedId: rowId,
              iconName: 'view_stream',
              className: 'col s6 m4',
              placeholder: t('i18n', 'pickOne'),
              label: t('INCONSISTENCIES', 'SELECT_ROW'),
              options: comps,
              onchange: (ids) => (rowId = ids[0] as string),
            }),
            m(Select, {
              checkedId: colId,
              iconName: 'view_week',
              className: 'col s6 m4',
              placeholder: t('i18n', 'pickOne'),
              label: t('INCONSISTENCIES', 'SELECT_COL'),
              options: comps,
              onchange: (ids) => (colId = ids[0] as string),
            }),
            m(
              '#legend.col.s12.m4',
              m('.card', [
                m('ul', [
                  m(
                    'li',
                    m(Icon, {
                      style: 'vertical-align: bottom',
                      iconName: 'check_circle_outline',
                    }),
                    t('COMBINATIONS', 'POSSIBLE')
                  ),
                  m(
                    'li',
                    m(Icon, {
                      style: 'vertical-align: bottom',
                      iconName: 'radio_button_unchecked',
                    }),
                    t('COMBINATIONS', 'IMPOSSIBLE')
                  ),
                  m(
                    'li',
                    m(Icon, {
                      style: 'vertical-align: bottom',
                      iconName: 'blur_circular',
                    }),
                    t('COMBINATIONS', 'IMPROBABLE')
                  ),
                ]),
              ])
            ),
            rowComp &&
              colComp &&
              rValues &&
              cValues &&
              m(
                '.col.s12',
                m('.row', [
                  m(
                    '.col.s12',
                    m(
                      'table.responsive-table.highlight',
                      {
                        style: 'display: block;overflow-x: auto',
                      },
                      [
                        m(
                          'thead',
                          m('tr', [
                            m(
                              'th',
                              {
                                style: { fontSize: '1.7rem' },
                              },
                              m('sub', rowComp.label),
                              '\\',
                              m('sup', colComp.label)
                            ),
                            ...rValues.map((v) => m('th', v.label)),
                          ])
                        ),
                        m(
                          'tbody',
                          cValues.map((r) =>
                            m('tr', [
                              m('th', r.label),
                              ...rValues.map((c) =>
                                m(
                                  'td',
                                  m(InconsistencyCheckbox, {
                                    rowId: r.id,
                                    colId: c.id,
                                    inconsistencies,
                                    callback: async () =>
                                      await saveModel(attrs, model),
                                  })
                                  // inconsistencies[key(r.id, c.id)] || 'NONE'
                                )
                              ),
                            ])
                          )
                        ),
                      ]
                    )
                  ),
                ])
              ),
          ]
        )
      );
    },
  };
};
