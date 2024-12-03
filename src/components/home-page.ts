import m from 'mithril';
import {
  Button,
  FlatButton,
  Icon,
  InputCheckbox,
  ModalPanel,
  RadioButtons,
  Select,
  Tabs,
} from 'mithril-materialized';
import background from '../assets/background.webp';
import DutchFlag from '../assets/flag-nl.png';
import EnglishFlag from '../assets/flag-en.png';
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
  OldDataModel,
  Scenario,
  ScenarioComponent,
  defaultModels,
  newScenario,
} from '../models';
import { SAVED, capitalize, convertFromOld, modelToSaveName } from '../utils';

export const TableView: MeiosisComponent<{
  narratives: Narrative[];
  components: ScenarioComponent[];
}> = () => {
  return {
    view: ({ attrs: { components, narratives = [], ...attrs } }) => {
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
                    'th.bold',
                    { style: 'text-align: left' },
                    m(
                      'a',
                      {
                        href: routingSvc.href(Dashboards.SHOW_SCENARIO),
                        onclick: () => {
                          attrs.update({
                            curNarrative: () => n,
                          });
                        },
                      },
                      capitalize(n.label)
                    )
                  ),
                  components.map((c) =>
                    n.components[c.id] && n.components[c.id].length > 0
                      ? m(
                          'td',
                          m.trust(
                            n.components[c.id]
                              .map(
                                (id) =>
                                  lookup[id] ||
                                  `<span class="red-text">Missing component ID: ${id}</span>`
                              )
                              .join(', ')
                          )
                        )
                      : n[c.id as 'risk' | 'probability' | 'impact']
                      ? m(
                          'td',
                          lookup[n[c.id as 'risk' | 'probability' | 'impact']!]
                        )
                      : m(
                          'td.center-align.missing',
                          m(Icon, { iconName: 'clear', className: 'red-text' })
                        )
                  )
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
  let removeAllKeyValues = false;

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.HOME);
      // const uriModel = m.route.param('model');
      // if (!uriModel) {
      //   return;
      // }
      // try {
      //   const decompressed = lz.decompressFromEncodedURIComponent(uriModel);
      //   if (!decompressed) {
      //     return;
      //   }
      //   const model = JSON.parse(decompressed);
      //   saveModel(model);
      //   changePage(Dashboards.OVERVIEW);
      // } catch (err) {
      //   console.error(err);
      // }
    },
    view: ({ attrs }) => {
      const isCleared = false;
      const { model, language } = attrs.state;
      const {
        scenarios = [],
        scenario: { id, label, narratives = [], components, categories },
      } = model;

      const selectedNarratives = narratives
        .filter((n) => n.included)
        .sort((a, b) => (a.label || '').localeCompare(b.label));

      return [
        m('div', { style: 'padding-top: 1rem;position: relative;' }, [
          selectedNarratives.length > 0 &&
            categories.length > 0 && [
              m('.row', m('.col.s12', [m('h4', t('SAVED_NARRATIVES'))])),
              categories.length > 1
                ? m(Tabs, {
                    tabs: categories.map((c) => ({
                      title: c.label,
                      vnode: m(TableView, {
                        ...attrs,
                        narratives: selectedNarratives,
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
                      narratives: selectedNarratives,
                      components: components.filter(
                        (comp) =>
                          categories[0].componentIds &&
                          categories[0].componentIds.includes(comp.id)
                      ),
                    })
                  ),
            ],
          selectedNarratives.length === 0 &&
            m(
              '.row',
              m(
                '.col.s12.center-align',
                m('img.responsive-img.center[alt=fountain pen]', {
                  src: background,
                })
              )
            ),
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
                    onclick: async () => {
                      if (!model.scenarios) model.scenarios = [];
                      model.scenarios = [model.scenario, ...model.scenarios];
                      model.scenario = newScenario();
                      await saveModel(attrs, model, true);
                      M.toast({ html: t('SCENARIO_CREATED_MSG') });
                      changePage(attrs, Dashboards.SETTINGS);
                    },
                  }),
                  m(FlatButton, {
                    className: 'icon-button',
                    iconName: 'download',
                    title: t('DOWNLOAD', 'MODEL'),
                    onclick: () => {
                      const dlAnchorElem =
                        document.getElementById('downloadAnchorElem');
                      if (!dlAnchorElem) {
                        return;
                      }
                      const version =
                        typeof model.version === 'undefined'
                          ? 1
                          : ++model.version;
                      const dataStr =
                        'data:text/json;charset=utf-8,' +
                        encodeURIComponent(
                          JSON.stringify({ ...model.scenario, version })
                        );
                      dlAnchorElem.setAttribute('href', dataStr);
                      dlAnchorElem.setAttribute(
                        'download',
                        `${modelToSaveName(model, undefined, false)}.json`
                      );
                      dlAnchorElem.click();
                      localStorage.setItem(SAVED, 'true');
                    },
                  }),
                  readerAvailable &&
                    m(FlatButton, {
                      className: 'icon-button',
                      iconName: 'upload',
                      title: t('UPLOAD', 'MODEL'),
                      onclick: () => {
                        const fileInput = document.getElementById(
                          'selectFiles'
                        ) as HTMLInputElement;
                        fileInput.onchange = () => {
                          if (!fileInput) {
                            return;
                          }
                          const files = fileInput.files;
                          if (!files || (files && files.length <= 0)) {
                            return;
                          }
                          const data = files && files.item(0);
                          const isJson = data && /json$/i.test(data.name);
                          const reader = new FileReader();
                          reader.onload = async (
                            e: ProgressEvent<FileReader>
                          ) => {
                            if (isJson) {
                              const result = (e &&
                                e.target &&
                                e.target.result) as string;
                              const scenario = JSON.parse(
                                result.toString()
                              ) as Scenario;
                              if (
                                scenario &&
                                scenario.id &&
                                scenario.label &&
                                model.scenario.id !== scenario.id &&
                                !model.scenarios?.some(
                                  (s) => s.id === scenario.id
                                )
                              ) {
                                if (!model.scenarios) model.scenarios = [];
                                model.scenarios = [
                                  model.scenario,
                                  ...model.scenarios,
                                ];
                                model.scenario = scenario;
                                saveModel(attrs, model, true);
                                M.toast({ html: t('SCENARIO_LOADED_MSG') });
                              } else {
                                M.toast({ html: t('SCENARIO_NOT_LOADED_MSG') });
                              }
                            }
                          };
                          if (data) {
                            isJson
                              ? reader.readAsText(data)
                              : reader.readAsArrayBuffer(data);
                          }
                        };
                        fileInput.click();
                      },
                    }),
                  m(FlatButton, {
                    className: 'icon-button',
                    iconName: 'delete',
                    title: t('DELETE'),
                    modalId: 'delete_model',
                  })
                )
              )
            )
          ),
          m('.buttons.center', { style: 'margin: 10px auto;' }, [
            [
              m(
                '.language-option',
                {
                  onclick: () => setLanguage('nl'),
                },
                [
                  m('img', {
                    src: DutchFlag,
                    alt: 'Nederlands',
                    title: 'Nederlands',
                    disabled: language === 'nl',
                    class: language === 'nl' ? 'disabled-image' : 'clickable',
                  }),
                  m('span', 'Nederlands'),
                ]
              ),
              m(
                '.language-option',
                {
                  onclick: () => setLanguage('en'),
                },
                [
                  m('img', {
                    src: EnglishFlag,
                    alt: 'English',
                    title: 'English',
                    disabled: language === 'en',
                    class: language === 'en' ? 'disabled-image' : 'clickable',
                  }),
                  m('span', 'English'),
                ]
              ),
            ],
            m(Button, {
              iconName: 'clear',
              disabled: isCleared,
              className: 'btn-large',
              label: t('NEW_MODEL', 'btn'),
              modalId: 'clearAll',
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
            m('input#selectFiles[type=file][accept=.json]', {
              style: 'display:none',
            }),
            // m('input#selectFiles[type=file][accept=.json,.pdf]', { style: 'display:none' }),
            readerAvailable &&
              m(Button, {
                iconName: 'upload',
                className: 'btn-large',
                label: t('UPLOAD', 'COLLECTION'),
                onclick: () => {
                  const fileInput = document.getElementById(
                    'selectFiles'
                  ) as HTMLInputElement;
                  fileInput.onchange = () => {
                    if (!fileInput) {
                      return;
                    }
                    const files = fileInput.files;
                    if (!files || (files && files.length <= 0)) {
                      return;
                    }
                    const data = files && files.item(0);
                    const isJson = data && /json$/i.test(data.name);
                    const reader = new FileReader();
                    reader.onload = async (e: ProgressEvent<FileReader>) => {
                      if (isJson) {
                        const result = (e &&
                          e.target &&
                          e.target.result) as string;
                        const json = JSON.parse(result.toString()) as
                          | DataModel
                          | OldDataModel;
                        if (json) {
                          const dataModel = json.version
                            ? (json as DataModel)
                            : convertFromOld(json as OldDataModel);
                          saveModel(attrs, dataModel, true);
                          M.toast({ html: t('COLLECTION_LOADED_MSG') });
                        }
                      }
                    };
                    if (data) {
                      isJson
                        ? reader.readAsText(data)
                        : reader.readAsArrayBuffer(data);
                    }
                  };
                  fileInput.click();
                },
              }),
          ]),
          m(
            '.section.white',
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
            id: 'delete_model',
            title: t('DELETE_MODEL', 'title'),
            description: m('.row', [
              m('.col.s12', [t('DELETE_MODEL', 'description')]),
            ]),
            buttons: [
              { label: t('CANCEL'), iconName: 'cancel' },
              {
                label: t('OK'),
                iconName: 'delete',
                onclick: async () => {
                  model.scenario =
                    model.scenarios && model.scenarios.length > 0
                      ? model.scenarios[0]
                      : newScenario();
                  model.scenarios = model.scenarios.filter(
                    (s) => s.id !== model.scenario.id
                  );
                  await saveModel(attrs, model, true);
                  // routingSvc.switchTo(
                  //   selectedId === 0
                  //     ? Dashboards.SETTINGS
                  //     : Dashboards.DEFINE_BOX
                  // );
                },
              },
            ],
          }),
          m(ModalPanel, {
            id: 'clearAll',
            title: t('NEW_MODEL', 'title'),
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
                      label: `<strong>${t('MODEL_NAMES', i)}: </strong>${t(
                        'MODEL_DESC',
                        i
                      )}`,
                    })),
                    onchange: (i) => (selectedId = (i as number) - 1),
                  })
                ),
                m(
                  '.row',
                  m(InputCheckbox, {
                    label: t('NEW_MODEL', 'remove'),
                    checked: removeAllKeyValues,
                    onchange: (v) => (removeAllKeyValues = v),
                  })
                ),
              ]),
            ]),
            buttons: [
              { label: t('CANCEL'), iconName: 'cancel' },
              {
                label: t('OK'),
                iconName: 'delete',
                onclick: async () => {
                  await saveModel(attrs, defaultModels[selectedId], true);
                  routingSvc.switchTo(
                    selectedId === 0
                      ? Dashboards.SETTINGS
                      : Dashboards.DEFINE_BOX
                  );
                },
              },
            ],
          }),
        ]),
      ];
    },
  };
};
