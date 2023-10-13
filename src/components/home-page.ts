import m from 'mithril';
import {
  Button,
  Icon,
  InputCheckbox,
  ModalPanel,
  RadioButtons,
  Tabs,
} from 'mithril-materialized';
import background from '../assets/background.webp';
import DutchFlag from '../assets/flag-nl.png';
import EnglishFlag from '../assets/flag-en.png';
import {
  MeiosisComponent,
  changePage,
  routingSvc,
  saveModel,
  setLanguage,
  setPage,
  t,
} from '../services';
import {
  Dashboards,
  DataModel,
  Narrative,
  OldDataModel,
  ScenarioComponent,
  defaultModels,
} from '../models';
import { SAVED, capitalize, convertFromOld, modelToSaveName } from '../utils';

const TableView: MeiosisComponent<{
  narratives: Narrative[];
  components: ScenarioComponent[];
}> = () => {
  return {
    view: ({ attrs: { components, narratives, ...attrs } }) => {
      const lookup = components.reduce((acc, cur) => {
        cur.values &&
          cur.values.forEach((v) => {
            acc[v.id] = v.label;
          });
        return acc;
      }, {} as Record<string, string>);

      return m('table.responsive-table.highlight', [
        m(
          'thead',
          m(
            'tr',
            m('th', t('NAME')),
            components.map((c) => m('th', c.label))
          )
        ),
        m(
          'tbody',
          narratives.map((n) =>
            m(
              'tr',
              m(
                'th',
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
                m(
                  'td',
                  m.trust(
                    n.components[c.id].map((id) => lookup[id]).join(',<br/>')
                  )
                )
              )
            )
          )
        ),
      ]);
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
        scenario: { narratives = [], components, categories },
      } = model;

      const selectedNarratives = narratives
        .filter((n) => n.included)
        .sort((a, b) => (a.label || '').localeCompare(b.label));

      return [
        m('div', { style: 'padding-top: 1rem;position: relative;' }, [
          m(
            '.row',
            m(
              '.col.s12',
              m('img.responsive-img.center[alt=fountain pen]', {
                src: background,
              })
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
              label: t('DOWNLOAD'),
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
                label: t('UPLOAD'),
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
                          changePage(attrs, Dashboards.DEFINE_BOX);
                        }
                        // json &&
                        //   json.version &&
                        //   saveModel(attrs, json as DataModel);
                        // changePage(attrs, Dashboards.HOME);
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
            // m(Button, {
            //   iconName: 'link',
            //   className: 'btn-large',
            //   label: 'Permalink',
            //   onclick: () => {
            //     const permLink = document.createElement('input') as HTMLInputElement;
            //     document.body.appendChild(permLink);
            //     if (!permLink) {
            //       return;
            //     }
            //     const compressed = lz.compressToEncodedURIComponent(JSON.stringify(model));
            //     const url = `${window.location.href}${
            //       /\?/.test(window.location.href) ? '&' : '?'
            //     }model=${compressed}`;
            //     permLink.value = url;
            //     permLink.select();
            //     permLink.setSelectionRange(0, 999999); // For mobile devices
            //     try {
            //       const successful = document.execCommand('copy');
            //       if (successful) {
            //         M.toast({
            //           html: 'Copied permanent link to clipboard.',
            //           classes: 'yellow black-text',
            //         });
            //       }
            //     } catch (err) {
            //       M.toast({
            //         html: 'Failed copying link to clipboard: ' + err,
            //         classes: 'red',
            //       });
            //     } finally {
            //       document.body.removeChild(permLink);
            //     }
            //   },
            // }),
          ]),
          selectedNarratives.length > 0 &&
            categories.length > 0 &&
            m(
              '.row',
              m('.col.s12', [
                m('h4', t('SAVED_NARRATIVES')),
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
                      '.row.narratives',
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
              ])
            ),
          m(
            '.section.white',
            m('.row.container.center', [
              m('.row', m('.col.s12.align-center', 'TODO')),
              m('.row', [
                m(
                  '.col.s12.m4',
                  m('.icon-block', [
                    m('.center', m(Icon, { iconName: 'ads_click' })),
                    m('h5.center', t('GOAL', 'TITLE')),
                    m('p', t('GOAL', 'DESC')),
                  ])
                ),
                m(
                  '.col.s12.m4',
                  m('.icon-block', [
                    m('.center', m(Icon, { iconName: 'settings' })),
                    m('h5.center', t('USAGE', 'TITLE')),
                    m('p', t('USAGE', 'DESC')),
                  ])
                ),
                m(
                  '.col.s12.m4',
                  m('.icon-block', [
                    m('.center', m(Icon, { iconName: 'lock' })),
                    m('h5.center', t('SECURITY', 'TITLE')),
                    m('p', t('SECURITY', 'DESC')),
                  ])
                ),
              ]),
            ])
          ),
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
