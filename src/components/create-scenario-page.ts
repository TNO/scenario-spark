import m, { FactoryComponent } from 'mithril';
import Quill from 'quill';
import {
  FlatButton,
  Icon,
  InputCheckbox,
  ModalPanel,
  Select,
  SelectAttrs,
  TextArea,
  TextInput,
  toast,
  uniqueId,
} from 'mithril-materialized';
import { Dashboards, ID, Narrative } from '../models';
import {
  MeiosisComponent,
  saveModel,
  saveNarrative,
  setPage,
  t,
  updateNarrative,
} from '../services';
import {
  deepCopy,
  generateNarrative,
  generateUniqueTitle,
  markdownToQuill,
  narrativesToOptions,
} from '../utils';
import { range } from 'mithril-ui-form';
import { ScenarioParagraph } from './ui/scenario-paragraph';
import { CircularSpinner, generateStory } from './ui';
import { PersonaImages } from '../models/persona-images';

const ToggleIcon: FactoryComponent<{
  on: string;
  off: string;
  value: boolean;
  disabled?: boolean;
  callback: (newValue: boolean) => void;
}> = () => {
  return {
    view: ({ attrs: { on, off, value, disabled, callback } }) => {
      const iconName = value ? on : off;
      return m(Icon, {
        className: `clickable${disabled ? ' grey-text' : ''}`,
        iconName,
        disabled,
        onclick: disabled ? {} : () => callback(!value),
      });
    },
  };
};

const calculateRisk = (narrative: Narrative) => {
  const { probability, impact } = narrative;
  if (typeof probability !== 'string' || typeof impact !== 'string') return;
  const p = +probability.replace(/[a-zA-Z_]/g, '');
  const i = +impact.replace(/[a-zA-Z_]/g, '');
  const riskMatrix: number[][] = [
    [0, 0, 1, 2, 3],
    [0, 1, 2, 3, 4],
    [1, 2, 3, 4, 4],
    [2, 3, 4, 4, 4],
    [3, 4, 4, 4, 4],
  ];
  narrative.risk = 'risk_' + riskMatrix[p][i];
  // console.log(
  //   `Risk = probability x impact: ${probability} x ${impact} = ${narrative.risk}`
  // );
};

export const CategoryTable: MeiosisComponent<{
  catId: ID;
  excluded: Set<string>;
}> = () => {
  let lockState = false;

  return {
    view: ({ attrs }) => {
      const {
        catId,
        excluded,
        state: {
          model,
          excludedComps = {},
          lockedComps = {},
          curNarrative = {} as Narrative,
        },
      } = attrs;
      const {
        scenario: { categories = [], components: modelComps = [] },
      } = model;
      const multipleCategories = categories.length > 1;
      const category = categories.filter((c) => c.id === catId).shift();
      const componentIds = category?.componentIds;
      const comps =
        componentIds &&
        modelComps.filter((c) => componentIds.indexOf(c.id) >= 0);

      const { components = {} } = curNarrative;

      return (
        category &&
        comps &&
        m('.scenario-table.row', [
          m(
            '.col.s10.m11',
            multipleCategories && m('h5.truncate', category.label)
          ),
          m('.col.s2.m1.icons', [
            m(ToggleIcon, {
              on: 'lock_open',
              off: 'lock',
              value: lockState,
              callback: (v) => {
                lockState = v;
                attrs.update({
                  lockedComps: (l = {}) => {
                    category?.componentIds?.forEach(
                      (id) => (l[id] = lockState)
                    );
                    return l;
                  },
                });
              },
            }),
          ]),
          comps.map((c) => [
            m(Select, {
              label: c.label,
              className: 'col s11',
              multiple: true,
              disabled:
                typeof excludedComps[c.id] !== 'undefined' &&
                excludedComps[c.id],
              checkedId: components[c.id],
              options: c.values?.filter((c) => !excluded.has(c.id)),
              placeholder: t('i18n', 'pick'),
              onchange: (ids) => {
                if (!curNarrative.components) {
                  curNarrative.components = {};
                }
                curNarrative.components[c.id] = ids;
                updateNarrative(attrs, curNarrative);
              },
            } as SelectAttrs<string>),
            ,
            m('.col.s1.icons', [
              m(ToggleIcon, {
                on: 'lock_open',
                off: 'lock',
                disabled: c.manual,
                value: c.manual || lockedComps[c.id] ? false : true,
                callback: (v) => {
                  attrs.update({
                    lockedComps: (e = {}) => {
                      e[c.id] = !v;
                      return e;
                    },
                  });
                },
              }),
            ]),
          ]),
        ])
      );
    },
  };
};

export const CreateScenarioPage: MeiosisComponent = () => {
  let editor: Quill;
  let lockState = false;
  let version = 0;
  let askLlm = true;
  let showTables = true;
  let deleteSavedNarrative = false;

  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.CREATE_SCENARIO),
    view: ({ attrs }) => {
      const {
        state: { model, curNarrative = {} as Narrative, lockedComps = {} },
      } = attrs;
      const { personas: allPersonas = [] } = model;
      const {
        template,
        categories = [],
        inconsistencies = {},
        hideInconsistentValues = false,
        llm,
        personas = [],
        includeDecisionSupport,
      } = model.scenario;
      const curPersonas =
        includeDecisionSupport && personas.length > 0
          ? allPersonas.filter((p) => personas.includes(p.id))
          : [];
      // console.log(curPersonas);
      const narratives = model.scenario && model.scenario.narratives;
      const excluded =
        curNarrative.components && hideInconsistentValues
          ? Object.keys(curNarrative.components)
              .filter((cur) => curNarrative.components[cur])
              .reduce((acc, cur) => {
                curNarrative.components[cur].forEach(
                  (v) =>
                    inconsistencies[v] &&
                    Object.keys(inconsistencies[v]).forEach(
                      (id) => inconsistencies[v][id] && acc.add(id)
                    )
                );
                return acc;
              }, new Set<string>())
          : new Set<string>();
      const selectOptions = narrativesToOptions(model.scenario.narratives);
      const count = llm?.autoLLMCount || 10;

      return m('.create-scenario.row', [
        m('.col.s12', [
          m(FlatButton, {
            label: t('GENERATE_NARRATIVE'),
            iconName: 'refresh',
            onclick: () => {
              const { components = {} } = curNarrative;
              const locked = components
                ? Object.keys(lockedComps).reduce((acc, cur) => {
                    if (lockedComps[cur]) {
                      acc[cur] = components[cur];
                    }
                    return acc;
                  }, {} as Record<ID, ID[]>)
                : ({} as Record<ID, ID[]>);
              model.scenario.components
                .filter((c) => c.manual)
                .forEach((c) => {
                  locked[c.id] = components[c.id];
                });
              const narrative = generateNarrative(model.scenario, locked);
              if (!narrative) {
                alert(t('NO_NARRATIVE'));
              } else {
                version++;
                attrs.update({ curNarrative: () => narrative });
              }
            },
          }),
          m(FlatButton, {
            label: t('CLEAR_NARRATIVE'),
            iconName: 'clear',
            style: 'margin-left: 10px;',
            onclick: () => {
              version = version === 0 ? 1 : 0;
              editor.setContents([] as any);
              attrs.update({
                lockedComps: () => ({}),
                curNarrative: () => ({ included: false } as Narrative),
              });
            },
          }),
          model.scenario.llm && [
            m(FlatButton, {
              label: t('ASK_LLM'),
              iconName: 'auto_awesome',
              style: 'margin-left: 10px;',
              disabled: !curNarrative.components || !askLlm,
              onclick: async () => {
                askLlm = false;
                curNarrative.label = '';
                curNarrative.desc = '';
                editor.setContents(markdownToQuill(''));
                const story = await generateStory(
                  model.scenario.llm!,
                  curNarrative,
                  model.scenario.categories,
                  model.scenario.components
                ).catch((e) => {
                  console.error(e);
                  toast({ html: e });
                  askLlm = true;
                  m.redraw();
                  return;
                });
                console.log(story);
                askLlm = true;
                if (story) {
                  const quill = markdownToQuill(
                    typeof story === 'string' ? story : story.content
                  );
                  editor.setContents(quill);
                  if (typeof story !== 'string') {
                    curNarrative.label = story.title;
                  }
                }
                m.redraw();
              },
            }),
            m(FlatButton, {
              label: t('AUTO_CREATE', 'BTN'),
              title: t('AUTO_CREATE_MSG', +count),
              iconName: 'auto_awesome_motion',
              disabled: !curNarrative.components || !askLlm,
              onclick: async () => {
                askLlm = false;
                const { components = {} } = curNarrative;
                const locked = components
                  ? Object.keys(lockedComps).reduce((acc, cur) => {
                      if (lockedComps[cur]) {
                        acc[cur] = components[cur];
                      }
                      return acc;
                    }, {} as Record<ID, ID[]>)
                  : ({} as Record<ID, ID[]>);
                model.scenario.components
                  .filter((c) => c.manual)
                  .forEach((c) => {
                    locked[c.id] = components[c.id];
                  });

                let attempt = 0;
                while (attempt < count) {
                  const narrative = generateNarrative(model.scenario, locked);
                  if (narrative) {
                    const story = await generateStory(
                      model.scenario.llm!,
                      narrative,
                      model.scenario.categories,
                      model.scenario.components
                    ).catch((e) => {
                      console.error(e);
                      toast({ html: e });
                      askLlm = true;
                      m.redraw();
                      return;
                    });
                    console.log(story);
                    if (story) {
                      attempt++;
                      const quill = markdownToQuill(
                        typeof story === 'string' ? story : story.content
                      );
                      editor.setContents(quill);
                      narrative.desc = JSON.stringify(editor.getContents());
                      if (typeof story !== 'string') {
                        toast({ html: `${attempt}. ${story.title}` });
                        narrative.label = story.title;
                      } else {
                        toast({ html: `${attempt}. ${story}` });
                      }
                      saveNarrative(attrs, narrative);
                      m.redraw();
                    }
                  }
                }
                askLlm = true;
              },
            }),
          ],
          curNarrative.saved
            ? [
                m(FlatButton, {
                  label: t('CLONE_NARRATIVE'),
                  iconName: 'content_copy',
                  style: 'margin-left: 10px;',
                  onclick: () => {
                    const newNarrative: Narrative = deepCopy(curNarrative);
                    newNarrative.id = uniqueId();
                    newNarrative.saved = false;
                    newNarrative.label = generateUniqueTitle(
                      curNarrative.label,
                      model.scenario.narratives?.map((n) => n.label)
                    );
                    saveNarrative(attrs, newNarrative);
                  },
                }),
                m(FlatButton, {
                  label: t('DELETE'),
                  iconName: 'delete',
                  onclick: () => (deleteSavedNarrative = true),
                }),
                m(ModalPanel, {
                  id: 'deleteSavedNarrative',
                  title: t('DELETE_ITEM', 'title', { item: t('NARRATIVE') }),
                  onClose: () => (deleteSavedNarrative = false),
                  description: t('DELETE_ITEM', 'description', {
                    item: t('NARRATIVE'),
                  }),
                  isOpen: deleteSavedNarrative,
                  buttons: [
                    {
                      label: t('CANCEL'),
                    },
                    {
                      label: t('OK'),
                      onclick: () => {
                        version = 0;
                        model.scenario.narratives =
                          model.scenario.narratives.filter(
                            (n) => n.id !== curNarrative.id
                          );
                        lockState = true;
                        editor.setContents([]);
                        lockState = false;
                        attrs.update({
                          curNarrative: () =>
                            ({ included: false, components: {} } as Narrative),
                          lockedComps: () => undefined,
                        });
                        saveModel(attrs, model);
                      },
                    },
                  ],
                }),
              ]
            : [
                m(FlatButton, {
                  label: t('SAVE_NARRATIVE'),
                  iconName: 'save',
                  disabled:
                    !curNarrative.label ||
                    !curNarrative.components ||
                    Object.keys(curNarrative.components).length === 0,
                  onclick: () => {
                    saveNarrative(attrs, curNarrative);
                  },
                }),
              ],
          narratives && [
            m(Select, {
              className: 'right mb0 w30',
              label: t('SELECT_NARRATIVE'),
              checkedId: curNarrative.saved ? curNarrative.id : undefined,
              placeholder: t('i18n', 'pickOne'),
              options: selectOptions,
              onchange: (v) => {
                if (v && v.length > 0) {
                  version++;
                  const newNarrative = narratives
                    .filter((n) => n.id === v[0])
                    .shift();
                  lockState = true;
                  try {
                    editor.setContents(
                      newNarrative && newNarrative.desc
                        ? JSON.parse(newNarrative.desc)
                        : []
                    );
                  } catch {}
                  lockState = false;
                  // if (newNarrative) newNarrative.included = true;
                  attrs.update({
                    curNarrative: () => newNarrative,
                    lockedComps: () =>
                      model.scenario.components.reduce((acc, cur) => {
                        acc[cur.id] = true;
                        return acc;
                      }, {} as Record<ID, boolean>),
                  });
                }
              },
            } as SelectAttrs<string>),
          ],
        ]),
        template
          ? m(ScenarioParagraph, {
              ...attrs,
              template,
              className: 'col s12',
            })
          : '',
        askLlm === false && m(CircularSpinner),

        showTables &&
          categories.map((c, i) =>
            m(
              '.col.s12',
              {
                className: `m${Math.round(12 / categories.length)}`,
                key: 10000 * version + i,
              },
              m(CategoryTable, {
                ...attrs,
                catId: c.id,
                excluded,
              })
            )
          ),
        m(
          '.col.s12',
          m(
            'i.right.material-icons.small.clickable',
            {
              title: t('TOGGLE', showTables ? 'HIDE' : 'SHOW'),
              className: 'right',
              // style: { marginBottom: '-14px' },
              onclick: () => {
                showTables = !showTables;
              },
            },
            showTables ? 'visibility_off' : 'visibility'
          )
        ),
        m('.col.s12', [
          m('.row', [
            m(TextInput, {
              className: 'col s6 m4',
              defaultValue: curNarrative.label,
              label: t('NAME_NARRATIVE'),
              required: true,
              onchange: (n) => {
                curNarrative.label = n;
                updateNarrative(attrs, curNarrative);
              },
            }),
            m(InputCheckbox, {
              className: 'col s6 m2 mt25',
              checked: curNarrative.included,
              label: t('INCLUDE_NARRATIVE'),
              onchange: (n) => {
                curNarrative.included = n;
                updateNarrative(attrs, curNarrative);
              },
            }),
            includeDecisionSupport && [
              m(Select, {
                key: `prob${curNarrative.id}`,
                placeholder: t('i18n', 'pick'),
                className: 'col s6 m2',
                label: t('PROBABILITY'),
                checkedId: curNarrative.probability,
                options: range(0, 4).map((id) => ({
                  id: `probability_${id}`,
                  label: t('PROB5', id),
                })),
                onchange: (n) => {
                  curNarrative.probability = n[0];
                  calculateRisk(curNarrative);
                  updateNarrative(attrs, curNarrative);
                },
              } as SelectAttrs<string>),
              m(Select, {
                key: `imp${curNarrative.id}`,
                placeholder: t('i18n', 'pick'),
                className: 'col s6 m2',
                label: t('IMPACT'),
                checkedId: curNarrative.impact,
                options: range(0, 4).map((id) => ({
                  id: `impact_${id}`,
                  label: t('IMP5', id),
                })),
                onchange: (n) => {
                  curNarrative.impact = n[0];
                  calculateRisk(curNarrative);
                  updateNarrative(attrs, curNarrative);
                },
              } as SelectAttrs<string>),
              m(Select, {
                key: `${curNarrative.id}-${curNarrative.probability}-${curNarrative.impact}`,
                placeholder: t('RISK_PLACEHOLDER'),
                className: 'col s6 m2',
                label: t('RISK'),
                checkedId: curNarrative.risk,
                options: range(0, 4).map((id) => ({
                  id: `risk_${id}`,
                  label: t('RISK5', id),
                  // img: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMi4zNzggNTAuMDEzQTQ3Ljc0NSA0Ny42NjMgMCAwMTUwLjE0NCAyLjM3OGE0Ny43NDUgNDcuNjYzIDAgMDE0Ny43MjMgNDcuNjc3IDQ3Ljc0NSA0Ny42NjMgMCAwMS00Ny43NTEgNDcuNjQ5QTQ3Ljc0NSA0Ny42NjMgMCAwMTIuMzc4IDUwLjA0IiBmaWxsPSIjZDcxOTFjIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSI0LjA3MiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+',
                  // img: svgToDataURI(createCircleSVG(trafficLight[id], 30)),
                })),
                disabled: true,
              } as SelectAttrs<string>),
            ],
          ]),
          // m('#toolbar'),
          [
            m('#editor', {
              oncreate: () => {
                editor = new Quill('#editor', {
                  // debug: 'info',
                  modules: {
                    // table: true,
                    toolbar: [
                      [{ header: [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ list: 'ordered' }, { list: 'bullet' }],
                      [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
                      [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
                      [
                        { color: [] },
                        // , { background: [] }
                      ], // dropdown with defaults from theme
                      // [{ font: [] }],
                      [{ align: [] }],
                      // [{ size: ['small', false, 'large', 'huge'] }],
                      ['image', 'code-block'],
                    ],
                  },
                  placeholder: t('EDITOR_PLACEHOLDER'),
                  readOnly: false,
                  theme: 'snow',
                });
                editor.on('text-change', () => {
                  if (lockState) return;
                  const { curNarrative } = attrs.getState();
                  if (!curNarrative) return;
                  curNarrative.desc = JSON.stringify(editor.getContents());

                  console.log(curNarrative.desc);

                  updateNarrative(attrs, curNarrative);
                });
                if (curNarrative) {
                  editor.setContents(
                    curNarrative.desc ? JSON.parse(curNarrative.desc) : []
                  );
                }
              },
            }),
          ],
          [
            curPersonas.map((p) =>
              m('.row.persona', [
                m('.col.s12', m('h5', p.label)),
                m('.col.s6', [
                  m('img.reponsive-image', {
                    style: { height: '200px' },
                    src: PersonaImages.find((img) => img.id === p.url)?.img,
                    alt: p.label,
                  }),
                  m('p', p.desc),
                ]),
                m(
                  '.col.s6',
                  m(TextArea, {
                    label: t('PERSONA_IMPRESSION'),
                    defaultValue: curNarrative.personaEffects
                      ? curNarrative.personaEffects[p.id]?.story
                      : undefined,
                    onchange: (story) => {
                      const found =
                        curNarrative.personaEffects &&
                        curNarrative.personaEffects[p.id];
                      console.log(found);
                      if (found) {
                        found.story = story;
                      } else if (curNarrative.personaEffects) {
                        curNarrative.personaEffects[p.id] = { scale: 0, story };
                      } else {
                        curNarrative.personaEffects = {
                          [p.id]: { scale: 0, story },
                        };
                      }
                      updateNarrative(attrs, curNarrative);
                    },
                  })
                ),
              ])
            ),
            // curPersonas.length > 0 && [

            //   m(LayoutForm, {
            //     obj: curNarrative,
            //     form: [],
            //     onchange: () => {
            //       updateNarrative(attrs, curNarrative);
            //     }
            //   })
            // ]
          ],
        ]),
      ]);
    },
  };
};
