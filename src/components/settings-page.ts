import m, { FactoryComponent } from 'mithril';
import {
  Dashboards,
  DataModel,
  ID,
  Inconsistencies,
  PersonaImages,
  Scenario,
  emptyModel,
} from '../models';
import { MeiosisComponent, i18n, saveModel, setPage, t } from '../services';
import {
  FlatButton,
  Icon,
  ModalPanel,
  Select,
  Tabs,
} from 'mithril-materialized';
import { FormAttributes, LayoutForm, UIForm } from 'mithril-ui-form';

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

export const SettingsPage: MeiosisComponent = () => {
  const form = [
    { id: 'id', autogenerate: 'id' },
    { id: 'label', type: 'text', className: 'col s12 m6', label: t('NAME') },
    {
      id: 'hideInconsistentValues',
      type: 'checkbox',
      className: 'col s6 m3 mt25',
      label: t('HIDE_INCONSISTENT'),
    },
    {
      id: 'includeDecisionSupport',
      type: 'checkbox',
      className: 'col s6 m3 mt25',
      label: t('INCLUDE_DECISION_SUPPORT'),
    },
    { id: 'desc', type: 'textarea', label: t('DESCRIPTION') },
    {
      id: 'template',
      type: 'textarea',
      label: t('TEMPLATE', 'TITLE'),
      placeholder: t('TEMPLATE', 'DESC'),
    },
    {
      id: 'categories',
      label: t('CATEGORIES'),
      type: [
        { id: 'id', autogenerate: 'id' },
        {
          id: 'label',
          className: 'col s4 m3 l2',
          type: 'text',
          label: t('NAME'),
        },
        {
          id: 'desc',
          className: 'col s4 m6 l7',
          type: 'text',
          label: t('DESCRIPTION'),
        },
        {
          id: 'decisionSupport',
          type: 'checkbox',
          className: 'col s6 m3 l3 mt25',
          label: t('IS_DECISION_CATEGORY'),
        },
        {
          id: 'componentIds',
          type: 'select',
          multiple: true,
          label: t('DIMENSION_SELECTED'),
          options: 'components',
        },
      ],
      repeat: true,
      pageSize: 1,
      max: 2,
    },
    {
      id: 'components',
      type: [
        { id: 'id', autogenerate: 'id' },
        {
          id: 'order',
          type: 'number',
          className: 'col s3 m2',
          label: t('ORDER'),
        },
        {
          id: 'manual',
          type: 'switch',
          className: 'switch col s3 m2',
          label: t('MANUAL'),
        },
        {
          id: 'label',
          type: 'text',
          className: 'col s6 m8',
          label: t('NAME'),
        },
        // {
        //   id: 'context',
        //   type: 'select',
        //   multiple: true,
        //   className: 'col s12 m5',
        //   label: t('CONTEXT'),
        //   options: contextTypeOptions(t),
        // },
        {
          id: 'desc',
          type: 'text',
          className: 'col s12',
          label: t('DESCRIPTION'),
        },
      ],
      repeat: true,
      pageSize: 1,
      sortProperty: 'order',
      label: t('DIMENSIONS'),
    },
    {
      id: 'thresholdColors',
      label: t('THRESHOLDS'),
      repeat: true,
      sortProperty: 'threshold',
      pageSize: 1,
      type: [
        {
          id: 'threshold',
          label: t('THRESHOLD'),
          type: 'number',
          min: 0,
          className: 'col s6',
        },
        {
          id: 'color',
          label: t('COLOR'),
          type: 'color',
          className: 'col s6',
        },
      ],
    },
  ] as UIForm<Scenario>;
  let rowId: ID;
  let colId: ID;
  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.SETTINGS),
    view: ({ attrs }) => {
      const { model } = attrs.state;
      const { inconsistencies } = model.scenario;
      const comps = model.scenario.components.filter((c) => c.id && c.label);
      const rowComp = rowId && comps.filter((c) => c.id === rowId).shift();
      const colComp = colId && comps.filter((c) => c.id === colId).shift();
      const rValues = rowComp && rowComp.values;
      const cValues = colComp && colComp.values;
      return [
        m('.settings-page.row', [
          m(Tabs, {
            tabs: [
              {
                title: t('MODEL'),
                vnode: m('.model-settings', [
                  m(
                    '.row',
                    m(FlatButton, {
                      className: 'right',
                      iconName: 'delete',
                      label: t('DELETE'),
                      modalId: 'deleteModel',
                    })
                  ),
                  m(
                    '.row',
                    m(LayoutForm, {
                      obj: model.scenario,
                      form,
                      i18n: i18n.i18n,
                      onchange: async () => {
                        await saveModel(attrs, model);
                      },
                    } as FormAttributes<Scenario>)
                  ),
                ]),
              },
              {
                title: t('INCONSISTENCIES', 'title'),
                vnode: m(
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
                                      `${rowComp.label} \\ ${colComp.label}`
                                    ),
                                    ...cValues.map((v) => m('th', v.label)),
                                  ])
                                ),
                                m(
                                  'tbody',
                                  rValues.map((r) =>
                                    m('tr', [
                                      m('th', r.label),
                                      ...cValues.map((c) =>
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
                ),
              },
              {
                title: t('PERSONA', 2),
                vnode: m(
                  '.row',
                  m(LayoutForm, {
                    obj: model,
                    i18n: i18n.i18n,
                    form: [
                      {
                        id: 'personas',
                        label: t('PERSONA', 2),
                        repeat: true,
                        pageSize: 100,
                        type: [
                          { id: 'id', autogenerate: 'id' },
                          {
                            id: 'label',
                            type: 'text',
                            className: 'col s12 m6',
                            label: t('NAME'),
                          },
                          {
                            id: 'url',
                            type: 'select',
                            className: 'col s12 m6',
                            options: PersonaImages,
                            label: t('IMAGE'),
                          },
                          {
                            id: 'desc',
                            type: 'textarea',
                            className: 'col s12',
                            label: t('DESCRIPTION'),
                          },
                          // {
                          //   type: 'md',
                          //   readonly: true,
                          //   value: `<img src="{{url}}"/>`,
                          // },
                        ],
                      },
                    ] as UIForm<any>,
                    onchange: async () => {
                      await saveModel(attrs, model);
                    },
                  } as FormAttributes<DataModel>)
                ),
              },
            ],
          }),
          m(ModalPanel, {
            id: 'deleteModel',
            title: t('DELETE_ITEM', 'title', { item: t('MODEL') }),
            description: t('DELETE_ITEM', 'description', { item: t('MODEL') }),
            // options: { opacity: 0.7 },
            buttons: [
              {
                label: t('CANCEL'),
              },
              {
                label: t('OK'),
                onclick: () => {
                  saveModel(attrs, emptyModel());
                },
              },
            ],
          }),
        ]),
      ];
    },
  };
};
