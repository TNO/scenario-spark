import m from 'mithril';
import {
  Dashboards,
  DataModel,
  ID,
  Item,
  Narrative,
  ScenarioComponent,
} from '../models';
import { MeiosisComponent, saveModel, setPage, t } from '../services';
import { TableView } from './home-page';
import { range } from 'mithril-ui-form';
import { ToggleGroup } from 'mithril-materialized';
import { CoaCriterion, activeCoa, comparisonNarrativeId, effectiveSelection, suggestApproach } from '../utils';
import {
  CoaComparisonView,
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

      const includedNarratives = narratives
        .filter((n) => n.included)
        .sort((a, b) => (a.label || '').localeCompare(b.label));

      // Compare the active course of action of each included narrative
      const selectedNarratives: Narrative[] = includedNarratives.map((n) => {
        const coa = activeCoa(n);
        return {
          ...n,
          label: coa
            ? `${n.label} – ${t('COURSE_OF_ACTION')} ${coa.label}`
            : n.label,
          components: effectiveSelection(n),
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

      return m('.row', [
        m('.col.s12.decision-view-switcher', { role: 'group', 'aria-label': t('DECISION_VIEW') }, viewSwitcher),
        !hasDecisionCategories &&
          m('.col.s12', m('p.grey-text', t('NO_DECISION_CATEGORIES'))),
        content,
      ]);
    },
  };
};
