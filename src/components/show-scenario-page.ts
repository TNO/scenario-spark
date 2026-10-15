import m, { FactoryComponent } from 'mithril';
import {
  ContextualItem,
  Dashboards,
  DataModel,
  ID,
  Narrative,
  ScenarioComponent,
} from '../models';
import { MeiosisComponent, State, i18n, saveModel, setPage, t } from '../services';
import {
  Select,
  FlatButton,
  InputCheckbox,
  uniqueId,
} from 'mithril-materialized';
import { deepCopy, SlimdownView } from 'mithril-ui-form';
import {
  createCircleSVG,
  effectiveSelection,
  levelIndex,
  narrativeCoaRows,
  narrativeToMarkdown,
  narrativesToOptions,
  splitDecisionComponents,
  svgToDataURI,
  trafficLight,
  coaTitle,
} from '../utils';
import { htmlTemplate } from '../assets/html-styles';
import { ScenarioParagraph } from './ui/scenario-paragraph';
import { MapView } from './ui';
import { coaRiskText, conflictWarnings, ExportWordModal } from './ui/export-word';
import { MeiosisCell } from 'meiosis-setup/types';
import 'mithril-markdown-wysiwyg/css';

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
        m('table.highlight.category-table', { id }, [
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
          className: 'copy-table-btn',
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
  let wordModalOpen = false;
  const updateCurNarrative = (
    newNarrative: Narrative | undefined,
    attrs: MeiosisCell<State>,
    model: DataModel
  ) => {
    if (newNarrative) {
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
          includeMapSupport,
          mapConfig,
          mapUnits,
          osmAmenities,
          template,
          categories = [],
          components: modelComps = [],
          narratives = [],
          includeDecisionSupport,
        },
      } = model;
      const { situationCategories, decisionCategories } =
        splitDecisionComponents(model.scenario);
      const showDecisions =
        !!includeDecisionSupport && decisionCategories.length > 0;
      const coaRows = showDecisions
        ? narrativeCoaRows(model.scenario, curNarrative)
        : [];

      const selectedItems: ContextualItem[] = [];
      if (includeMapSupport && curNarrative && curNarrative.components) {
        const selection = effectiveSelection(model.scenario, curNarrative);
        modelComps.forEach((comp) => {
          const selectedIds = selection[comp.id];
          if (selectedIds) {
            const ids = Array.isArray(selectedIds) ? selectedIds : [selectedIds];
            ids.forEach((id) => {
              const item = comp.values?.find((v) => v.id === id);
              if (item) selectedItems.push(item);
            });
          }
        });
      }
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
      const markdown = narrativeToMarkdown(curNarrative?.desc).replace(
        /</g,
        '&lt;'
      );

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
                      trafficLight[+(curNarrative.risk?.toString().replace('risk_', '') || 0)],
                      48
                    )
                  ),
                }),
              m(FlatButton, {
                label: t('EXPORT2WORD', 'TITLE'),
                iconName: 'download',
                className: 'right export-word-btn',
                disabled: !curNarrative.desc,
                onclick: () => {
                  wordModalOpen = true;
                },
              }),
              m(InputCheckbox, {
                checked: curNarrative.included,
                label: t('NARRATIVE_INCLUDED'),
                disabled: true,
                className: 'right mt3',
              }),
              includeMapSupport && m(FlatButton, {
                  iconName: mapConfig?.height === 0 ? 'map' : 'map',
                  className: 'right',
                  title: t('TOGGLE_MAP'),
                  onclick: () => {
                      const h = mapConfig?.height || 400;
                      model.scenario.mapConfig = {
                          ...model.scenario.mapConfig!,
                          height: h === 0 ? 400 : 0
                      };
                      saveModel(attrs, model);
                  }
              }),
              m(ExportWordModal, {
                model,
                narrative: curNarrative,
                isOpen: wordModalOpen,
                onToggle: (open) => {
                  wordModalOpen = open;
                },
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
                  className: 'col s7 m8 l10 mb0 mw30',
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
                      updateCurNarrative(newNarrative, attrs, model);
                    }
                  },
                }),
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
                          updateCurNarrative(newNarrative, attrs, model);
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
                          updateCurNarrative(newNarrative, attrs, model);
                        }
                      },
                    },
                    'arrow_left'
                  )
                )
              )
            ),
            includeMapSupport && mapConfig?.height !== 0 &&
              m(
                '.col.s12',
                m(MapView, { 
                    items: selectedItems, 
                    mapConfig, 
                    mapUnits, 
                    osmAmenities, 
                    height: mapConfig?.height || 400, 
                    autoFit: true,
                    onHeightChange: (h) => {
                        model.scenario.mapConfig = { ...model.scenario.mapConfig!, height: h };
                        saveModel(attrs, model);
                    }
                })
              ),
            markdown && [
              m(
                '.col.s12',
                m(
                  '#editor.row.md-editable-area',
                  m(SlimdownView, {
                    md: markdown,
                  })
                )
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
            ],
            m(
              '.col.s12',
              m(
                '.category-tables',
                situationCategories.map((category) => {
                  const componentIds = category && category.componentIds;
                  const comps =
                    componentIds &&
                    modelComps.filter((c) => componentIds.indexOf(c.id) >= 0);
                  return m('.category-tables-item', [
                    multipleCategories ? m('h5', category.label) : m('div'),
                    m(CategoryTable, { curNarrative, comps }),
                  ]);
                })
              )
            ),
            showDecisions &&
              coaRows.length > 0 &&
              m(
                '.col.s12',
                m('.row', [
                  m('.col.s12', m('h4', t('DECISIONS'))),
                  coaRows.map((coa) =>
                    m('.col.s12.coa', [
                      coa.label &&
                        m('h5', [
                          coaTitle(coa.label, t('COURSE_OF_ACTION')),
                          coa.active &&
                            m('span.grey-text', ` (${t('COA_ACTIVE')})`),
                        ]),
                      coa.risk &&
                        m('p.coa-risk-summary', [
                          m('img', {
                            src: svgToDataURI(
                              createCircleSVG(trafficLight[levelIndex(coa.risk.after) ?? 0], 16)
                            ),
                            alt: '',
                            'aria-hidden': 'true',
                          }),
                          ' ',
                          coaRiskText(coa),
                        ]),
                      coa.desc && m('p', coa.desc),
                      coa.notes && m('p', coa.notes),
                      coa.conflicts.length > 0 &&
                        m(
                          'p.orange-text',
                          conflictWarnings(coa).join('; ')
                        ),
                      m(
                        '.row',
                        decisionCategories.map((category) => {
                          const componentIds = category.componentIds || [];
                          const comps = modelComps.filter((c) =>
                            componentIds.includes(c.id)
                          );
                          return m(
                            '.col',
                            {
                              className: `s${Math.round(12 / decisionCategories.length)}`,
                            },
                            m('h6', category.label),
                            m(CategoryTable, {
                              curNarrative: {
                                components: coa.id
                                  ? effectiveSelection(model.scenario, curNarrative!, coa.id)
                                  : curNarrative!.components,
                              } as Narrative,
                              comps,
                            })
                          );
                        })
                      ),
                    ])
                  ),
                ])
              ),
          ]
      );
    },
  };
};
