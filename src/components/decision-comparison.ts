import m, { FactoryComponent } from 'mithril';
import { InputCheckbox, Select } from 'mithril-materialized';
import type { ID, Narrative, Scenario } from '../models';
import { t } from '../services';
import {
  coaComparisonRows,
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

export const CoaComparisonView: FactoryComponent<{
  box: Scenario;
  narratives: Narrative[];
  narrativeId?: ID;
  differencesOnly: boolean;
  onselect: (id: ID) => void;
  ontoggle: (differencesOnly: boolean) => void;
}> = () => ({
  view: ({ attrs: { box, narratives, narrativeId, differencesOnly, onselect, ontoggle } }) => {
    const narrative = narratives.find((n) => n.id === narrativeId);
    const { coas, groups } = coaComparisonRows(box, narrative, { differencesOnly });
    return m('.col.s12.coa-comparison', [
      m('.row', [
        m(Select, {
          className: 'col s12 m8',
          label: t('COMPARE_SCENARIO'),
          options: narratives.map((n) => ({ id: n.id, label: n.label })),
          checkedId: narrativeId,
          onchange: ([id]) => id && onselect(String(id)),
        }),
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
        : groups.length === 0
        ? m('p.grey-text', t('NO_COA_DIFFERENCES'))
        : m('table.highlight.decision-matrix', [
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
            m(
              'tbody',
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
            ),
          ]),
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
