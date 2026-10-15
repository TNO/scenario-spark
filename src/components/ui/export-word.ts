import m, { FactoryComponent } from 'mithril';
import { InputCheckbox, ModalPanel } from 'mithril-materialized';
import { DataModel, Narrative, ScenarioComponent } from '../../models';
import { t } from '../../services';
import {
  CoaRow,
  DocxBoxTable,
  DocxNarrative,
  downloadAsDocx,
  effectiveSelection,
  levelIndex,
  modelToSaveName,
  narrativeCoaRows,
  narrativeToMarkdown,
} from '../../utils';

/** "Residual risk: Low (situation: High)", or undefined when the COA has no residual risk */
export const coaRiskText = (coa: CoaRow) => {
  if (!coa.risk) return undefined;
  const after = t('RISK5', levelIndex(coa.risk.after) ?? 0);
  const before = levelIndex(coa.risk.before);
  return before === undefined
    ? t('COA_RISK_SUMMARY_SHORT', { after })
    : t('COA_RISK_SUMMARY', { after, before: t('RISK5', before) });
};

export const conflictWarnings = (coa: CoaRow) =>
  coa.conflicts.map((c) => t('COA_CONFLICT', { value: c.label, situation: c.situation }));

const narrativeToBox = (model: DataModel, narrative: Narrative): DocxBoxTable[] => {
  const { categories = [], components = [] } = model.scenario;
  const selection = effectiveSelection(model.scenario, narrative);
  const toRows = (comps: ScenarioComponent[]) =>
    comps.map((c) => {
      const sel = selection[c.id];
      const selectedIds = Array.isArray(sel) ? sel : sel ? [sel] : [];
      return {
        label: c.label,
        values: (c.values || []).map((v) => ({
          label: v.label,
          selected: selectedIds.indexOf(v.id) >= 0,
        })),
      };
    });
  if (categories.length === 0) return [{ rows: toRows(components) }];
  return categories.map((category) => {
    const ids = category.componentIds || [];
    return {
      label: categories.length > 1 ? category.label : undefined,
      rows: toRows(components.filter((c) => ids.indexOf(c.id) >= 0)),
    };
  });
};

/** Download the narratives (with their courses of action and, optionally, the box) as a Word document */
export const exportNarrativesToWord = async (model: DataModel, narratives: Narrative[], includeBox = false) => {
  const narrData: DocxNarrative[] = narratives.map((narrative) => ({
    label: narrative.label,
    content: narrativeToMarkdown(narrative.desc),
    coas: narrativeCoaRows(model.scenario, narrative).map((coa) => ({
      label: coa.label,
      desc: coa.desc,
      notes: coa.notes,
      decisions: coa.decisions,
      warnings: conflictWarnings(coa),
      risk: coaRiskText(coa),
    })),
    box: includeBox ? narrativeToBox(model, narrative) : undefined,
  }));
  const title = model?.scenario?.label || 'Scenario';
  const filename = `${modelToSaveName(model, narratives.length === 1 ? narratives[0].label : undefined)}.docx`;
  await downloadAsDocx(title, narrData, filename, t('DECISIONS'));
};

/** Modal to export the current, the selected or all saved scenarios to Word */
export const ExportWordModal: FactoryComponent<{
  model: DataModel;
  narrative: Narrative;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}> = () => {
  let includeBox = false;
  return {
    view: ({ attrs: { model, narrative, isOpen, onToggle } }) => {
      const narratives = (model.scenario.narratives || []).filter((n) => n.saved);
      const selected = narratives.filter((n) => n.included);
      return m(ModalPanel, {
        id: 'exportToWord',
        title: t('EXPORT2WORD', 'TITLE'),
        isOpen,
        onToggle,
        fixedFooter: true,
        closeOnButtonClick: true,
        description: m(
          '.export-modal',
          m('.row', [
            m('.col.s12', t('EXPORT2WORD', 'DESC')),
            m(InputCheckbox, {
              className: 'col s12 mt3',
              checked: includeBox,
              label: t('EXPORT2WORD', 'INCLUDE_BOX'),
              onchange: (checked: boolean) => {
                includeBox = checked;
              },
            }),
          ]),
        ),
        options: { opacity: 0.7 },
        buttons: [
          { label: t('EXPORT2WORD', 'CURRENT'), onclick: () => exportNarrativesToWord(model, [narrative], includeBox) },
          {
            label: t('EXPORT2WORD', 'SELECTED'),
            disabled: selected.length === 0,
            onclick: () => exportNarrativesToWord(model, selected, includeBox),
          },
          { label: t('EXPORT2WORD', 'ALL'), onclick: () => exportNarrativesToWord(model, narratives, includeBox) },
          { label: t('CANCEL') },
        ],
      });
    },
  };
};
