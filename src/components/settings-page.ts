import m from 'mithril';
import {
  Category,
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
  Select,
  Tabs,
  TextArea,
  uniqueId,
} from 'mithril-materialized';
import { FormAttributes, LayoutForm, UIForm } from 'mithril-ui-form';
import { InconsistenciesEditor, LLMSelector } from './ui';
import {
  markdownToMorphBox,
  morphBoxToMarkdown,
  KeyDriver,
} from '../utils/morp-box-to-markdown';

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
      description: t('TEMPLATE', 'DESC').replace('XXX', '{1}'),
    },
    {
      id: 'personas',
      type: 'select',
      show: ['includeDecisionSupport=true'],
      multiple: true,
      options: 'personas',
      label: t('SELECT_PERSONA'),
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
          className: 'col s4 m9 l6',
          type: 'text',
          label: t('DESCRIPTION'),
        },
        {
          id: 'decisionSupport',
          type: 'checkbox',
          className: 'col s6 m3 l3 mt25',
          label: t('IS_DECISION_CATEGORY'),
          // show: ['includeDecisionSupport=true'],
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
          className: 'col s3 m2',
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
  let deleteModel = false;
  let mdEditor = false;

  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.SETTINGS),
    view: ({ attrs }) => {
      const { model } = attrs.state;
      const { personas = [] } = model;
      // console.log(model.scenario?.personas);
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
                      onclick: () => (deleteModel = true),
                    }),
                    m(FlatButton, {
                      iconName: 'auto_fix_high',
                      className: 'right',
                      label: t('ADV_EDIT'),
                      onclick: () => (mdEditor = true),
                    })
                  ),
                  m(
                    '.row',
                    m(LayoutForm, {
                      obj: model.scenario,
                      form,
                      i18n: i18n.i18n,
                      context: [{ personas }] as any,
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
                vnode: m('.llm-settings', m(LLMSelector, { ...attrs })),
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
                            } as any,
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
          deleteModel &&
            m(ModalPanel, {
              id: 'deleteModel',
              title: t('DELETE_ITEM', 'title', { item: t('MODEL') }),
              description: t('DELETE_ITEM', 'description', {
                item: t('MODEL'),
              }),
              isOpen: true,
              onClose: () => (deleteModel = false),
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
          mdEditor &&
            m(ModalPanel, {
              id: 'mdEditor',
              title: t('ADV_EDIT'),
              isOpen: true,
              onClose: () => (mdEditor = false),
              description: m(MorphBoxEditor, attrs),
              bottomSheet: true,
              fixedFooter: true,
              buttons: [
                {
                  label: t('CANCEL'),
                },
              ],
            }),
        ]),
      ];
    },
  };
};

export const MorphBoxEditor: MeiosisComponent = () => {
  let curCategory: Category | undefined;
  let initialMd: string | undefined;
  let md: string | undefined;

  return {
    oninit: () => {
      initialMd = undefined;
      md = undefined;
    },
    view: ({ attrs }) => {
      const {
        state: { model },
      } = attrs;
      if (!model.scenario) return;
      const { categories = [], components = [] } = model.scenario;
      if (!curCategory && categories.length > 0) {
        curCategory = categories[0];
      }
      console.log(curCategory);
      if (!initialMd && curCategory) {
        initialMd = md = morphBoxToMarkdown(
          curCategory,
          model.scenario.components
        );
      }
      return m('.md-editor.row', [
        m(Select<string>, {
          label: t('CATEGORIES'),
          className: 'col s6',
          placeholder: t('i18n', 'pickOne'),
          checkedId: curCategory?.id,
          options: categories,
          onchange: (v) => {
            initialMd = undefined;
            curCategory = categories.find((c) => c.id === v[0]);
            m.redraw();
          },
        }),
        m(FlatButton, {
          iconName: 'add',
          className: 'col s1',
          onclick: () => {
            const category: Category = {
              id: uniqueId(),
              label: t('NEW_BOX'),
              componentIds: [],
            };
            curCategory = category;
            if (model.scenario.categories) {
              model.scenario.categories.push(category);
            } else {
              model.scenario.categories = [category];
            }
            initialMd = undefined;
            saveModel(attrs, model);
          },
        }),
        m(FlatButton, {
          label: t('SAVE'),
          className: 'col offset-s2 s3',
          iconName: 'save',
          disabled: md === initialMd,
          onclick: () => {
            if (md) {
              const { label, desc, keyDrivers = [] } = markdownToMorphBox(md);
              if (curCategory) {
                if (label) curCategory.label = label;
                if (desc) curCategory.desc = desc;
                const removableComponentIds = new Set<string>(
                  curCategory.componentIds
                );
                curCategory.componentIds = keyDrivers.map((d) => d.id);
                curCategory.componentIds.forEach((id) =>
                  removableComponentIds.delete(id)
                );
                model.scenario.categories = categories.map((c) =>
                  c.id === curCategory?.id ? curCategory : c
                );
                const lookup = keyDrivers.reduce((acc, cur) => {
                  acc.set(cur.id, cur);
                  return acc;
                }, new Map<string, KeyDriver>());
                model.scenario.components = components
                  .filter((c) => !removableComponentIds.has(c.id))
                  .map((c) => {
                    const found = lookup.get(c.id);
                    if (!found) {
                      return c;
                    }
                    c.label = found.label;
                    c.desc = found.desc;
                    c.values = found.values;
                    lookup.delete(c.id);
                    return found;
                  });
                keyDrivers
                  .filter((d) => lookup.has(d.id))
                  .forEach((d) => model.scenario.components.push(d));
              }
              saveModel(attrs, model);
            }
          },
        }),
        m(TextArea, {
          value: md,
          disabled: !curCategory,
          oninput: (v) => {
            md = v;
          },
        }),
      ]);
    },
  };
};
