import m, { FactoryComponent } from 'mithril';
import {
  Dashboards,
  DataModel,
  ID,
  Narrative,
  ScenarioComponent,
} from '../models';
import { MeiosisComponent, State, i18n, setPage, t } from '../services';
import {
  Select,
  ISelectOptions,
  FlatButton,
  InputCheckbox,
  uniqueId,
} from 'mithril-materialized';
import { deepCopy } from 'mithril-ui-form';
import Quill from 'quill';
import { generateWord } from 'quill-to-word';
import {
  createCircleSVG,
  modelToSaveName,
  narrativesToOptions,
  svgToDataURI,
  trafficLight,
} from '../utils';
import { htmlTemplate } from '../assets/html-styles';
import { ScenarioParagraph } from './ui/scenario-paragraph';
import { MeiosisCell } from 'meiosis-setup/types';

const CategoryTable: FactoryComponent<{
  curNarrative?: Narrative;
  comps?: ScenarioComponent[];
}> = () => {
  let id: string;
  return {
    oninit: () => (id = uniqueId()),
    view: ({ attrs: { curNarrative = {} as Narrative, comps } }) => {
      const { components } = curNarrative;
      const lookup =
        comps &&
        comps.reduce((acc, cur) => {
          cur.values &&
            cur.values.forEach((v) => {
              acc[cur.id + v.id] = v.label;
            });
          return acc;
        }, {} as Record<string, string>);
      return [
        m('table.highlight', { id }, [
          m(
            'thead',
            m('tr', [m('th', t('DIMENSION')), m('th', t('KEY_VALUE'))])
          ),
          m(
            'tbody',
            components &&
              comps &&
              lookup &&
              comps
                .filter((c) => components[c.id])
                .map((c) => {
                  return m('tr', [
                    m('th', c.label),
                    m(
                      'td',
                      components[c.id].map((id) => lookup[c.id + id]).join(', ')
                    ),
                  ]);
                })
          ),
        ]),

        m(FlatButton, {
          label: t('COPY_TO_CLIPBOARD'),
          className: 'right',
          iconName: 'content_copy',
          onclick: () => {
            function listener(e: ClipboardEvent) {
              if (!e.clipboardData) return;
              const table = document.getElementById(id);
              if (!table) return;
              // console.log(table.outerHTML);
              e.clipboardData.setData(
                'text/html',
                htmlTemplate({
                  body: table.outerHTML,
                  lang: i18n.currentLocale,
                })
              );
              // e.clipboardData.setData('text/plain', md);
              e.preventDefault();
            }
            document.addEventListener('copy', listener);
            document.execCommand('copy');
            document.removeEventListener('copy', listener);
          },
        }),
      ];
    },
  };
};

export const ShowScenarioPage: MeiosisComponent = () => {
  let editor: Quill;

  const exportToWord = async (model: DataModel, narrativeName?: string) => {
    const delta = editor.getContents();
    const blob = await generateWord(delta, {
      exportAs: 'blob',
      paragraphStyles: {
        normal: {
          paragraph: {
            spacing: {
              before: 0,
              after: 12,
            },
          },
          run: {
            font: 'Calibri',
            size: 24,
          },
        },
      },
    });

    const dlAnchorElem = document.getElementById('downloadAnchorElem');
    if (!dlAnchorElem) {
      return;
    }
    model.version = model.version ? model.version++ : 1;
    dlAnchorElem.setAttribute('href', URL.createObjectURL(blob as Blob));
    dlAnchorElem.setAttribute(
      'download',
      `${modelToSaveName(model, narrativeName)}.docx`
    );
    dlAnchorElem.click();
  };

  const updateCurNarrative = (
    newNarrative: Narrative | undefined,
    editor: Quill,
    attrs: MeiosisCell<State>,
    model: DataModel
  ) => {
    if (newNarrative) {
      editor.setContents(
        newNarrative.desc ? JSON.parse(newNarrative.desc) : []
      );
      attrs.update({
        curNarrative: () => deepCopy(newNarrative),
        lockedComps: () =>
          model.scenario.components.reduce((acc, cur) => {
            acc[cur.id] = true;
            return acc;
          }, {} as Record<ID, boolean>),
      });
    }
  };

  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.SHOW_SCENARIO),
    view: ({ attrs }) => {
      const { state } = attrs;
      const { model, curNarrative } = state;

      const {
        scenario: {
          template,
          categories = [],
          components: modelComps = [],
          narratives = [],
        },
      } = model;
      const multipleCategories = categories.length > 1;
      if ((!curNarrative || !curNarrative.saved) && narratives.length > 0) {
        const newNarrative = narratives[0];
        attrs.update({
          curNarrative: () => deepCopy(newNarrative),
        });
        return;
      }

      const selectOptions = narrativesToOptions(model.scenario.narratives);
      const narrativeIdx = curNarrative
        ? narratives.findIndex((n) => n.id === curNarrative.id)
        : -1;

      return m(
        '.show-scenario.row',
        [
          m('a#downloadAnchorElem', { style: 'display:none' }),
          curNarrative &&
            m('.col.s12', [
              curNarrative.risk &&
                m('img[title=risk-status].right', {
                  src: svgToDataURI(
                    createCircleSVG(
                      trafficLight[+curNarrative.risk.replace('risk_', '')],
                      48
                    )
                  ),
                }),
              m(FlatButton, {
                label: t('EXPORT2WORD'),
                iconName: 'download',
                className: 'right',
                disabled: !curNarrative.desc,
                onclick: () => exportToWord(model, curNarrative.label),
              }),
              m(InputCheckbox, {
                checked: curNarrative.included,
                label: t('NARRATIVE_INCLUDED'),
                disabled: true,
                className: 'right mt3',
              }),
            ]),
        ],
        model.scenario &&
          model.scenario.narratives &&
          model.scenario.narratives.length > 0 && [
            m(
              '.col.s12',
              m(
                '.row',
                m(Select, {
                  className: 'col s7 m8 l11 mb0 mw30',
                  label: t('SELECT_NARRATIVE'),
                  checkedId:
                    curNarrative && curNarrative.saved
                      ? curNarrative.id
                      : undefined,
                  placeholder: t('i18n', 'pickOne'),
                  options: selectOptions,
                  onchange: (v) => {
                    if (v && v.length > 0) {
                      const newNarrative = model.scenario.narratives.find(
                        (n) => n.id === v[0]
                      );
                      updateCurNarrative(newNarrative, editor, attrs, model);
                    }
                  },
                } as ISelectOptions<string>),
                m(
                  '.right.mb0',
                  m(
                    'i.material-icons.medium',
                    {
                      className:
                        narrativeIdx < narratives.length - 1
                          ? 'blue-text clickable'
                          : 'grey-text',
                      onclick: () => {
                        if (narrativeIdx < narratives.length - 1) {
                          const newNarrative = narratives[narrativeIdx + 1];
                          updateCurNarrative(
                            newNarrative,
                            editor,
                            attrs,
                            model
                          );
                        }
                      },
                    },
                    'arrow_right'
                  )
                ),
                m(
                  '.right.mb0',
                  m(
                    'i.material-icons.medium',
                    {
                      className:
                        narrativeIdx > 0 ? 'blue-text clickable' : 'grey-text',
                      onclick: () => {
                        if (narrativeIdx > 0) {
                          const newNarrative = narratives[narrativeIdx - 1];
                          updateCurNarrative(
                            newNarrative,
                            editor,
                            attrs,
                            model
                          );
                        }
                      },
                    },
                    'arrow_left'
                  )
                )
              )
            ),
            curNarrative && [
              m(
                '.col.s12',
                {
                  oncreate: () => {
                    editor = new Quill('#editor', {
                      modules: {
                        toolbar: false,
                      },
                      readOnly: true,
                      theme: 'snow',
                    });
                    editor.setContents(
                      curNarrative.desc ? JSON.parse(curNarrative.desc) : []
                    );
                  },
                },
                [m('.col.s12', [m('#editor.row', {})])]
              ),
              template
                ? m(
                    '.col.s12',
                    m(ScenarioParagraph, {
                      ...attrs,
                      template,
                    })
                  )
                : '',
              m(
                '.col.s12',
                m('.row', [
                  categories.map((category) => {
                    const componentIds = category && category.componentIds;
                    const comps =
                      componentIds &&
                      modelComps.filter((c) => componentIds.indexOf(c.id) >= 0);
                    return m(
                      '.col',
                      {
                        className: `s${12 / categories.length}`,
                      },
                      multipleCategories && m('h5', category.label),
                      m(CategoryTable, { curNarrative, comps })
                    );
                  }),
                ])
              ),
            ],
          ]
      );
    },
  };
};
