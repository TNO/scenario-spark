import m, { FactoryComponent } from 'mithril';
import {
  ConfirmButton,
  FlatButton,
  Icon,
  IconButton,
  InputCheckbox,
  Select,
  SelectAttrs,
  TextArea,
  TextInput,
  ThemeManager,
  toast,
  uniqueId,
} from 'mithril-materialized';
import {
  ContextualItem,
  Dashboards,
  ID,
  Narrative,
  ScenarioComponent,
} from '../models';
import {
  MeiosisComponent,
  saveModel,
  saveNarrative,
  setPage,
  t,
  updateNarrative,
  setMapHeight,
} from '../services';
import {
  ExclusionCause,
  GenerationDiagnostic,
  activeCoa,
  addCoa,
  appendReflection,
  coaConflicts,
  decisionExclusions,
  deepCopy,
  duplicateCoa,
  effectiveSelection,
  ensureActiveCoa,
  nextCoaLabel,
  removeCoa,
  reflectionTarget,
  generateNarrative,
  generateUniqueTitle,
  generationLocks,
  narrativesToOptions,
  splitDecisionComponents,
  updateRisk,
} from '../utils';
import { range, render } from 'mithril-ui-form';
import type { MeiosisCell } from 'meiosis-setup/types';
import type { State } from '../services';
import { listInconsistencies } from 'morphological-box';
import { ScenarioParagraph } from './ui/scenario-paragraph';
import {
  CircularSpinner,
  ensureDefaultLLMConfig,
  generateStory,
  MapView,
} from './ui';
import { PersonaImages } from '../models/persona-images';
import { MarkdownEditor } from 'mithril-markdown-wysiwyg';
import { narrativeToMarkdown } from '../utils/index';

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

export const CategoryTable: MeiosisComponent<{
  catId: ID;
  excluded: Set<string>;
  /** Decision table: excluded values (with their cause) are greyed out, no lock icons */
  decision?: {
    exclusions: Record<ID, ExclusionCause[]>;
    hide: boolean;
    /** Decisions of the active course of action */
    selection: Record<ID, ID[]>;
    onchange: (componentId: ID, ids: ID[]) => void;
  };
}> = () => {
  let lockState = false;

  return {
    view: ({ attrs }) => {
      const {
        catId,
        excluded,
        decision,
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

      const components = decision
        ? decision.selection
        : curNarrative.components || {};

      const toOptions = (comp: ScenarioComponent) => {
        const values = comp.values || [];
        if (!decision) return values.filter((v) => !excluded.has(v.id));
        const selected = components[comp.id] || [];
        return values
          .filter(
            (v) =>
              !decision.hide ||
              !decision.exclusions[v.id] ||
              selected.includes(v.id),
          )
          .map((v) => {
            const causes = decision.exclusions[v.id];
            if (!causes) return v;
            const reason = t('EXCLUDED_BY', {
              situation: causes.map((c) => c.label).join(', '),
            });
            return {
              ...v,
              label: `${v.label} (${reason})`,
              title: reason,
              disabled: !selected.includes(v.id),
            };
          });
      };

      return (
        category &&
        comps &&
        m('.scenario-table.row', [
          m(
            '.col.s10.m11',
            multipleCategories && m('h5.truncate', category.label),
          ),
          m('.col.s2.m1.icons', [
            !decision &&
              m(ToggleIcon, {
                on: 'lock_open',
                off: 'lock',
                value: lockState,
                callback: (v) => {
                  lockState = v;
                  attrs.update({
                    lockedComps: (l = {}) => {
                      category?.componentIds?.forEach(
                        (id) => (l[id] = lockState),
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
              options: toOptions(c),
              placeholder: t('i18n', 'pick'),
              onchange: (ids) => {
                if (decision) {
                  decision.onchange(c.id, Array.isArray(ids) ? ids : []);
                  return;
                }
                if (!curNarrative.components) {
                  curNarrative.components = {};
                }
                curNarrative.components[c.id] = Array.isArray(ids) ? ids : [];
                updateNarrative(attrs, curNarrative);
              },
            } as SelectAttrs<string>),
            ,
            m('.col.s1.icons', [
              !decision &&
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
  let version = 0;
  let askLlm = true;
  let showTables = true;
  let canAskLlm = false;
  let showMap = true; // Default to showing the map
  let editingNarrativeTitle = false;
  let narrativeTitleDraft = '';
  let editingCoaName = false;
  let coaNameDraft = '';

  /** Chips per course of action, with add, duplicate, rename, delete and conflict warnings */
  const coaBar = (
    attrs: MeiosisCell<State>,
    narrative: Narrative,
    onSwitch: () => void,
  ) => {
    const { scenario } = attrs.state.model;
    const coas = narrative.coas || [];
    const current = activeCoa(narrative);
    const save = () => updateNarrative(attrs, narrative);
    const conflicts = coaConflicts(scenario, narrative, current);
    const commitName = () => {
      const label = coaNameDraft.trim();
      if (!label || !current) return;
      current.label = label;
      editingCoaName = false;
      save();
    };
    return [
      m('.coa-chips', [
        m('span.coa-title', `${t('COURSES_OF_ACTION')}: `),
        coas.length === 0
          ? m('.chip.blue.white-text', nextCoaLabel([]))
          : coas.map((c) => {
              const hasConflicts =
                coaConflicts(scenario, narrative, c).length > 0;
              return m(
                '.chip.clickable',
                {
                  className: c === current ? 'blue white-text' : '',
                  onclick: () => {
                    if (c === current) return;
                    narrative.activeCoaId = c.id;
                    onSwitch();
                    save();
                  },
                },
                [
                  c.label,
                  hasConflicts &&
                    m(
                      'i.material-icons.tiny.orange-text',
                      {
                        title: t('COA_HAS_CONFLICTS'),
                        style: 'margin-left: 4px; vertical-align: middle;',
                      },
                      'warning',
                    ),
                ],
              );
            }),
        m(FlatButton, {
          label: t('ADD_COA'),
          iconName: 'add',
          onclick: () => {
            ensureActiveCoa(narrative);
            addCoa(narrative);
            onSwitch();
            save();
          },
        }),
        m(FlatButton, {
          label: t('DUPLICATE_COA'),
          iconName: 'content_copy',
          onclick: () => {
            duplicateCoa(narrative);
            onSwitch();
            save();
          },
        }),
        current &&
          !editingCoaName &&
          m(IconButton, {
            iconName: 'edit',
            title: t('RENAME_COA'),
            onclick: () => {
              editingCoaName = true;
              coaNameDraft = current.label;
            },
          }),
        current &&
          m(ConfirmButton, {
            title: t('DELETE_COA'),
            onclick: () => {
              removeCoa(narrative, current.id);
              onSwitch();
              save();
            },
          }),
      ]),
      editingCoaName &&
        current &&
        m(TextInput, {
          className: 'coa-name',
          value: coaNameDraft,
          label: t('COA_NAME'),
          required: true,
          oninput: (v: string) => {
            coaNameDraft = v;
          },
          onkeypress: (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            commitName();
          },
          onblur: commitName,
        }),
      conflicts.length > 0 &&
        m(
          'ul.orange-text.coa-conflicts',
          conflicts.map((c) =>
            m(
              'li',
              t('COA_CONFLICT', {
                value: c.label,
                situation: c.causes.map((s) => s.label).join(', '),
              }),
            ),
          ),
        ),
    ];
  };

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.CREATE_SCENARIO);
      const { model } = attrs.state;
      if (
        model.scenario.llm &&
        ensureDefaultLLMConfig(model.scenario, model.scenario.categories || [])
      ) {
        void saveModel(attrs, model);
      }
    },
    view: ({ attrs }) => {
      const {
        state: { model, curNarrative = {} as Narrative, lockedComps = {} },
      } = attrs;
      const { personas: allPersonas = [] } = model;
      const {
        template,
        inconsistencies = {},
        hideInconsistentValues = false,
        llm,
        personas = [],
        includeDecisionSupport,
      } = model.scenario;

      const hasNarrative =
        curNarrative.components &&
        Object.keys(curNarrative.components).length > 0;
      canAskLlm =
        (hasNarrative &&
          llm &&
          llm.prompts &&
          llm.prompts.some((p) => p.type === 'narrative')) ??
        false;
      const curPersonas = allPersonas.filter((p) => personas.includes(p.id));
      // console.log(curPersonas);
      const narratives = model.scenario && model.scenario.narratives;
      const { situationCategories, decisionCategories, decisionIds } =
        splitDecisionComponents(model.scenario);
      const showDecisions =
        !!includeDecisionSupport && decisionCategories.length > 0;
      const coa = activeCoa(curNarrative);
      const excluded = new Set<string>();
      if (curNarrative.components && hideInconsistentValues) {
        // Only the situation constrains the visible options; decisions follow it
        const selected = new Set(
          Object.entries(curNarrative.components)
            .filter(([id, v]) => !decisionIds.has(id) && Array.isArray(v))
            .flatMap(([, v]) => v),
        );
        for (const { a, b, type } of listInconsistencies(inconsistencies)) {
          if (type !== 'impossible') continue;
          if (selected.has(a)) excluded.add(b);
          if (selected.has(b)) excluded.add(a);
        }
      }
      const selectOptions = narrativesToOptions(model.scenario.narratives);
      // const count = llm?.autoLLMCount || 10;
      const markdown = narrativeToMarkdown(curNarrative?.desc);
      const personaPromptReady =
        !!llm?.prompts?.some((p) => p.type === 'persona' && p.prompt?.trim());
      const decisionPromptReady =
        !!llm?.prompts?.some((p) => p.type === 'decision' && p.prompt?.trim());

      const {
        includeMapSupport = false,
        mapConfig,
        mapUnits,
        osmAmenities,
      } = model.scenario;
      const selectedItems: ContextualItem[] = [];
      if (includeMapSupport && curNarrative.components) {
        const selection = effectiveSelection(model.scenario, curNarrative);
        model.scenario.components.forEach((comp) => {
          const selectedIds = selection[comp.id];
          if (selectedIds) {
            const ids = Array.isArray(selectedIds)
              ? selectedIds
              : [selectedIds];
            ids.forEach((id) => {
              const item = comp.values?.find((v) => v.id === id);
              if (item) selectedItems.push(item);
            });
          }
        });
      }

      return m('.create-scenario.row', [
        m('.col.s12', [
          m(FlatButton, {
            label: t('GENERATE_NARRATIVE'),
            iconName: 'refresh',
            onclick: () => {
              const { components = {} } = curNarrative;
              const nonManualComps = model.scenario.components.filter(
                (c) => !c.manual && !decisionIds.has(c.id),
              );
              const allLocked =
                nonManualComps.length > 0 &&
                nonManualComps.every((c) => lockedComps[c.id]);
              if (allLocked) {
                toast({ html: t('ALL_LOCKED_WARNING') });
                return;
              }
              const locked = generationLocks(
                model.scenario,
                components,
                lockedComps,
              );
              const narrative = generateNarrative(model.scenario, locked);
              if (!narrative || (narrative as { error?: boolean }).error) {
                const diag = (
                  narrative as { diagnostic?: GenerationDiagnostic }
                )?.diagnostic;
                let msg = t('NO_NARRATIVE');
                if (diag?.blockedComponents.length) {
                  const worst = diag.blockedComponents[0];
                  msg += `\n\nMost constrained: "${worst.componentLabel}" (${worst.availableValues}/${worst.totalValues} values available).`;
                  if (diag.totalConstraints > 0) {
                    msg += `\nTotal inconsistency constraints: ${diag.totalConstraints}.`;
                  }
                }
                alert(msg);
              } else {
                version++;
                const generated = narrative as Narrative;
                // Keep the courses of action: conflicts with the new situation are flagged
                if (curNarrative.coas) {
                  generated.coas = deepCopy(curNarrative.coas);
                  generated.activeCoaId = curNarrative.activeCoaId;
                }
                attrs.update({ curNarrative: () => generated });
              }
            },
          }),
          m(FlatButton, {
            label: t('CLEAR_NARRATIVE'),
            iconName: 'clear',
            style: 'margin-left: 10px;',
            onclick: () => {
              version++;
              editingNarrativeTitle = false;
              attrs.update({
                lockedComps: () => ({}),
                curNarrative: () =>
                  ({
                    id: uniqueId(),
                    included: false,
                    components: {},
                    saved: false,
                    label: '',
                    desc: '',
                  }) as Narrative,
              });
            },
          }),

          includeMapSupport &&
            m(FlatButton, {
              label: t('TOGGLE', showMap ? 'HIDE' : 'SHOW'),
              iconName: 'map',
              style: 'margin-left: 10px;',
              onclick: () => (showMap = !showMap),
            }),
          canAskLlm && [
            m(FlatButton, {
              label: t('ASK_LLM'),
              iconName: 'auto_awesome',
              style: 'margin-left: 10px;',
              disabled: !curNarrative.components || !askLlm,
              onclick: async () => {
                askLlm = false;
                const story = await generateStory(
                  model.scenario.llm!,
                  curNarrative,
                  model.scenario,
                ).catch((e) => {
                  console.error(e);
                  toast({ html: e });
                  askLlm = true;
                  m.redraw();
                  return;
                });
                console.log(story);
                askLlm = true;
                if (model.scenario.llm?.id === 'clipboard') {
                  // copy story to clipboard
                  if (story && navigator.clipboard) {
                    navigator.clipboard.writeText(story);
                  }
                  toast({ html: t('COPY_BOX', 'TOAST') });
                  return;
                }
                if (story) {
                  curNarrative.desc = story;
                }
                m.redraw();
              },
            }),
            // m(FlatButton, {
            //   label: t('AUTO_CREATE', 'BTN'),
            //   title: t('AUTO_CREATE_MSG', +count),
            //   iconName: 'auto_awesome_motion',
            //   disabled: !curNarrative.components || !askLlm,
            //   onclick: async () => {
            //     askLlm = false;
            //     const { components = {} } = curNarrative;
            //     const locked = components
            //       ? Object.keys(lockedComps).reduce((acc, cur) => {
            //           if (lockedComps[cur]) {
            //             acc[cur] = components[cur];
            //           }
            //           return acc;
            //         }, {} as Record<ID, ID[]>)
            //       : ({} as Record<ID, ID[]>);
            //     model.scenario.components
            //       .filter((c) => c.manual)
            //       .forEach((c) => {
            //         locked[c.id] = components[c.id];
            //       });

            //     let attempt = 0;
            //     while (attempt < count) {
            //       const narrative = generateNarrative(model.scenario, locked);
            //       if (narrative) {
            //         const story = await generateStory(
            //           model.scenario.llm!,
            //           narrative,
            //           model.scenario
            //         ).catch((e) => {
            //           console.error(e);
            //           toast({ html: e });
            //           askLlm = true;
            //           m.redraw();
            //           return;
            //         });
            //         console.log(story);
            //         if (story) {
            //           attempt++;
            //           const quill = markdownToQuill(
            //             typeof story === 'string' ? story : story.content
            //           );
            //           editor.setContents(quill);
            //           narrative.desc = JSON.stringify(editor.getContents());
            //           if (typeof story !== 'string') {
            //             toast({ html: `${attempt}. ${story.title}` });
            //             narrative.label = story.title;
            //           } else {
            //             toast({ html: `${attempt}. ${story}` });
            //           }
            //           saveNarrative(attrs, narrative);
            //           m.redraw();
            //         }
            //       }
            //     }
            //     askLlm = true;
            //   },
            // }),
          ],
          narratives && [
            m('.right.valign-wrapper', { key: curNarrative.id }, [
              curNarrative.saved &&
                m(IconButton, {
                  iconName: 'content_copy',
                  title: `${t('CLONE_NARRATIVE')} ${t('NARRATIVE').toLowerCase()}`,
                  style: 'margin-right: 8px;',
                  onclick: () => {
                    const newNarrative: Narrative = deepCopy(curNarrative);
                    newNarrative.id = uniqueId();
                    newNarrative.saved = false;
                    newNarrative.label = generateUniqueTitle(
                      curNarrative.label,
                      model.scenario.narratives?.map((n) => n.label),
                    );
                    saveNarrative(attrs, newNarrative);
                  },
                }),
              curNarrative.saved &&
                m(ConfirmButton, {
                  title: `${t('DELETE')} ${t('NARRATIVE').toLowerCase()}`,
                  onclick: () => {
                    version = 0;
                    model.scenario.narratives =
                      model.scenario.narratives.filter(
                        (n) => n.id !== curNarrative.id,
                      );
                    attrs.update({
                      curNarrative: () =>
                        ({ included: false, components: {} }) as Narrative,
                      lockedComps: () => undefined,
                    });
                    saveModel(attrs, model);
                  },
                }),
              hasNarrative &&
                !editingNarrativeTitle &&
                m(IconButton, {
                  iconName: 'edit',
                  title: t('NAME_NARRATIVE'),
                  onclick: () => {
                    editingNarrativeTitle = true;
                    narrativeTitleDraft = curNarrative.label || '';
                  },
                }),
              editingNarrativeTitle
                ? m(TextInput, {
                    value: narrativeTitleDraft,
                    label: t('NAME_NARRATIVE'),
                    required: true,
                    oninput: (n) => {
                      narrativeTitleDraft = n;
                    },
                    onkeypress: (e: KeyboardEvent) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const title = (narrativeTitleDraft || '').trim();
                      if (!title) return;
                      curNarrative.label = title;
                      saveNarrative(attrs, curNarrative);
                      editingNarrativeTitle = false;
                    },
                    onblur: () => {
                      if (!editingNarrativeTitle) return;
                      const title = (narrativeTitleDraft || '').trim();
                      if (!title) return;
                      curNarrative.label = title;
                      saveNarrative(attrs, curNarrative);
                      editingNarrativeTitle = false;
                    },
                  })
                : m(Select, {
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
                        editingNarrativeTitle = false;
                        attrs.update({
                          curNarrative: () => newNarrative,
                          lockedComps: () =>
                            model.scenario.components.reduce(
                              (acc, cur) => {
                                acc[cur.id] = true;
                                return acc;
                              },
                              {} as Record<ID, boolean>,
                            ),
                        });
                      }
                    },
                  } as SelectAttrs<string>),
            ]),
          ],
        ]),
        includeMapSupport &&
          showMap &&
          m(
            '.col.s12',
            m(MapView, {
              items: selectedItems,
              mapConfig,
              mapUnits,
              osmAmenities,
              height: attrs.state.mapHeight || 400,
              onHeightChange: (h) => setMapHeight(attrs, h),
              autoFit: true,
            }),
          ),
        template && hasNarrative
          ? m(ScenarioParagraph, {
              ...attrs,
              template,
              className: 'col s12',
            })
          : '',
        askLlm === false && m(CircularSpinner),

        showTables &&
          situationCategories.map((c, i) =>
            m(
              '.col.s12',
              {
                className: `m${Math.round(12 / situationCategories.length)}`,
                key: 10000 * version + i,
              },
              m(CategoryTable, {
                ...attrs,
                catId: c.id,
                excluded,
              }),
            ),
          ),
        showTables &&
          showDecisions && [
            m('.col.s12', [
              m('h5', t('DECISIONS')),
              m('p.grey-text', t('DECISIONS_HINT')),
            ]),
            m(
              '.col.s12.coa-bar',
              coaBar(attrs, curNarrative, () => {
                version++;
                editingCoaName = false;
              }),
            ),
            decisionCategories.map((c, i) =>
              m(
                '.col.s12',
                {
                  className: `m${Math.round(12 / decisionCategories.length)}`,
                  key: `${10000 * version + situationCategories.length + i}-${coa?.id || ''}`,
                },
                m(CategoryTable, {
                  ...attrs,
                  catId: c.id,
                  excluded,
                  decision: {
                    exclusions: decisionExclusions(
                      model.scenario,
                      curNarrative.components,
                    ),
                    hide: hideInconsistentValues,
                    selection: coa?.components || {},
                    onchange: (componentId, ids) => {
                      ensureActiveCoa(curNarrative).components[componentId] =
                        ids;
                      updateNarrative(attrs, curNarrative);
                    },
                  },
                }),
              ),
            ),
            m('.col.s12.coa-risk', [
              m('p.grey-text', t('COA_RISK_HINT')),
              m('.row', [
                m(Select, {
                  key: `coa-prob-${coa?.id || ''}`,
                  placeholder: t('i18n', 'pick'),
                  className: 'col s12 m4',
                  label: t('RESIDUAL_PROBABILITY'),
                  checkedId: coa?.probability,
                  options: range(0, 4).map((id) => ({
                    id: `probability_${id}`,
                    label: t('PROB5', id),
                  })),
                  onchange: (n) => {
                    const target = ensureActiveCoa(curNarrative);
                    target.probability = n[0];
                    updateRisk(target);
                    updateNarrative(attrs, curNarrative);
                  },
                } as SelectAttrs<string>),
                m(Select, {
                  key: `coa-imp-${coa?.id || ''}`,
                  placeholder: t('i18n', 'pick'),
                  className: 'col s12 m4',
                  label: t('RESIDUAL_IMPACT'),
                  checkedId: coa?.impact,
                  options: range(0, 4).map((id) => ({
                    id: `impact_${id}`,
                    label: t('IMP5', id),
                  })),
                  onchange: (n) => {
                    const target = ensureActiveCoa(curNarrative);
                    target.impact = n[0];
                    updateRisk(target);
                    updateNarrative(attrs, curNarrative);
                  },
                } as SelectAttrs<string>),
                m(Select, {
                  key: `coa-risk-${coa?.id || ''}-${coa?.probability}-${coa?.impact}`,
                  placeholder: t('RISK_PLACEHOLDER'),
                  className: 'col s12 m4',
                  label: t('RESIDUAL_RISK'),
                  checkedId: coa?.risk,
                  options: range(0, 4).map((id) => ({
                    id: `risk_${id}`,
                    label: t('RISK5', id),
                  })),
                  disabled: true,
                } as SelectAttrs<string>),
              ]),
            ]),
            coa &&
              m(
                '.col.s12',
                // TextArea forwards `key` to its inner <textarea>, so key a wrapping fragment instead.
                m.fragment({ key: coa.id }, [
                  m(TextArea, {
                    label: t('COA_NOTES'),
                    value: coa.notes,
                    oninput: (notes: string) => {
                      coa.notes = notes;
                      updateNarrative(attrs, curNarrative);
                    },
                  }),
                ]),
              ),
            coa &&
              m('.col.s12.coa-reflection', [
                m(TextArea, {
                  label: t('COA_REFLECTION'),
                  value: coa.reflection || '',
                  oninput: (reflection: string) => {
                    coa.reflection = reflection;
                    updateNarrative(attrs, curNarrative);
                  },
                }),
                decisionPromptReady &&
                  m(FlatButton, {
                    label: t('REFLECT_ON_DECISIONS'),
                    iconName: llm?.id === 'clipboard' ? 'content_copy' : 'psychology',
                    disabled: !askLlm,
                    onclick: async () => {
                      askLlm = false;
                      m.redraw();
                      const original = curNarrative;
                      const coaId = coa.id;
                      try {
                        const reflection = await generateStory(
                          llm!,
                          original,
                          model.scenario,
                          'decision',
                          undefined,
                          { coaId, narrativeText: markdown },
                        );
                        if (llm?.id === 'clipboard') {
                          await navigator.clipboard.writeText(reflection);
                          toast({ html: t('DECISION_PROMPT_COPIED') });
                        } else {
                          // The narrative may have been edited or switched meanwhile
                          const latest = attrs.getState().curNarrative;
                          const target = reflectionTarget(latest, original, coaId);
                          if (!latest || !target) {
                            toast({ html: t('DECISION_REFLECTION_DISCARDED') });
                          } else {
                            target.reflection = appendReflection(
                              target.reflection,
                              reflection,
                            );
                            await updateNarrative(attrs, latest);
                          }
                        }
                      } catch (error) {
                        console.error(error);
                        toast({ html: t('DECISION_REFLECTION_ERROR') });
                      } finally {
                        askLlm = true;
                        m.redraw();
                      }
                    },
                  }),
              ]),
          ],
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
            showTables ? 'visibility_off' : 'visibility',
          ),
        ),
        m('.col.s12', [
          m('.row', [
            curNarrative.saved &&
              m(InputCheckbox, {
                className: 'col s6 m3',
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
                className: 'col s6 m3',
                label: t('PROBABILITY'),
                checkedId: curNarrative.probability,
                options: range(0, 4).map((id) => ({
                  id: `probability_${id}`,
                  label: t('PROB5', id),
                })),
                onchange: (n) => {
                  curNarrative.probability = n[0];
                  updateRisk(curNarrative);
                  updateNarrative(attrs, curNarrative);
                },
              } as SelectAttrs<string>),
              m(Select, {
                key: `imp${curNarrative.id}`,
                placeholder: t('i18n', 'pick'),
                className: 'col s6 m3',
                label: t('IMPACT'),
                checkedId: curNarrative.impact,
                options: range(0, 4).map((id) => ({
                  id: `impact_${id}`,
                  label: t('IMP5', id),
                })),
                onchange: (n) => {
                  curNarrative.impact = n[0];
                  updateRisk(curNarrative);
                  updateNarrative(attrs, curNarrative);
                },
              } as SelectAttrs<string>),
              m(Select, {
                key: `${curNarrative.id}-${curNarrative.probability}-${curNarrative.impact}`,
                placeholder: t('RISK_PLACEHOLDER'),
                className: 'col s6 m3',
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
          curNarrative.saved && [
            m(
              '#markdown-editor',
              m(MarkdownEditor, {
                key:
                  curNarrative && curNarrative.desc
                    ? curNarrative.id
                    : 'markdown-editor',
                content: markdown,
                onContentChange: (newContent: string) => {
                  const { curNarrative } = attrs.getState();
                  if (!curNarrative) return;
                  curNarrative.desc = newContent;
                  updateNarrative(attrs, curNarrative);
                },
                // placeholder: 'Start writing...',
                theme: ThemeManager.getTheme(),
                toolbar: true,
                showTabs: true,
                markdownToHtml: render,
              }),
            ),
          ],
          curNarrative.saved && [
            curPersonas.map((p, index) =>
              m('.row.persona', [
                m('.col.s12', m('h5', p.label)),
                m('.col.s12.m6', [
                  m('img.reponsive-image', {
                    style: { height: '200px' },
                    src: PersonaImages.find((img) => img.id === p.url)?.img,
                    alt: p.label,
                  }),
                  m('p', p.desc),
                ]),
                m('.col.s12.m6', [
                  m(TextArea, {
                    label: t('PERSONA_IMPRESSION'),
                    value: curNarrative.personaEffects?.[p.id]?.story,
                    oninput: (story) => {
                      curNarrative.personaEffects ??= {};
                      curNarrative.personaEffects[p.id] ??= { scale: 0 };
                      curNarrative.personaEffects[p.id].story = story;
                      updateNarrative(attrs, curNarrative);
                    },
                  }),
                  personaPromptReady &&
                    m(FlatButton, {
                      label: llm?.id === 'clipboard'
                        ? t(index === 0 ? 'COPY_PERSONA_PROMPT' : 'COPY_PERSONA_PROMPT_SHORT')
                        : t(index === 0 ? 'GENERATE_PERSONA_FEEDBACK' : 'GENERATE_PERSONA_FEEDBACK_SHORT'),
                      'aria-label': llm?.id === 'clipboard'
                        ? t('COPY_PERSONA_PROMPT_FOR', { persona: p.label })
                        : t('GENERATE_PERSONA_FEEDBACK_FOR', { persona: p.label }),
                      title: llm?.id === 'clipboard'
                        ? t('PERSONA_PASTE_HINT')
                        : undefined,
                      iconName:
                        llm?.id === 'clipboard' ? 'content_copy' : 'auto_awesome',
                      disabled: !askLlm,
                      onclick: async () => {
                        askLlm = false;
                        m.redraw();
                        try {
                          const feedback = await generateStory(
                            llm!,
                            curNarrative,
                            model.scenario,
                            'persona',
                            {
                              target: p,
                              selected: curPersonas,
                              narrativeText: markdown,
                            },
                          );
                          if (llm?.id === 'clipboard') {
                            await navigator.clipboard.writeText(feedback);
                            toast({ html: t('PERSONA_PROMPT_COPIED') });
                          } else {
                            curNarrative.personaEffects ??= {};
                            curNarrative.personaEffects[p.id] ??= { scale: 0 };
                            curNarrative.personaEffects[p.id].story = feedback;
                            await updateNarrative(attrs, curNarrative);
                          }
                        } catch (error) {
                          console.error(error);
                          toast({ html: t('PERSONA_FEEDBACK_ERROR') });
                        } finally {
                          askLlm = true;
                          m.redraw();
                        }
                      },
                    }),
                ]),
              ]),
            ),
          ],
          // curPersonas.length > 0 && [

          //   m(LayoutForm, {
          //     obj: curNarrative,
          //     form: [],
          //     onchange: () => {
          //       updateNarrative(attrs, curNarrative);
          //     }
          //   })
          // ]
        ]),
      ]);
    },
  };
};
