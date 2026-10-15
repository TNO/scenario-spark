import m from 'mithril';
import {
  Dashboards,
  DataModel,
  ID,
  Item,
  Narrative,
  ScenarioComponent,
} from '../models';
import { MeiosisComponent, i18n, saveModel, setPage, t } from '../services';
import { TableView } from './home-page';
import { range } from 'mithril-ui-form';
import { FlatButton, ToggleGroup } from 'mithril-materialized';
import {
  CoaCriterion,
  DecisionLogInput,
  Translator,
  activeCoa,
  addDecisionLogEntry,
  buildComparisonExport,
  comparedNarratives,
  comparisonNarrativeId,
  decisionLogRows,
  downloadComparisonDocx,
  effectiveSelection,
  formatLogTimestamp,
  modelToSaveName,
  removeDecisionLogEntry,
  suggestApproach,
  updateDecisionLogEntry,
} from '../utils';
import {
  CoaComparisonView,
  DecisionLogView,
  RiskMatrixView,
  RobustnessView,
  SuggestedApproachExplanation,
  suggestionTitles,
} from './decision-comparison';

type DecisionView = 'overview' | 'coa' | 'robustness' | 'risk';

export const DecisionSupportPage: MeiosisComponent = () => {
  let comps: ScenarioComponent[];
  let view: DecisionView = 'overview';
  let comparisonId: ID | undefined;
  let differencesOnly = false;

  const toComponent = (
    id: string,
    label: string,
    values: Item[]
  ): ScenarioComponent => {
    const comp: ScenarioComponent = {
      id,
      label,
      values,
    };

    return comp;
  };

  const setupComponents = (model: DataModel) => {
    const {
      scenario: { components, categories },
    } = model;
    comps = categories
      .filter((c) => c.decisionSupport)
      .reduce(
        (acc, c) => {
          acc.push(
            ...components.filter(
              (comp) => c.componentIds && c.componentIds.includes(comp.id)
            )
          );
          return acc;
        },
        [
          toComponent(
            'probability',
            t('PROBABILITY'),
            range(0, 4).map((id) => ({
              id: `probability_${id}`,
              label: t('PROB5', id),
            }))
          ),
          toComponent(
            'impact',
            t('IMPACT'),
            range(0, 4).map((id) => ({
              id: `impact_${id}`,
              label: t('IMP5', id),
            }))
          ),
          toComponent(
            'risk',
            t('RISK'),
            range(0, 4).map((id) => ({
              id: `risk_${id}`,
              label: t('RISK5', id),
            }))
          ),
        ] as ScenarioComponent[]
      );
  };

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.DECISION_SUPPORT);
    },
    // oncreate: () => {
    //   const match = /#([a-zA-Z]*)/.exec(m.route.get());
    //   if (match && match.length > 0) {
    //     setTimeout(() => scrollToSection(match[1]), 100);
    //   }
    // },
    view: ({ attrs }) => {
      const { model } = attrs.state;
      const {
        scenario: { narratives = [] },
      } = model;
      setupComponents(model);

      const includedNarratives = comparedNarratives(narratives, attrs.state.curNarrative?.id);

      // Compare the active course of action of each included narrative
      const selectedNarratives: Narrative[] = includedNarratives.map((n) => {
        const coa = activeCoa(n);
        return {
          ...n,
          label: coa
            ? `${n.label} – ${t('COURSE_OF_ACTION')} ${coa.label}`
            : n.label,
          components: effectiveSelection(model.scenario, n),
        };
      });

      const suggestion = suggestApproach(model.scenario, includedNarratives);

      const suggestedApproach: Narrative = {
        id: 'suggested_approach',
        included: true,
        saved: false,
        label: t('SUGGESTED_APPROACH', 'TITLE'),
        desc: t('SUGGESTED_APPROACH', 'DESC'),
        personaEffects: {},
        components: suggestion.selection,
      };

      selectedNarratives.push(suggestedApproach);

      const hasDecisionCategories = model.scenario.categories?.some(
        (c) => c.decisionSupport,
      );

      const viewSwitcher = m(ToggleGroup, {
        value: view,
        onchange: (v) => {
          view = v as DecisionView;
        },
        items: [
          { value: 'overview', iconName: 'table_chart', label: t('DECISION_VIEW_OVERVIEW') },
          { value: 'coa', iconName: 'compare_arrows', label: t('DECISION_VIEW_COA') },
          { value: 'robustness', iconName: 'grid_on', label: t('DECISION_VIEW_ROBUSTNESS') },
          { value: 'risk', iconName: 'warning_amber', label: t('DECISION_VIEW_RISK') },
        ],
      });

      const selectedComparisonId = comparisonNarrativeId(
        includedNarratives,
        attrs.state.curNarrative?.id,
        comparisonId,
      );

      /** Score a COA in the stored narrative and in the narrative being edited (if the same) */
      const setScore = (narrativeId: ID, coaId: ID, criterion: CoaCriterion, score?: number) => {
        const { curNarrative } = attrs.state;
        const targets = [
          narratives.find((n) => n.id === narrativeId),
          curNarrative?.id === narrativeId ? curNarrative : undefined,
        ];
        for (const n of new Set(targets)) {
          const coa = n?.coas?.find((c) => c.id === coaId);
          if (!coa) continue;
          const scores = { ...coa.scores };
          if (score === undefined) delete scores[criterion];
          else scores[criterion] = score;
          if (Object.keys(scores).length > 0) coa.scores = scores;
          else delete coa.scores;
        }
        saveModel(attrs, model);
      };

      const setWeight = (criterion: CoaCriterion, weight: number) => {
        model.scenario.criteriaWeights = { ...model.scenario.criteriaWeights, [criterion]: weight };
        saveModel(attrs, model);
      };

      const content = view === 'risk'
        ? m(RiskMatrixView, {
            narratives: includedNarratives,
            narrativeId: selectedComparisonId,
            onselect: (id) => {
              comparisonId = id;
            },
          })
        : !hasDecisionCategories && view !== 'overview'
        ? null
        : view === 'coa'
        ? includedNarratives.length === 0
          ? m('p.col.s12.grey-text', t('NO_INCLUDED_NARRATIVES'))
          : m(CoaComparisonView, {
              box: model.scenario,
              narratives: includedNarratives,
              narrativeId: selectedComparisonId,
              differencesOnly,
              onselect: (id) => {
                comparisonId = id;
              },
              ontoggle: (value) => {
                differencesOnly = value;
              },
              onscore: setScore,
              onweight: setWeight,
            })
        : view === 'robustness'
        ? m(RobustnessView, { box: model.scenario, narratives: includedNarratives })
        : [
            m(
              '.decision-support',
              m(TableView, {
                ...attrs,
                narratives: selectedNarratives,
                components: comps,
                cellTitles: { [suggestedApproach.id]: suggestionTitles(suggestion) },
              }),
            ),
            hasDecisionCategories && m(SuggestedApproachExplanation, { suggestion }),
          ];

      const locale = i18n.currentLocale;

      const saveLogEntry = (input: DecisionLogInput, id?: ID) => {
        if (id) updateDecisionLogEntry(model.scenario, id, input);
        else addDecisionLogEntry(model.scenario, input);
        saveModel(attrs, model);
      };

      const deleteLogEntry = (id: ID) => {
        if (removeDecisionLogEntry(model.scenario, id)) saveModel(attrs, model);
      };

      const exportToWord = async () => {
        const data = buildComparisonExport(model.scenario, includedNarratives, {
          narrativeId: selectedComparisonId,
          tr: t as Translator,
          formatDate: (ts) => formatLogTimestamp(ts, locale),
        });
        await downloadComparisonDocx(data, `${modelToSaveName(model, t('DECISION_EXPORT_TITLE'), false)}.docx`);
      };

      return m('.row', [
        m('.col.s12.decision-view-switcher', { role: 'group', 'aria-label': t('DECISION_VIEW') }, [
          viewSwitcher,
          m(FlatButton, {
            className: 'decision-export',
            label: t('DECISION_EXPORT'),
            iconName: 'description',
            onclick: exportToWord,
          }),
        ]),
        !hasDecisionCategories &&
          m('.col.s12', m('p.grey-text', t('NO_DECISION_CATEGORIES'))),
        content,
        m(DecisionLogView, {
          narratives,
          rows: decisionLogRows(model.scenario),
          locale,
          onsave: saveLogEntry,
          ondelete: deleteLogEntry,
        }),
      ]);
    },
  };
};
