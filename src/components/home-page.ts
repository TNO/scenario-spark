import m from 'mithril';
import {
  Button,
  FlatButton,
  Icon,
  Menu,
  ModalPanel,
  RadioButtons,
  Select,
  Tabs,
  TextInput,
  toast,
  uniqueId,
} from 'mithril-materialized';
import background from '../assets/hero.webp';
import {
  changePage,
  MeiosisComponent,
  i18n,
  routingSvc,
  saveModel,
  selectScenarioFromCollection,
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
import { addStarterKitToModel, loadStarterKit } from '../models/starter-kit';
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
const BoxActions = Menu<'new' | 'llm' | 'download' | 'delete'>();

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
  let deleteScenarioModalOpen = false;
  let showComparison = false;

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.HOME);
    },
    view: ({ attrs }) => {
      const isCleared = false;
      const { model } = attrs.state;
      const {
        scenarios = [],
        scenario: { id, label, narratives = [], components, categories },
      } = model;

      const savedNarratives = narratives.filter((n) => n.included);
      const filteredNarratives = savedNarratives
        .filter((n) => {
          if (!narrativeFilter.trim()) return true;
          const term = narrativeFilter.toLowerCase();
          return (n.label || '').toLowerCase().includes(term);
        })
        .sort((a, b) => (a.label || '').localeCompare(b.label));
      const valueLabels = new Map(
        components.flatMap((component) =>
          (component.values || []).map((value) => [value.id, value.label] as const)
        )
      );
      const hasBoxContent = components.length > 0;

      return [
        m('div', { style: 'position: relative;' }, [
          m('main.home-dashboard', [
            m('header.home-intro', [
              m('.home-workspace', [
                m('h1.home-work-title', t('HOME_WORK_TITLE')),
                m('p.home-work-hint', t('HOME_WORK_HINT')),
                m('.home-box-selector', [
                  m('.home-select-slot', m(Select, {
                    key: id,
                    label: t('SELECT_SCENARIO'),
                    checkedId: id,
                    options: [{ id, label }, ...scenarios],
                    onchange: async (ids) => {
                      narrativeFilter = '';
                      showComparison = false;
                      await selectScenarioFromCollection(attrs, ids[0] as string);
                    },
                  })),
                ]),
                m('.home-task-actions', [
                  m(Button, {
                    iconName: hasBoxContent ? 'edit' : 'grid_view',
                    label: hasBoxContent ? t('CREATE_SCENARIO', 'TITLE') : t('EDIT_BOX'),
                    onclick: () => changePage(
                      attrs,
                      hasBoxContent ? Dashboards.CREATE_SCENARIO : Dashboards.DEFINE_BOX
                    ),
                  }),
                  hasBoxContent && m(FlatButton, {
                    iconName: 'grid_view',
                    label: t('EDIT_BOX'),
                    onclick: () => changePage(attrs, Dashboards.DEFINE_BOX),
                  }),
                  m(BoxActions, {
                    ariaLabel: t('BOX_ACTIONS'),
                    trigger: (menuAttrs) => m('button.btn-flat.home-box-menu-trigger', {
                      ...menuAttrs,
                      type: 'button',
                      title: t('BOX_ACTIONS'),
                      'aria-label': t('BOX_ACTIONS'),
                    }, [
                      m(Icon, { iconName: 'more_vert' }),
                      m('span.home-box-menu-label', t('BOX_ACTIONS')),
                    ]),
                    items: [
                      { id: 'new', label: t('NEW_SCENARIO'), iconName: 'add' },
                      { id: 'llm', label: t('LLM_WIZARD_TITLE'), iconName: 'auto_fix_high' },
                      { id: 'download', label: t('DOWNLOAD', 'MODEL'), iconName: 'download' },
                      { id: 'delete', label: t('DELETE_MODEL', 'btn'), iconName: 'delete' },
                    ],
                    onSelect: (action) => {
                      if (action === 'new') {
                        newScenarioWizardOpen = true;
                      } else if (action === 'llm') {
                        llmScenarioWizardOpen = true;
                      } else if (action === 'delete') {
                        deleteScenarioModalOpen = true;
                      } else {
                        const version =
                          typeof model.version === 'undefined' ? 1 : model.version + 1;
                        downloadFilename = modelToSaveName(
                          { ...model, version }, undefined, false
                        );
                        downloadScenarioModalOpen = true;
                      }
                    },
                  }),
                ]),
              ]),
              m('.home-visual', [
                m('img.home-hero-image', { src: background, alt: '' }),
              ]),
            ]),
            m('section.home-saved-scenarios', [
              m('.home-saved-heading', [
                m('h2', t('SAVED_NARRATIVES')),
                m('span.home-saved-count', savedNarratives.length),
              ]),
              savedNarratives.length > 4 && m(TextInput, {
                id: 'narrative-filter',
                label: t('FILTER_NARRATIVES'),
                value: narrativeFilter,
                placeholder: t('FILTER_NARRATIVES_PLACEHOLDER'),
                oninput: (value) => {
                  narrativeFilter = value;
                },
              }),
              savedNarratives.length === 0
                ? m('p.home-empty-state', { role: 'status' }, t('NO_SAVED_NARRATIVES'))
                : filteredNarratives.length === 0
                  ? m('p.home-empty-state', { role: 'status' }, t('NO_MATCHING_NARRATIVES'))
                  : m('.home-scenario-list', filteredNarratives.map((n) => {
                      const preview = Object.values(n.components || {})
                        .flat()
                        .map((valueId) => valueLabels.get(valueId))
                        .filter((value): value is string => Boolean(value))
                        .slice(0, 3)
                        .join(' · ');
                      return m('a.home-scenario-link', {
                        href: routingSvc.href(Dashboards.SHOW_SCENARIO),
                        onclick: () => attrs.update({ curNarrative: () => n }),
                      }, [
                        m('.home-scenario-details', [
                          m('span.home-scenario-name', n.label || t('NARRATIVE')),
                          preview && m('span.home-scenario-preview', preview),
                        ]),
                        m('span.home-scenario-open', t('OPEN_SCENARIO')),
                      ]);
                    })),
              filteredNarratives.length > 1 && categories.length > 0 &&
                m(FlatButton, {
                  className: 'home-compare-toggle',
                  iconName: showComparison ? 'expand_less' : 'view_column',
                  label: t(showComparison ? 'HIDE_COMPARISON' : 'COMPARE_SCENARIOS'),
                  'aria-expanded': showComparison,
                  'aria-controls': 'home-comparison',
                  onclick: () => { showComparison = !showComparison; },
                }),
              showComparison && filteredNarratives.length > 1 && categories.length > 0 &&
                m('.home-comparison#home-comparison', categories.length > 1
                  ? m(Tabs, {
                      tabs: categories.map((c) => ({
                        title: c.label,
                        vnode: m(TableView, {
                          ...attrs,
                          narratives: filteredNarratives,
                          components: components.filter((comp) => c.componentIds?.includes(comp.id)),
                        }),
                      })),
                    })
                  : m(TableView, {
                      ...attrs,
                      narratives: filteredNarratives,
                      components: components.filter((comp) => categories[0].componentIds?.includes(comp.id)),
                    })),
            ]),
            m('section.home-collection-tools', [
              m('h2', t('COLLECTION_ACTIONS')),
              m('.home-collection-tool-row', [
            m(FlatButton, {
              iconName: 'clear',
              disabled: isCleared,
              label: t('NEW_MODEL', 'btn'),
              onclick: () => (clearAllModal = true),
            }),
            m(FlatButton, {
              iconName: 'playlist_add',
              label: t('ADD_STARTER_KIT'),
              title: t('ADD_STARTER_KIT_HINT'),
              onclick: async () => {
                let starter: DataModel;
                try {
                  starter = await loadStarterKit(i18n.currentLocale, thresholdColors);
                } catch (error) {
                  console.error('Could not load starter kit', error);
                  toast({ html: t('STARTER_KIT_LOAD_FAILED') });
                  return;
                }
                const result = addStarterKitToModel(model, starter);
                if (result.added) await saveModel(attrs, result.model);
                toast({
                  html: result.added
                    ? t('STARTER_KIT_ADDED', { count: result.added })
                    : t('STARTER_KIT_ALREADY_PRESENT'),
                });
              },
            }),
            m('a#downloadAnchorElem', { style: 'display:none' }),
            m(FlatButton, {
              iconName: 'download',
              disabled: isCleared,
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
              m(FlatButton, {
                iconName: 'upload',
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
            ]),
          ]),
          savedNarratives.length === 0 && m(
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
          m(ModalPanel, {
            id: 'deleteScenario',
            isOpen: deleteScenarioModalOpen,
            onToggle: (open) => { deleteScenarioModalOpen = open; },
            title: t('DELETE_MODEL', 'title'),
            description: t('DELETE_MODEL', 'description'),
            closeOnButtonClick: true,
            buttons: [
              { label: t('CANCEL'), iconName: 'cancel' },
              {
                label: t('DELETE_MODEL', 'btn'),
                iconName: 'delete',
                onclick: async () => {
                  model.scenario = scenarios[0] || newScenario(t('NEW_BOX'));
                  model.scenarios = scenarios.filter(
                    (scenario) => scenario.id !== model.scenario.id
                  );
                  await saveModel(attrs, model, true);
                },
              },
            ],
          }),
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
                    checkedId: selectedId + 1,
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
                  let preset: DataModel;
                  try {
                    preset = await defaultModels[selectedId](i18n.currentLocale, t('NEW_BOX'));
                  } catch (error) {
                    console.error('Could not load starter kit', error);
                    toast({ html: t('STARTER_KIT_LOAD_FAILED') });
                    return;
                  }
                  await saveModel(attrs, preset, true);
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
