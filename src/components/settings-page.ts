import m from 'mithril';
import {
  Category,
  Dashboards,
  DataModel,
  OsmTypes,
  PersonaImages,
  Scenario,
  emptyModel,
} from '../models';

const OsmOptions = OsmTypes.map(({ id, name }) => ({ id, label: name }));
import { MeiosisComponent, i18n, saveModel, setPage, t } from '../services';
import {
  ConfirmButton,
  FlatButton,
  ModalPanel,
  Select,
  Switch,
  Tabs,
  TextArea,
  uniqueId,
} from 'mithril-materialized';
import { FormAttributes, LayoutForm, UIForm } from 'mithril-ui-form';
import { ensureDefaultLLMConfig, InconsistenciesEditor, LLMSelector } from './ui';
import {
  markdownToMorphBox,
  morphBoxToMarkdown,
  KeyDriver,
} from '../utils/morp-box-to-markdown';
import {
  applyDecisionCategoryManual,
  syncNarrativeDecisions,
  getDecisionCategoryIds,
} from '../utils/decision';

export const SettingsPage: MeiosisComponent = () => {
  const generalForm = [
    { id: 'id', autogenerate: 'id' },
    { id: 'label', type: 'text', className: 'col s12', label: t('NAME') },
    { id: 'desc', type: 'textarea', label: t('DESCRIPTION') },
  ] as UIForm<Scenario>;
  const narrativeForm = [
    {
      id: 'template',
      type: 'template-with-llm',
      label: t('TEMPLATE', 'TITLE'),
      description: t('TEMPLATE', 'DESC')?.replace('XXX', '{1}'),
    },
    {
      id: 'personas',
      type: 'select',
      multiple: true,
      options: 'personas',
      label: t('SELECT_PERSONA'),
      description: t('SELECT_PERSONA_HELP'),
    },
  ] as UIForm<Scenario>;
  const mapForm = [
    {
      id: 'mapConfig',
      className: 'col s12',
      label: t('MAP_CONFIG'),
      type: [
        {
          id: 'lat',
          type: 'number',
          className: 'col s3',
          label: t('LATITUDE'),
        },
        {
          id: 'lon',
          type: 'number',
          className: 'col s3',
          label: t('LONGITUDE'),
        },
        {
          id: 'zoom',
          type: 'number',
          className: 'col s3',
          label: t('ZOOM_LEVEL'),
          value: '13',
        },
      ],
    },
    {
      id: 'mapUnits',
      type: 'select',
      className: 'col s12 m3',
      label: t('MAP_UNITS'),
      options: [
        { id: 'metric', label: t('METRIC') },
        { id: 'imperial', label: t('IMPERIAL') },
      ],
    },
    {
      id: 'osmAmenities',
      type: 'select',
      multiple: true,
      className: 'col s12 m9',
      label: t('OSM_AMENITIES'),
      options: 'osmtypes',
    },
  ] as UIForm<Scenario>;
  const structureForm = [
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
          className: 'col s6 m3 l3',
          label: t('IS_DECISION_CATEGORY'),
        },
        {
          type: 'md',
          className: 'col s12 grey-text',
          value: t('DECISION_CATEGORY_HINT'),
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
          options: [
            { id: 'no', label: t('NO') },
            { id: 'yes', label: t('YES') },
          ],
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
  ] as unknown as UIForm<Scenario>;
  const options: Array<{
    id: 'hideInconsistentValues' | 'includeMapSupport' | 'includeDecisionSupport';
    label: string;
    hint: string;
  }> = [
    { id: 'hideInconsistentValues', label: t('HIDE_INCONSISTENT'), hint: t('HIDE_INCONSISTENT_HINT') },
    { id: 'includeMapSupport', label: t('INCLUDE_MAP_SUPPORT'), hint: t('INCLUDE_MAP_SUPPORT_HINT') },
    { id: 'includeDecisionSupport', label: t('INCLUDE_DECISION_SUPPORT'), hint: t('INCLUDE_DECISION_SUPPORT_HINT') },
  ];
  let edit = false;
  let mdEditor = false;
  /** Decision categories at the last change, to detect newly ticked ones */
  let decisionCategoryIds: Set<string> | undefined;
  let scenarioId: string | undefined;

  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.SETTINGS),
    view: ({ attrs }) => {
      const { model } = attrs.state;
      const { personas = [] } = model;
      const { categories = [], components = [] } = model.scenario ?? {};
      if (!decisionCategoryIds || scenarioId !== model.scenario?.id) {
        scenarioId = model.scenario?.id;
        decisionCategoryIds = getDecisionCategoryIds(
          model.scenario ?? { categories: [] },
        );
      }
      const onFormChange = async () => {
        applyDecisionCategoryManual(model.scenario, decisionCategoryIds ?? new Set());
        // Adds the decision-reflection prompt when decision support was just turned on
        if (model.scenario.includeDecisionSupport) {
          ensureDefaultLLMConfig(model.scenario, model.scenario.categories || []);
        }
        // Selections of new decision factors move to courses of action,
        // those of former decision factors back to the situation
        (model.scenario.narratives || []).forEach((n) => syncNarrativeDecisions(model.scenario, n));
        decisionCategoryIds = getDecisionCategoryIds(model.scenario);
        // The narrative being edited is a separate copy: sync it too
        const { curNarrative } = attrs.getState();
        if (curNarrative && syncNarrativeDecisions(model.scenario, curNarrative)) {
          attrs.update({ curNarrative: () => curNarrative });
        }
        await saveModel(attrs, model);
      };
      const context = [
        {
          personas,
          osmtypes: OsmOptions,
          categories,
          components,
          language: model.scenario.language || i18n.currentLocale,
        },
      ] as any;
      const sectionForm = (form: UIForm<Scenario>) =>
        m(
          '.row',
          m(LayoutForm, {
            obj: model.scenario,
            form,
            i18n: i18n.i18n,
            context,
            onchange: onFormChange,
          } as FormAttributes<Scenario>),
        );
      const section = (title: string, content: m.Children) =>
        m('.settings-section', [m('h6.settings-section-title', title), content]);
      // console.log(model.scenario?.personas);
      return [
        m('.settings-page.row', { key: model.version }, [
          m(Tabs, {
            tabs: [
              {
                title: t('DEFINE_BOX', 'TITLE'),
                vnode: m('.model-settings', [
                  m(
                    '.row',
                    m(ConfirmButton, {
                      className: 'right',
                      iconName: 'delete',
                      label: t('DELETE'),
                      onclick: () => {
                        saveModel(attrs, emptyModel(t('NEW_BOX')));
                      },
                    }),
                    m(FlatButton, {
                      iconName: 'auto_fix_high',
                      className: 'right',
                      label: t('ADV_EDIT'),
                      onclick: () => (mdEditor = true),
                    }),
                  ),
                  section(t('SETTINGS_GENERAL'), sectionForm(generalForm)),
                  section(
                    t('SETTINGS_OPTIONS'),
                    m(
                      '.row.settings-options',
                      options.map(({ id, label, hint }) =>
                        m('.col.s12.m4.settings-option', [
                          m(Switch, {
                            className: '',
                            label,
                            left: t('NO'),
                            right: t('YES'),
                            checked: !!model.scenario[id],
                            onchange: async (checked) => {
                              model.scenario[id] = checked;
                              await onFormChange();
                            },
                          }),
                          m('span.helper-text', hint),
                        ]),
                      ),
                    ),
                  ),
                  section(t('SETTINGS_NARRATIVE'), sectionForm(narrativeForm)),
                  model.scenario.includeMapSupport &&
                    section(t('SETTINGS_MAP'), sectionForm(mapForm)),
                  section(t('SETTINGS_STRUCTURE'), sectionForm(structureForm)),
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
                    }),
                  ),
                  edit
                    ? m(
                        '.row',
                        m(LayoutForm, {
                          obj: model,
                          i18n: i18n.i18n,
                          context: [
                            {
                              images: PersonaImages.reduce(
                                (acc, cur) => {
                                  acc[cur.id] = cur.img;
                                  return acc;
                                },
                                {} as { [key: string]: string },
                              ),
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
                        } as FormAttributes<DataModel>),
                      )
                    : m(
                        '.row.persona-cards',
                        personas?.map((p) =>
                          m(
                            '.col.s12.m6.l4',
                            m('.card.persona-card', [
                              m('.card-image', [
                                m('img', {
                                  src: PersonaImages.find((i) => i.id === p.url)
                                    ?.img,
                                  alt: p.label,
                                }),
                                m('span.card-title', p.label),
                              ]),
                              m('.card-content', m('p', p.desc)),
                            ]),
                          ),
                        ),
                      ),
                ]),
              },
            ],
          }),
          // m(ModalPanel, {
          //   id: 'deleteModel',
          //   title: t('DELETE_ITEM', 'title', { item: t('MODEL') }),
          //   description: t('DELETE_ITEM', 'description', {
          //     item: t('MODEL'),
          //   }),
          //   isOpen: deleteModel,
          //   onToggle: (open) => (deleteModel = open),
          //   buttons: [
          //     {
          //       label: t('CANCEL'),
          //       onclick: () => (deleteModel = false),
          //     },
          //     {
          //       label: t('OK'),
          //       onclick: () => {
          //         saveModel(attrs, emptyModel());
          //       },
          //     },
          //   ],
          // }),
          m(ModalPanel, {
            id: 'mdEditor',
            title: t('ADV_EDIT'),
            isOpen: mdEditor,
            onToggle: (open) => (mdEditor = open),
            closeOnButtonClick: true,
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
      // console.log(curCategory);
      if (!initialMd && curCategory) {
        initialMd = md = morphBoxToMarkdown(
          curCategory,
          model.scenario.components,
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
                  curCategory.componentIds,
                );
                curCategory.componentIds = keyDrivers.map((d) => d.id);
                curCategory.componentIds.forEach((id) =>
                  removableComponentIds.delete(id),
                );
                model.scenario.categories = categories.map((c) =>
                  c.id === curCategory?.id ? curCategory : c,
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
