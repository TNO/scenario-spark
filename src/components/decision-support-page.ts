import m from 'mithril';
import {
  Dashboards,
  DataModel,
  ID,
  Item,
  Narrative,
  ScenarioComponent,
} from '../models';
import { MeiosisComponent, setPage, t } from '../services';
import { TableView } from './home-page';
import { range } from 'mithril-ui-form';
import { ToggleGroup } from 'mithril-materialized';
import { activeCoa, comparisonNarrativeId, effectiveSelection, suggestApproach } from '../utils';
import {
  CoaComparisonView,
  RobustnessView,
  SuggestedApproachExplanation,
  suggestionTitles,
} from './decision-comparison';

type DecisionView = 'overview' | 'coa' | 'robustness';

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
        ],
      });

      const content = !hasDecisionCategories && view !== 'overview'
        ? null
        : view === 'coa'
        ? includedNarratives.length === 0
          ? m('p.col.s12.grey-text', t('NO_INCLUDED_NARRATIVES'))
          : m(CoaComparisonView, {
              box: model.scenario,
              narratives: includedNarratives,
              narrativeId: comparisonNarrativeId(
                includedNarratives,
                attrs.state.curNarrative?.id,
                comparisonId,
              ),
              differencesOnly,
              onselect: (id) => {
                comparisonId = id;
              },
              ontoggle: (value) => {
                differencesOnly = value;
              },
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
