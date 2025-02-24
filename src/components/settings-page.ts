import m from 'mithril';
import {
  Dashboards,
  DataModel,
  PersonaImages,
  Scenario,
  emptyModel,
} from '../models';
import { MeiosisComponent, i18n, saveModel, setPage, t } from '../services';
import {
  FlatButton,
  ModalPanel,
  Tabs,
} from 'mithril-materialized';
import { FormAttributes, LayoutForm, UIForm } from 'mithril-ui-form';
import { InconsistenciesEditor, LLMSelector } from './ui';

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
          className: 'col s4 m3 l3',
          type: 'text',
          label: t('NAME'),
        },
        {
          id: 'desc',
          className: 'col s4 m6 l3',
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
          id: 'includeLLM',
          type: 'checkbox',
          className: 'col s6 m3 l3 mt25',
          label: t('INCLUDE_LLM'),
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
      max: 4,
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
  let edit = false;

  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.SETTINGS),
    view: ({ attrs }) => {
      const { model } = attrs.state;
      const { personas = [] } = model;
      return [
        m('.settings-page.row', { key: model.version }, [
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
                vnode: m(InconsistenciesEditor, { ...attrs }),
              },
              {
                title: 'LLM',
                vnode: m('.llm-settings', [m(LLMSelector, { ...attrs })]),
              },
              {
                title: t('PERSONA', 2),
                vnode: m('.persona-settings', [
                  m(
                    '.row',
                    m(FlatButton, {
                      label: edit ? t('SAVE') : t('EDIT'),
                      iconName: edit ? 'save' : 'edit',
                      className: 'right',
                      onclick: () => (edit = !edit),
                    })
                  ),
                  edit
                    ? m(
                        '.row',
                        m(LayoutForm, {
                          obj: model,
                          i18n: i18n.i18n,
                          context: [
                            {
                              images: PersonaImages.reduce((acc, cur) => {
                                acc[cur.id] = cur.img;
                                return acc;
                              }, {} as { [key: string]: string }),
                            },
                          ],
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
                                //   value: `![Image]({{imageUrl]}})`,
                                // },
                              ],
                            },
                          ] as UIForm<any>,
                          onchange: async () => {
                            await saveModel(attrs, model);
                          },
                        } as FormAttributes<DataModel>)
                      )
                    : m(
                        '.row',
                        personas.map((p) =>
                          m(
                            '.col.s12.m6.l4',
                            m('.card large', [
                              m('.card-image', [
                                m('img', {
                                  src: PersonaImages.find((i) => i.id === p.url)
                                    ?.img,
                                  style: 'width: 100%',
                                }),
                                m('.span.card-title', p.label),
                              ]),
                              m('.card-content', m('p', p.desc)),
                            ])
                          )
                        )
                      ),
                ]),
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
