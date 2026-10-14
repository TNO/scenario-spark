import m, { FactoryComponent } from 'mithril';
import { InputCheckbox, Select } from 'mithril-materialized';
import type { ID, Narrative, Scenario } from '../models';
import { t } from '../services';
import {
  COA_CRITERIA,
  CoaCriterion,
  CoaRiskRow,
  MAX_CRITERION_SCORE,
  coaComparisonRows,
  coaRiskRows,
  coaScores,
  riskMatrix,
  trafficLight,
  robustnessGrid,
  RobustnessCell,
  RobustnessRow,
  SuggestedApproach,
  SuggestedComponent,
  SuggestedSkip,
} from '../utils';

const icon = (name: string, className: string, title: string) => [
  m(`i.material-icons.tiny.${className}`, { title, 'aria-hidden': 'true' }, name),
  m('span.sr-only', title),
];

const riskName = (level?: number) => (level === undefined ? t('RISK_NOT_SET') : t('RISK5', level));

const riskChangeIcon = (row: CoaRiskRow) =>
  row.change &&
  icon(
    row.change === 'lower' ? 'arrow_downward' : row.change === 'higher' ? 'arrow_upward' : 'arrow_forward',
    row.change === 'lower' ? 'green-text' : row.change === 'higher' ? 'red-text' : 'grey-text',
    t('RISK_CHANGE', row.change),
  );

const range15 = Array.from({ length: MAX_CRITERION_SCORE }, (_, i) => i + 1);

/** Optional weighted criteria scoring of the COAs of one situation, collapsed until used. */
const CriteriaScoring: FactoryComponent<{
  narrative: Narrative;
  criteriaWeights?: Scenario['criteriaWeights'];
  onscore: (coaId: ID, criterion: CoaCriterion, score?: number) => void;
  onweight: (criterion: CoaCriterion, weight: number) => void;
}> = () => ({
  view: ({ attrs: { narrative, criteriaWeights, onscore, onweight } }) => {
    const coas = narrative.coas || [];
    const scores = coaScores(coas, criteriaWeights);
    return m('details.criteria-scoring', { open: scores.used }, [
      m('summary', m('strong', t('CRITERIA_SCORING'))),
      m('p.grey-text', t('CRITERIA_HINT')),
      m('table.highlight.decision-matrix', [
        m(
          'thead',
          m('tr', [
            m('th', t('CRITERIA_CRITERION')),
            m('th', t('CRITERIA_WEIGHT')),
            coas.map((coa) => m('th.center-align', `${t('COURSE_OF_ACTION')} ${coa.label}`)),
          ]),
        ),
        m(
          'tbody',
          COA_CRITERIA.map((criterion) => {
            const label = t('CRITERIA', criterion);
            const weight = scores.weights[criterion];
            return m('tr', [
              m('th', { scope: 'row' }, label),
              m('td.criteria-weight', [
                m('input[type=range][min=0][max=5][step=1]', {
                  value: weight,
                  'aria-label': t('CRITERIA_WEIGHT_FOR', { criterion: label }),
                  oninput: (e: InputEvent) => onweight(criterion, +(e.target as HTMLInputElement).value),
                }),
                m('output', { 'aria-hidden': 'true' }, weight),
              ]),
              coas.map((coa) =>
                m(
                  'td.center-align',
                  m(
                    'select.browser-default.criteria-score',
                    {
                      'aria-label': t('CRITERIA_SCORE_FOR', { coa: coa.label, criterion: label }),
                      value: coa.scores?.[criterion] ?? '',
                      onchange: (e: Event) => {
                        const value = (e.target as HTMLSelectElement).value;
                        onscore(coa.id, criterion, value === '' ? undefined : +value);
                      },
                    },
                    [
                      m('option', { value: '' }, '–'),
                      range15.map((score) => m('option', { value: score }, score)),
                    ],
                  ),
                ),
              ),
            ]);
          }),
        ),
        m('tfoot', [
          m('tr', [
            m('th', { scope: 'row', colspan: 2 }, t('CRITERIA_TOTAL')),
            scores.rows.map((row) =>
              m('td.center-align', [
                row.total === undefined
                  ? m('span.grey-text', t('CRITERIA_NOT_SCORED'))
                  : t('CRITERIA_TOTAL_OF', { total: row.total, max: row.max }),
                row.total !== undefined &&
                  row.missing > 0 &&
                  m('div.grey-text', t('CRITERIA_MISSING', { count: row.missing })),
              ]),
            ),
          ]),
          m('tr', [
            m('th', { scope: 'row', colspan: 2 }, t('CRITERIA_RANK')),
            scores.rows.map((row) =>
              m(
                'td.center-align',
                { className: row.rank === 1 ? 'best-rank' : '' },
                row.rank === undefined
                  ? m('span.grey-text', '–')
                  : [m('strong', row.rank), row.rank === 1 && icon('emoji_events', 'amber-text', t('CRITERIA_RANK') + ' 1')],
              ),
            ),
          ]),
        ]),
      ]),
    ]);
  },
});

const NarrativeSelect: FactoryComponent<{ narratives: Narrative[]; narrativeId?: ID; onselect: (id: ID) => void; className?: string }> = () => ({
  view: ({ attrs: { narratives, narrativeId, onselect, className = 'col s12 m8' } }) =>
    m(Select, {
      className,
      label: t('COMPARE_SCENARIO'),
      options: narratives.map((n) => ({ id: n.id, label: n.label })),
      checkedId: narrativeId,
      onchange: ([id]) => id && onselect(String(id)),
    }),
});

export const CoaComparisonView: FactoryComponent<{
  box: Scenario;
  narratives: Narrative[];
  narrativeId?: ID;
  differencesOnly: boolean;
  onselect: (id: ID) => void;
  ontoggle: (differencesOnly: boolean) => void;
  onscore: (narrativeId: ID, coaId: ID, criterion: CoaCriterion, score?: number) => void;
  onweight: (criterion: CoaCriterion, weight: number) => void;
}> = () => ({
  view: ({ attrs: { box, narratives, narrativeId, differencesOnly, onselect, ontoggle, onscore, onweight } }) => {
    const narrative = narratives.find((n) => n.id === narrativeId);
    const { coas, groups } = coaComparisonRows(box, narrative, { differencesOnly });
    const riskRows = narrative ? coaRiskRows(narrative) : [];
    const showRisk = !!narrative?.risk || riskRows.some((r) => r.after !== undefined);
    return m('.col.s12.coa-comparison', [
      m('.row', [
        m(NarrativeSelect, { narratives, narrativeId, onselect }),
        m(
          '.col.s12.m4.differences-only',
          m(InputCheckbox, {
            label: t('SHOW_DIFFERENCES_ONLY'),
            checked: differencesOnly,
            onchange: (checked) => ontoggle(checked),
          }),
        ),
      ]),
      coas.length === 0
        ? m('p.grey-text', t('NO_COAS'))
        : [
            groups.length === 0 && m('p.grey-text', t('NO_COA_DIFFERENCES')),
            (groups.length > 0 || showRisk) &&
              m('table.highlight.decision-matrix', [
                m(
                  'thead',
                  m('tr', [
                    m('th', t('DECISIONS')),
                    coas.map((coa) =>
                      m('th', { title: coa.desc }, [
                        `${t('COURSE_OF_ACTION')} ${coa.label}`,
                        coa.active && m('span.grey-text', ` (${t('COA_ACTIVE')})`),
                        coa.conflicts > 0 && icon('warning', 'orange-text', t('COA_HAS_CONFLICTS')),
                      ]),
                    ),
                  ]),
                ),
                m('tbody', [
                  showRisk && [
                    m('tr.category-row', m('th', { colspan: coas.length + 1, scope: 'colgroup' }, t('RISK'))),
                    m('tr.coa-risk-row', [
                      m('th', { scope: 'row' }, t('RISK_BEFORE_AFTER')),
                      riskRows.map((row) =>
                        m('td', [
                          t('RISK_TRANSITION', { before: riskName(row.before), after: riskName(row.after) }),
                          riskChangeIcon(row),
                        ]),
                      ),
                    ]),
                  ],
                  groups.map((group) => [
                    m('tr.category-row', m('th', { colspan: coas.length + 1, scope: 'colgroup' }, group.label)),
                    group.rows.map((row) =>
                      m('tr', [
                        m('th', { scope: 'row' }, row.label),
                        row.cells.map((cell) =>
                          m(
                            'td',
                            { className: cell.conflict ? 'conflict' : '' },
                            cell.values.length === 0
                              ? m('span.grey-text', t('NO_DECISION_SELECTED'))
                              : cell.values.map((v, i) => [
                                  i > 0 && ', ',
                                  v.conflict
                                    ? m('span.orange-text', [
                                        v.label,
                                        icon(
                                          'warning',
                                          'orange-text',
                                          t('COA_CONFLICT', { value: v.label, situation: v.causes || '' }),
                                        ),
                                      ])
                                    : v.label,
                                ]),
                          ),
                        ),
                      ]),
                    ),
                  ]),
                ]),
              ]),
            narrative &&
              m(CriteriaScoring, {
                narrative,
                criteriaWeights: box.criteriaWeights,
                onscore: (coaId, criterion, score) => onscore(narrative.id, coaId, criterion, score),
                onweight,
              }),
          ],
    ]);
  },
});

/**
 * 5x5 risk matrix (probability x impact) with the included scenarios (numbers) and the
 * courses of action of the selected scenario (letters), plus a text table as fallback.
 */
export const RiskMatrixView: FactoryComponent<{
  narratives: Narrative[];
  narrativeId?: ID;
  onselect: (id: ID) => void;
}> = () => ({
  view: ({ attrs: { narratives, narrativeId, onselect } }) => {
    if (narratives.length === 0) return m('p.col.s12.grey-text', t('NO_INCLUDED_NARRATIVES'));
    const matrix = riskMatrix(narratives, narrativeId);
    const selected = narratives.find((n) => n.id === narrativeId);
    const itemLabel = (mk: { kind: 'situation' | 'coa'; label: string }) =>
      mk.kind === 'coa' ? `${t('COURSE_OF_ACTION')} ${mk.label}${selected ? ` (${selected.label})` : ''}` : mk.label;
    const levels = [0, 1, 2, 3, 4];
    return m('.col.s12.risk-matrix-view', [
      m('.row', m(NarrativeSelect, { narratives, narrativeId, onselect })),
      m('p.grey-text', t('RISK_MATRIX_HINT')),
      m('table.risk-matrix', [
        m('caption', t('RISK_MATRIX_CAPTION')),
        m(
          'thead',
          m('tr', [
            m('th', { scope: 'col' }, `${t('PROBABILITY')} / ${t('IMPACT')}`),
            levels.map((i) => m('th.center-align', { scope: 'col' }, t('IMP5', i))),
          ]),
        ),
        m(
          'tbody',
          [...levels].reverse().map((p) =>
            m('tr', [
              m('th', { scope: 'row' }, t('PROB5', p)),
              matrix.cells[p].map((cell) => {
                const riskText = t('RISK_MATRIX_CELL', {
                  probability: t('PROB5', p),
                  impact: t('IMP5', cell.impact),
                  risk: t('RISK5', cell.risk),
                });
                return m(
                  'td.risk-cell',
                  {
                    className: `risk-${cell.risk}`,
                    style: { backgroundColor: trafficLight[cell.risk] },
                    title: [riskText, ...cell.markers.map((mk) => `${mk.marker}: ${itemLabel(mk)}`)].join('\n'),
                  },
                  [
                    m('span.sr-only', riskText),
                    cell.markers.map((mk) =>
                      m(`span.risk-marker.${mk.kind}`, { title: itemLabel(mk) }, [
                        m('span', { 'aria-hidden': 'true' }, mk.marker),
                        m('span.sr-only', `${mk.marker}: ${itemLabel(mk)}`),
                      ]),
                    ),
                  ],
                );
              }),
            ]),
          ),
        ),
      ]),
      matrix.markers.length === 0
        ? m('p.grey-text', t('RISK_MATRIX_EMPTY'))
        : m('table.highlight.decision-matrix.risk-matrix-list', [
            m(
              'thead',
              m('tr', [
                m('th', t('RISK_MATRIX_MARKER')),
                m('th', t('RISK_MATRIX_ITEM')),
                m('th', t('PROBABILITY')),
                m('th', t('IMPACT')),
                m('th', t('RISK')),
              ]),
            ),
            m(
              'tbody',
              matrix.markers.map((mk) =>
                m('tr', [
                  m('td', m(`span.risk-marker.${mk.kind}`, mk.marker)),
                  m('th', { scope: 'row' }, itemLabel(mk)),
                  m('td', t('PROB5', mk.probability)),
                  m('td', t('IMP5', mk.impact)),
                  m('td', t('RISK5', mk.risk)),
                ]),
              ),
            ),
          ]),
      matrix.unplaced.length > 0 &&
        m('p.grey-text', t('RISK_MATRIX_UNPLACED', { items: matrix.unplaced.map(itemLabel).join(', ') })),
    ]);
  },
});

const statusIcon = (cell: RobustnessCell) => {
  switch (cell.status) {
    case 'chosen':
      return [
        icon('check_circle', 'green-text', t('ROBUSTNESS_CHOSEN')),
        cell.conflict &&
          icon(
            'warning',
            'orange-text',
            t('COA_HAS_CONFLICTS') + (cell.causes ? ` (${cell.causes})` : ''),
          ),
      ];
    case 'excluded':
      return icon(
        'block',
        'red-text',
        `${t('ROBUSTNESS_EXCLUDED')} (${t('EXCLUDED_BY', { situation: cell.causes || '' })})`,
      );
    default:
      return icon('remove', 'grey-text', t('ROBUSTNESS_UNUSED'));
  }
};

const summary = (row: RobustnessRow, total: number) => [
  t('ROBUSTNESS_COUNT', { count: row.chosenCount, total }),
  row.robust && icon('star', 'amber-text', t('ROBUSTNESS_ROBUST')),
  row.scenarioSpecific && icon('looks_one', 'blue-text', t('ROBUSTNESS_SPECIFIC')),
];

export const RobustnessView: FactoryComponent<{ box: Scenario; narratives: Narrative[] }> = () => ({
  view: ({ attrs: { box, narratives } }) => {
    if (narratives.length === 0) return m('p.col.s12.grey-text', t('NO_INCLUDED_NARRATIVES'));
    const grid = robustnessGrid(box, narratives);
    const total = grid.narratives.length;
    const columns = total + 2;
    return m('.col.s12.robustness', [
      m('p.robustness-legend', [
        t('ROBUSTNESS_HINT'),
        ' ',
        m('span', [m('i.material-icons.tiny.green-text', { 'aria-hidden': 'true' }, 'check_circle'), ` ${t('ROBUSTNESS_CHOSEN')}`]),
        m('span', [m('i.material-icons.tiny.red-text', { 'aria-hidden': 'true' }, 'block'), ` ${t('ROBUSTNESS_EXCLUDED')}`]),
        m('span', [m('i.material-icons.tiny.grey-text', { 'aria-hidden': 'true' }, 'remove'), ` ${t('ROBUSTNESS_UNUSED')}`]),
        m('span', [m('i.material-icons.tiny.amber-text', { 'aria-hidden': 'true' }, 'star'), ` ${t('ROBUSTNESS_ROBUST')}`]),
        m('span', [m('i.material-icons.tiny.blue-text', { 'aria-hidden': 'true' }, 'looks_one'), ` ${t('ROBUSTNESS_SPECIFIC')}`]),
      ]),
      m('table.highlight.decision-matrix', [
        m(
          'thead',
          m('tr', [
            m('th', t('ROBUSTNESS_MEASURE')),
            grid.narratives.map((n) =>
              m('th.center-align', [n.label, n.coaLabel && m('span.grey-text', ` (${n.coaLabel})`)]),
            ),
            m('th.center-align', t('ROBUSTNESS_CHOSEN_IN')),
          ]),
        ),
        m(
          'tbody',
          grid.groups.map((group) => [
            m('tr.category-row', m('th', { colspan: columns, scope: 'colgroup' }, group.label)),
            group.components.map((component) => [
              m('tr.component-row', m('th', { colspan: columns, scope: 'colgroup' }, component.label)),
              component.rows.map((row) =>
                m(
                  'tr',
                  { className: row.robust ? 'robust' : row.scenarioSpecific ? 'scenario-specific' : '' },
                  [
                    m('th', { scope: 'row' }, row.label),
                    row.cells.map((cell) => m('td.center-align', statusIcon(cell))),
                    m('td.center-align', summary(row, total)),
                  ],
                ),
              ),
            ]),
          ]),
        ),
      ]),
    ]);
  },
});

const pickText = (e: SuggestedComponent['explanations'][number]) =>
  t('SUGGESTED_PICK', { count: e.chosenIn, total: e.total, weight: e.weight });

const skipText = (s: SuggestedSkip) =>
  t(s.reason === 'excluded' ? 'SUGGESTED_SKIPPED_EXCLUDED' : 'SUGGESTED_SKIPPED_CONFLICT', {
    value: s.label,
    causes: s.causes.join(', '),
  });

const noPickText = (c: SuggestedComponent) =>
  t(c.reason === 'excluded' ? 'SUGGESTED_NONE_EXCLUDED' : c.reason === 'conflict' ? 'SUGGESTED_NONE_CONFLICT' : 'SUGGESTED_NONE');

/** Tooltips for the suggested-approach row of the overview table, per component. */
export const suggestionTitles = (suggestion: SuggestedApproach) =>
  Object.fromEntries(
    suggestion.components.map((c) => [
      c.componentId,
      [
        ...(c.valueIds.length > 0 ? c.explanations.map((e) => `${e.label}: ${pickText(e)}`) : [noPickText(c)]),
        ...c.skipped.map(skipText),
      ].join('\n'),
    ]),
  );

/** Why each value of the suggested approach was picked, and why factors have no pick. */
export const SuggestedApproachExplanation: FactoryComponent<{ suggestion: SuggestedApproach }> = () => ({
  view: ({ attrs: { suggestion } }) =>
    suggestion.components.length > 0 &&
    m('.col.s12.suggested-approach-explanation', [
      m('h5', t('SUGGESTED_WHY')),
      m('p.grey-text', t('SUGGESTED_HINT')),
      m(
        'dl',
        suggestion.components.map((c) => [
          m('dt', c.label),
          c.valueIds.length > 0
            ? c.explanations.map((e) => m('dd', [m('strong', e.label), m('span.grey-text', ` – ${pickText(e)}`)]))
            : m('dd.grey-text', noPickText(c)),
          c.skipped.map((s) =>
            m('dd.skipped', [icon(s.reason === 'excluded' ? 'block' : 'warning', 'orange-text', s.reason === 'excluded' ? t('ROBUSTNESS_EXCLUDED') : t('COA_HAS_CONFLICTS')), ' ', skipText(s)]),
          ),
        ]),
      ),
    ]),
});
