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

export const DecisionSupportPage: MeiosisComponent = () => {
  let comps: ScenarioComponent[];

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

  const riskComponentIds = ['probability', 'impact', 'risk'];

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

      const selectedNarratives = narratives
        .filter((n) => n.included)
        .sort((a, b) => (a.label || '').localeCompare(b.label));

      /** Weights is a value between 1 (very low risk) and 5 (very high risk) */
      const weights = selectedNarratives
        .map((n) => n.risk || '0')
        .map((s) => +s.replace('risk_', '') + 1);

      const suggestedApproach: Narrative = {
        id: 'suggested_approach',
        included: true,
        saved: false,
        label: t('SUGGESTED_APPROACH', 'TITLE'),
        desc: t('SUGGESTED_APPROACH', 'DESC'),
        components: comps
          .filter((c) => !riskComponentIds.includes(c.id))
          .reduce((acc, c) => {
            const measures = selectedNarratives
              .map((n) => n.components && n.components[c.id])
              .reduce((acc, c, i) => {
                if (!c || c.length === 0) return acc;
                c.filter((c) => c).forEach((id) =>
                  acc.set(id, (acc.get(id) || 0) + weights[i])
                );
                return acc;
              }, new Map<ID, number>());
            const highScore = Math.max(...Array.from(measures.values()));
            acc[c.id] = Array.from(measures.entries())
              .filter(([_, count]) => count === highScore)
              .map(([id, _]) => id);
            return acc;
          }, {} as { [key: ID]: ID[] }),
      };

      selectedNarratives.push(suggestedApproach);

      return m('.row.decision-support', [
        // categories.map((c) =>
        m(TableView, {
          ...attrs,
          narratives: selectedNarratives,
          components: comps,
        }),
        // ),
      ]);
    },
  };
};
