import m from 'mithril';
import {
  Button,
  FlatButton,
  ConfirmButton,
  Icon,
  ModalPanel,
  RadioButtons,
  Select,
  Tabs,
  TextInput,
  toast,
  uniqueId,
} from 'mithril-materialized';
import background from '../assets/hero.webp';
import DutchFlag from '../assets/flag-nl.png';
import EnglishFlag from '../assets/flag-en.png';
import FrenchFlag from '../assets/flag-fr.png';
import GermanFlag from '../assets/flag-de.png';
import SpanishFlag from '../assets/flag-es.png';
import PolishFlag from '../assets/flag-pl.png';
import {
  changePage,
  MeiosisComponent,
  routingSvc,
  saveModel,
  selectScenarioFromCollection,
  setLanguage,
  setPage,
  t,
} from '../services';
import {
  Dashboards,
  DataModel,
  Narrative,
  Scenario,
  ScenarioComponent,
  defaultModels,
  newScenario,
  thresholdColors,
} from '../models';
import { addStarterKitToModel, createStarterKitNl } from '../models/starter-kit-nl';
import {
  SAVED,
  capitalize,
  convertFromOld,
  modelToSaveName,
  uploadFile,
} from '../utils';
import { NewScenarioWizard } from './new-scenario-wizard';
import { LLMScenarioWizard } from './llm-scenario-wizard';
import { parseImportedModel } from '../utils/import-model';
import { jsonFilename } from '../utils/json-filename';

export const TableView: MeiosisComponent<{
  narratives: Narrative[];
  components: ScenarioComponent[];
}> = () => {
  return {
    view: ({ attrs: { components, narratives = [], ...restAttrs } }) => {
      const lookup = components.reduce((acc, cur) => {
        cur.values &&
          cur.values.forEach((v) => {
            acc[v.id] = v.label;
          });
        return acc;
      }, {} as Record<string, string>);

      return m(
        '.table-container',
        m(
          '.table',
          m('table.responsive-table.highlight', [
            m(
              'thead',
              m(
                'tr',
                m('th', { style: 'text-align: right' }, t('NAME')),
                components.map((c) => m('th', c.label))
              )
            ),
            m(
              'tbody',
              narratives.map((n) =>
                m(
                  'tr',
                  m(
                    'th.bold.truncate',
                    { style: 'text-align: left' },
                    m(
                      'a',
                      {
                        href: routingSvc.href(Dashboards.SHOW_SCENARIO),
                        title: n.label,
                        onclick: () => {
                          restAttrs.update({
                            curNarrative: () => n,
                          });
                        },
                      },
                      capitalize(n.label)
                    )
                  ),
                  components.map((c) => {
                    const compVal =
                      n.components[c.id] &&
                      n.components[c.id].length > 0 &&
                      n.components[c.id]
                        .map(
                          (id) =>
                            lookup[id] ||
                            `<span class="red-text">Missing component ID: ${id}</span>`
                        )
                        .join(', ');
                    return compVal
                      ? m(
                          'td.truncate',
                          {
                            title: compVal,
                          },
                          m.trust(compVal)
                        )
                      : n[c.id as 'risk' | 'probability' | 'impact']
                      ? m(
                          'td',
                          lookup[n[c.id as 'risk' | 'probability' | 'impact']!]
                        )
                      : m(
                          'td.center-align.missing',
                          m(Icon, { iconName: 'clear', className: 'red-text' })
                        );
                  })
                )
              )
            ),
          ])
        )
      );
    },
  };
};

export const HomePage: MeiosisComponent = () => {
  const readerAvailable =
    window.File && window.FileReader && window.FileList && window.Blob;
  let selectedId = 0;
  let clearAllModal = false;
  let newScenarioWizardOpen = false;
  let llmScenarioWizardOpen = false;
  let narrativeFilter = '';
  let importConflictModal = false;
  let pendingScenario: Scenario | null = null;
  let confirmCollectionImport = false;
  let pendingCollection: DataModel | null = null;
  let downloadScenarioModalOpen = false;
  let downloadFilename = '';

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.HOME);
    },
    view: ({ attrs }) => {
      const isCleared = false;
      const { model, language = 'nl' } = attrs.state;
      const {
        scenarios = [],
        scenario: { id, label, narratives = [], components, categories },
      } = model;

      const filteredNarratives = narratives
        .filter((n) => n.included)
        .filter((n) => {
          if (!narrativeFilter.trim()) return true;
          const term = narrativeFilter.toLowerCase();
          return (n.label || '').toLowerCase().includes(term);
        })
        .sort((a, b) => (a.label || '').localeCompare(b.label));

      return [
        m('div', { style: 'position: relative;' }, [
          m(
            '.hero-section',
            m('.hero-container', [
              m(
                '.hero-image-wrapper',
                m(
                  'img.hero-image[alt=ScenarioSpark - A scenario generating tool combining morphological analysis with LLM technology]',
                  {
                    src: background,
                  }
                )
              ),
              m(
                '.hero-actions',
                m('.language-switcher', [
                  m(
                    '.language-option',
                    {
                      className: language === 'nl' ? 'selected' : undefined,
                      onclick: () => setLanguage(attrs, 'nl'),
                    },
                    [
                      m('img', {
                        src: DutchFlag,
                        alt: 'Nederlands',
                        title: 'Nederlands',
                      }),
                      m('span', 'Nederlands'),
                    ]
                  ),
                  m(
                    '.language-option',
                    {
                      className: language === 'en' ? 'selected' : undefined,
                      onclick: () => setLanguage(attrs, 'en'),
                    },
                    [
                      m('img', {
                        src: EnglishFlag,
                        alt: 'English',
                        title: 'English',
                      }),
                      m('span', 'English'),
                    ]
                  ),
                  m(
                    '.language-option',
                    {
                      className: language === 'fr' ? 'selected' : undefined,
                      onclick: () => setLanguage(attrs, 'fr'),
                    },
                    [
                      m('img', {
                        src: FrenchFlag,
                        alt: 'Français',
                        title: 'Français',
                      }),
                      m('span', 'Français'),
                    ]
                  ),
                  m(
                    '.language-option',
                    {
                      className: language === 'de' ? 'selected' : undefined,
                      onclick: () => setLanguage(attrs, 'de'),
                    },
                    [
                      m('img', {
                        src: GermanFlag,
                        alt: 'Deutsch',
                        title: 'Deutsch',
                      }),
                      m('span', 'Deutsch'),
                    ]
                  ),
                  m(
                    '.language-option',
                    {
                      className: language === 'es' ? 'selected' : undefined,
                      onclick: () => setLanguage(attrs, 'es'),
                    },
                    [
                      m('img', {
                        src: SpanishFlag,
                        alt: 'Español',
                        title: 'Español',
                      }),
                      m('span', 'Español'),
                    ]
                  ),
                  m(
                    '.language-option',
                    {
                      className: language === 'pl' ? 'selected' : undefined,
                      onclick: () => setLanguage(attrs, 'pl'),
                    },
                    [
                      m('img', {
                        src: PolishFlag,
                        alt: 'Polski',
                        title: 'Polski',
                      }),
                      m('span', 'Polski'),
                    ]
                  ),
                ])
              ),
            ])
          ),
          filteredNarratives.length > 0 &&
            categories.length > 0 && [
              m('.row', m('.col.s12', [
                m('h4', t('SAVED_NARRATIVES')),
                m(TextInput, {
                  id: 'narrative-filter',
                  label: t('FILTER_NARRATIVES'),
                  defaultValue: narrativeFilter,
                  placeholder: t('FILTER_NARRATIVES_PLACEHOLDER'),
                  onchange: (value) => {
                    narrativeFilter = value;
                    m.redraw();
                  },
                }),
              ])),
              categories.length > 1
                ? m(Tabs, {
                    tabs: categories.map((c) => ({
                      title: c.label,
                      vnode: m(TableView, {
                        ...attrs,
                        narratives: filteredNarratives,
                        components: components.filter(
                          (comp) =>
                            c.componentIds && c.componentIds.includes(comp.id)
                        ),
                      }),
                    })),
                  })
                : m(
                    '.narratives',
                    m(TableView, {
                      ...attrs,
                      narratives: filteredNarratives,
                      components: components.filter(
                        (comp) =>
                          categories[0].componentIds &&
                          categories[0].componentIds.includes(comp.id)
                      ),
                    })
                  ),
            ],
          // filteredNarratives.length === 0 &&

          m(
            '.row',
            m(
              '.col.s12.m8.l6.offset-m2.offset-l3',
              m(
                '.flex-row',
                m(Select, {
                  key: id,
                  iconName: 'cases',
                  className: 'flex-grow',
                  label: t('SELECT_SCENARIO'),
                  checkedId: id,
                  options: [{ id, label }, ...scenarios],
                  onchange: async (id) => {
                    await selectScenarioFromCollection(attrs, id[0] as string);
                  },
                }),
                m(
                  '.icon-buttons',
                  {
                    key: 'icons',
                  },
                  m(FlatButton, {
                    className: 'icon-button',
                    iconName: 'add',
                    title: t('NEW_SCENARIO'),
                    onclick: () => {
                      newScenarioWizardOpen = true;
                    },
                  }),
                  m(FlatButton, {
                    className: 'icon-button',
                    iconName: 'auto_fix_high',
                    title: t('LLM_WIZARD_TITLE'),
                    onclick: () => {
                      llmScenarioWizardOpen = true;
                    },
                  }),
                  m(FlatButton, {
                    className: 'icon-button',
                    iconName: 'download',
                    title: t('DOWNLOAD', 'MODEL'),
                    onclick: () => {
                      const version =
                        typeof model.version === 'undefined'
                          ? 1
                          : model.version + 1;
                      downloadFilename = modelToSaveName(
                        { ...model, version },
                        undefined,
                        false
                      );
                      downloadScenarioModalOpen = true;
                    },
                  }),
                    m(ConfirmButton, {
                      className: 'icon-button',
                      iconName: 'delete',
                      title: t('DELETE'),
                      onclick: async () => {
                        model.scenario =
                          model.scenarios && model.scenarios.length > 0
                            ? model.scenarios[0]
                            : newScenario();
                        model.scenarios = model.scenarios.filter(
                          (s) => s.id !== model.scenario.id
                        );
                        await saveModel(attrs, model, true);
                      },
                    })
                )
              )
            )
          ),
          m('.buttons.center', { style: 'margin: 10px auto;' }, [
            m(Button, {
              iconName: 'clear',
              disabled: isCleared,
              className: 'btn-large',
              label: t('NEW_MODEL', 'btn'),
              onclick: () => (clearAllModal = true),
            }),
            m(Button, {
              iconName: 'playlist_add',
              className: 'btn-large',
              label: t('ADD_STARTER_KIT'),
              title: t('ADD_STARTER_KIT_HINT'),
              onclick: async () => {
                const result = addStarterKitToModel(
                  model,
                  createStarterKitNl(thresholdColors)
                );
                if (result.added) await saveModel(attrs, result.model);
                toast({
                  html: result.added
                    ? t('STARTER_KIT_ADDED', { count: result.added })
                    : t('STARTER_KIT_ALREADY_PRESENT'),
                });
              },
            }),
            m('a#downloadAnchorElem', { style: 'display:none' }),
            m(Button, {
              iconName: 'download',
              disabled: isCleared,
              className: 'btn-large',
              label: t('DOWNLOAD', 'COLLECTION'),
              onclick: () => {
                const dlAnchorElem =
                  document.getElementById('downloadAnchorElem');
                if (!dlAnchorElem) {
                  return;
                }
                const version =
                  typeof model.version === 'undefined' ? 1 : ++model.version;
                const dataStr =
                  'data:text/json;charset=utf-8,' +
                  encodeURIComponent(JSON.stringify({ ...model, version }));
                dlAnchorElem.setAttribute('href', dataStr);
                dlAnchorElem.setAttribute(
                  'download',
                  `${modelToSaveName(model)}.json`
                );
                dlAnchorElem.click();
                localStorage.setItem(SAVED, 'true');
              },
            }),
            readerAvailable &&
              m(Button, {
                iconName: 'upload',
                className: 'btn-large',
                label: t('UPLOAD_FILE'),
                onclick: () => {
                  uploadFile((files) => {
                    const data = files.item(0);
                    if (!data) return;
                    const reader = new FileReader();
                    reader.onerror = () => {
                      toast({ html: t('IMPORT_READ_ERROR') });
                    };
                    reader.onload = async () => {
                      let imported: ReturnType<typeof parseImportedModel>;
                      try {
                        imported = parseImportedModel(reader.result as string);
                      } catch (error) {
                        if (!(error instanceof Error)) throw error;
                        toast({ html: t('JSON_NOT_VALID') });
                        return;
                      }
                      if (imported.kind === 'scenario') {
                        const scenario = imported.value;
                        if (
                          model.scenario.id === scenario.id ||
                          model.scenarios?.some((s) => s.id === scenario.id)
                        ) {
                          pendingScenario = scenario;
                          importConflictModal = true;
                          m.redraw();
                        } else {
                          model.scenarios = [model.scenario, ...model.scenarios];
                          model.scenario = scenario;
                          await saveModel(attrs, model, true);
                          toast({ html: t('SCENARIO_LOADED_MSG') });
                        }
                      } else {
                        pendingCollection =
                          imported.kind === 'legacy'
                            ? convertFromOld(imported.value)
                            : imported.value;
                        confirmCollectionImport = true;
                        m.redraw();
                      }
                    };
                    reader.readAsText(data);
                  });
                },
              }),
          ]),
          m(
            '.section',
            m('.row.container.center', [
              m('.row', m('.col.s12.align-center', [m('h5', 'ScenarioSpark')])),
              m('.row', [
                m(
                  '.col.s12.m4',
                  m('.icon-block', [
                    m('.center', m(Icon, { iconName: 'ads_click' })),
                    m(
                      'h5.center',
                      m(
                        m.route.Link,
                        {
                          href: t('ABOUT', 'ROUTE') + `#goal`,
                        },
                        t('GOAL', 'TITLE')
                      )
                    ),
                    m('p', t('GOAL', 'DESC')),
                  ])
                ),
                m(
                  '.col.s12.m4',
                  m('.icon-block', [
                    m('.center', m(Icon, { iconName: 'settings' })),
                    m(
                      'h5.center',
                      m(
                        m.route.Link,
                        {
                          href: t('ABOUT', 'ROUTE') + `#usage`,
                        },
                        t('USAGE', 'TITLE')
                      )
                    ),
                    m('p', t('USAGE', 'DESC')),
                  ])
                ),
                m(
                  '.col.s12.m4',
                  m('.icon-block', [
                    m('.center', m(Icon, { iconName: 'lock' })),
                    m(
                      'h5.center',
                      m(
                        m.route.Link,
                        {
                          href: t('ABOUT', 'ROUTE') + `#security`,
                        },
                        t('SECURITY', 'TITLE')
                      )
                    ),
                    m('p', t('SECURITY', 'DESC')),
                  ])
                ),
              ]),
            ])
          ),
          // m(ModalPanel, {
          //   id: 'delete_model',
          //   isOpen: deleteModelModal,
          //   onToggle: (open) => (deleteModelModal = open),
          //   title: t('DELETE_MODEL', 'title'),
          //   description: m('.row', [
          //     m('.col.s12', [t('DELETE_MODEL', 'description')]),
          //   ]),
          //   buttons: [
          //     { label: t('CANCEL'), iconName: 'cancel', onclick: () => (deleteModelModal = false) },
          //     {
          //       label: t('OK'),
          //       iconName: 'delete',
          //       onclick: async () => {
          //         model.scenario =
          //           model.scenarios && model.scenarios.length > 0
          //             ? model.scenarios[0]
          //             : newScenario();
          //         model.scenarios = model.scenarios.filter(
          //           (s) => s.id !== model.scenario.id
          //         );
          //         await saveModel(attrs, model, true);
          //       },
          //     },
          //   ],
          // }),
          m(ModalPanel, {
            id: 'clearAll',
            isOpen: clearAllModal,
            onToggle: (open) => (clearAllModal = open),
            title: t('NEW_MODEL', 'title'),
            closeOnButtonClick: true,
            description: m('.row', [
              m('.col.s12', [t('NEW_MODEL', 'description')]),
              m('.col.s12', [
                m(
                  '.row',
                  m(RadioButtons, {
                    label: t('NEW_MODEL', 'choose'),
                    checkedId: 1,
                    options: defaultModels.map((_, i) => ({
                      id: i + 1,
                      label: `${t('MODEL_NAMES', i)}: ${t(
                        'MODEL_DESC',
                        i
                      )}`,
                    })),
                    onchange: (i) => (selectedId = (i as number) - 1),
                  })
                ),
              ]),
            ]),
            buttons: [
              {
                label: t('CANCEL'),
                iconName: 'cancel',
              },
              {
                label: t('OK'),
                iconName: 'delete',
                onclick: async () => {
                  await saveModel(attrs, defaultModels[selectedId](), true);
                  routingSvc.switchTo(
                    selectedId === 0
                      ? Dashboards.SETTINGS
                      : Dashboards.DEFINE_BOX
                  );
                },
              },
            ],
          }),
          m(ModalPanel, {
            id: 'downloadScenario',
            isOpen: downloadScenarioModalOpen,
            onToggle: (open) => {
              downloadScenarioModalOpen = open;
            },
            title: t('DOWNLOAD_FILENAME_TITLE'),
            description: m('.row', [
              m(TextInput, {
                label: t('DOWNLOAD_FILENAME_LABEL'),
                value: downloadFilename,
                oninput: (value) => {
                  downloadFilename = value;
                },
              }),
            ]),
            closeOnButtonClick: true,
            buttons: [
              { label: t('CANCEL'), iconName: 'cancel' },
              {
                label: t('DOWNLOAD', 'MODEL'),
                iconName: 'download',
                disabled: !jsonFilename(downloadFilename),
                onclick: () => {
                  const filename = jsonFilename(downloadFilename);
                  const dlAnchorElem =
                    document.getElementById('downloadAnchorElem');
                  if (!filename || !dlAnchorElem) return;
                  const version =
                    typeof model.version === 'undefined'
                      ? 1
                      : model.version + 1;
                  const dataStr =
                    'data:text/json;charset=utf-8,' +
                    encodeURIComponent(
                      JSON.stringify({ ...model.scenario, version })
                    );
                  dlAnchorElem.setAttribute('href', dataStr);
                  dlAnchorElem.setAttribute('download', filename);
                  dlAnchorElem.click();
                  model.version = version;
                  localStorage.setItem(SAVED, 'true');
                  downloadScenarioModalOpen = false;
                },
              },
            ],
          }),
          m(ModalPanel, {
            id: 'confirmCollectionImport',
            isOpen: confirmCollectionImport,
            onToggle: (open) => {
              if (!open) {
                pendingCollection = null;
                confirmCollectionImport = false;
              }
            },
            title: t('IMPORT_COLLECTION_TITLE'),
            description: t('IMPORT_COLLECTION_MSG'),
            closeOnButtonClick: true,
            buttons: [
              { label: t('CANCEL'), iconName: 'cancel' },
              {
                label: t('IMPORT_OVERWRITE'),
                iconName: 'upload',
                onclick: async () => {
                  if (!pendingCollection) return;
                  await saveModel(attrs, pendingCollection, true);
                  toast({ html: t('COLLECTION_LOADED_MSG') });
                  pendingCollection = null;
                  confirmCollectionImport = false;
                },
              },
            ],
          }),
          m(ModalPanel, {
            id: 'importConflict',
            isOpen: importConflictModal,
            onToggle: (open) => {
              if (!open) {
                pendingScenario = null;
                importConflictModal = false;
              }
            },
            title: t('IMPORT_CONFLICT_TITLE'),
            closeOnButtonClick: true,
            description: m('.row', [
              m('.col.s12', [
                t('IMPORT_CONFLICT_MSG', { name: pendingScenario?.label || '' }),
              ]),
            ]),
            buttons: [
              {
                label: t('CANCEL'),
                iconName: 'cancel',
              },
              {
                label: t('IMPORT_OVERWRITE'),
                iconName: 'overwrite',
                onclick: async () => {
                  if (!pendingScenario) return;
                  // Replace existing scenario in collection
                  if (!model.scenarios) model.scenarios = [];
                  const existingIdx = model.scenarios.findIndex(
                    (s) => s.id === pendingScenario?.id
                  );
                  if (existingIdx >= 0) {
                    model.scenarios[existingIdx] = pendingScenario;
                  } else if (model.scenario.id === pendingScenario.id) {
                    model.scenario = pendingScenario;
                  }
                  saveModel(attrs, model, true);
                  toast({ html: t('SCENARIO_LOADED_MSG') });
                  pendingScenario = null;
                  importConflictModal = false;
                },
              },
              {
                label: t('IMPORT_AS_COPY'),
                iconName: 'content_copy',
                onclick: async () => {
                  if (!pendingScenario) return;
                  // Add as a new scenario with a new ID
                  const copy: Scenario = {
                    ...pendingScenario,
                    id: uniqueId(),
                    label: pendingScenario.label + ' (copy)',
                  };
                  if (!model.scenarios) model.scenarios = [];
                  model.scenarios = [model.scenario, ...model.scenarios, copy];
                  model.scenario = copy;
                  saveModel(attrs, model, true);
                  toast({ html: t('SCENARIO_LOADED_MSG') });
                  pendingScenario = null;
                  importConflictModal = false;
                },
              },
            ],
          }),
          m(NewScenarioWizard, {
            ...attrs,
            isOpen: newScenarioWizardOpen,
            onClose: () => {
              newScenarioWizardOpen = false;
            },
            onComplete: async (scenario: Scenario) => {
              if (!model.scenarios) model.scenarios = [];
              model.scenarios = [model.scenario, ...model.scenarios];
              model.scenario = scenario;
              await saveModel(attrs, model, true);
              toast({ html: t('SCENARIO_CREATED_MSG') });
              newScenarioWizardOpen = false;
              changePage(attrs, Dashboards.DEFINE_BOX);
            },
          }),
          m(LLMScenarioWizard, {
            ...attrs,
            isOpen: llmScenarioWizardOpen,
            onClose: () => {
              llmScenarioWizardOpen = false;
            },
            onComplete: async (scenario: Scenario) => {
              if (!model.scenarios) model.scenarios = [];
              model.scenarios = [model.scenario, ...model.scenarios];
              model.scenario = scenario;
              await saveModel(attrs, model, true);
              toast({ html: t('SCENARIO_CREATED_MSG') });
              llmScenarioWizardOpen = false;
              changePage(attrs, Dashboards.DEFINE_BOX);
            },
          }),
        ]),
      ];
    },
  };
};
