import m, { FactoryComponent } from 'mithril';
import {
  InputCheckbox,
  LinearProgress,
  ModalPanel,
  NumberInput,
  Select,
  SelectAttrs,
  TextInput,
  toast,
  uniqueId,
} from 'mithril-materialized';
import { createCoverageGenerator } from 'morphological-box';
import type { MeiosisCell } from 'meiosis-setup/types';
import { ID, Narrative } from '../../models';
import { saveModel, State, t } from '../../services';
import { hasNarrativeText } from '../../utils';

/** Time per chunk before yielding to the browser, so the progress bar can update. */
const CHUNK_MS = 30;

/** Distinct batch names with their number of narratives. */
export const narrativeBatches = (narratives: Narrative[] = []) => {
  const batches = new Map<string, number>();
  narratives.forEach((n) => n.batch && batches.set(n.batch, (batches.get(n.batch) || 0) + 1));
  return batches;
};

export const CoverageModal: FactoryComponent<{
  cell: MeiosisCell<State>;
  /** Values per component to keep in every generated scenario */
  locked: Record<ID, ID[]>;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}> = () => {
  let count = 20;
  let batch = '';
  let pairs = false;
  let running = false;
  let stopRequested = false;
  let done = 0;

  const run = async (cell: MeiosisCell<State>, locked: Record<ID, ID[]>, close: () => void) => {
    const { model } = cell.state;
    const { scenario } = model;
    const name = batch.trim() || t('COVERAGE_BATCH_DEFAULT');
    const total = Math.max(1, Math.floor(count));
    const existing = (scenario.narratives || []).filter((n) => n.included).map((n) => n.components);
    const generator = createCoverageGenerator(scenario, { locked, existing, strength: pairs ? 2 : 1 });
    const width = String(total).length;
    const created: Narrative[] = [];
    let exhausted = false;
    running = true;
    stopRequested = false;
    done = 0;
    while (created.length < total && !exhausted && !stopRequested) {
      const start = performance.now();
      while (created.length < total && performance.now() - start < CHUNK_MS) {
        const result = generator.next();
        if (!result) {
          exhausted = true;
          break;
        }
        created.push({
          id: uniqueId(),
          label: `${name} ${String(created.length + 1).padStart(width, '0')}`,
          components: result.selection,
          included: true,
          saved: true,
          batch: name,
        } as Narrative);
      }
      done = created.length;
      m.redraw();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    running = false;
    if (created.length > 0) {
      scenario.narratives = [...(scenario.narratives || []), ...created];
      await saveModel(cell, model);
    }
    toast({
      html:
        exhausted && created.length < total
          ? t('COVERAGE_EXHAUSTED', { count: created.length })
          : t('COVERAGE_DONE', { count: created.length, batch: name }),
    });
    close();
  };

  return {
    view: ({ attrs: { cell, locked, isOpen, onToggle } }) => {
      if (!batch) {
        const batches = narrativeBatches(cell.state.model.scenario.narratives);
        let i = batches.size + 1;
        while (batches.has(`${t('COVERAGE_BATCH_DEFAULT')} ${i}`)) i++;
        batch = `${t('COVERAGE_BATCH_DEFAULT')} ${i}`;
      }
      const close = () => {
        batch = '';
        onToggle(false);
      };
      return m(ModalPanel, {
        id: 'coverageModal',
        title: t('COVERAGE_TITLE'),
        isOpen,
        onToggle: (open) => (open ? onToggle(true) : running ? (stopRequested = true) : close()),
        closeOnBackdropClick: !running,
        closeOnEsc: !running,
        closeOnButtonClick: false,
        content: m('.row', [
          m('p.col.s12', t('COVERAGE_DESC')),
          m(NumberInput, {
            className: 'col s12 m4',
            label: t('COVERAGE_COUNT'),
            min: 1,
            max: 10000,
            value: count,
            disabled: running,
            oninput: (v) => (count = v),
          }),
          m(TextInput, {
            className: 'col s12 m8',
            label: t('COVERAGE_BATCH_NAME'),
            value: batch,
            disabled: running,
            oninput: (v) => (batch = v),
          }),
          m(
            '.col.s12',
            m(InputCheckbox, {
              label: t('COVERAGE_PAIRS'),
              checked: pairs,
              disabled: running,
              onchange: (v) => (pairs = v),
            }),
          ),
          running &&
            m(
              '.col.s12',
              m(LinearProgress, {
                mode: 'determinate',
                value: done,
                max: Math.max(1, Math.floor(count)),
                label: t('COVERAGE_PROGRESS', { done, total: Math.floor(count) }),
              }),
            ),
        ]),
        buttons: running
          ? [{ label: t('COVERAGE_STOP'), onclick: () => (stopRequested = true) }]
          : [
              { label: t('CANCEL'), onclick: close },
              {
                label: t('COVERAGE_START'),
                iconName: 'auto_awesome_motion',
                disabled: !(count >= 1),
                onclick: () => run(cell, locked, close),
              },
            ],
      });
    },
  };
};

export const DeleteBatchModal: FactoryComponent<{
  cell: MeiosisCell<State>;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  /** Called with the ids of the deleted narratives */
  onDeleted?: (ids: Set<ID>) => void;
}> = () => {
  let selected: string | undefined;
  let keepWithText = true;

  return {
    view: ({ attrs: { cell, isOpen, onToggle, onDeleted } }) => {
      const { model } = cell.state;
      const narratives = model.scenario.narratives || [];
      const batches = narrativeBatches(narratives);
      if (selected && !batches.has(selected)) selected = undefined;
      const toDelete = narratives.filter(
        (n) => selected && n.batch === selected && !(keepWithText && hasNarrativeText(n)),
      );
      return m(ModalPanel, {
        id: 'deleteBatchModal',
        title: t('DELETE_BATCH_TITLE'),
        isOpen,
        onToggle,
        closeOnButtonClick: true,
        content: m('.row', [
          m(Select<string>, {
            className: 'col s12',
            label: t('DELETE_BATCH_SELECT'),
            placeholder: t('i18n', 'pickOne'),
            checkedId: selected,
            options: [...batches].map(([id, n]) => ({ id, label: `${id} (${n})` })),
            onchange: (v) => {
              selected = v[0];
              // The dropdown is rendered in a portal inside modals, which does not trigger a redraw itself
              m.redraw();
            },
          } as SelectAttrs<string>),
          m(
            '.col.s12',
            m(InputCheckbox, {
              label: t('DELETE_BATCH_KEEP_TEXT'),
              checked: keepWithText,
              onchange: (v) => (keepWithText = v),
            }),
          ),
        ]),
        buttons: [
          { label: t('CANCEL') },
          {
            label: `${t('DELETE')} (${toDelete.length})`,
            className: 'red-text',
            disabled: toDelete.length === 0,
            onclick: async () => {
              const ids = new Set(toDelete.map((n) => n.id));
              model.scenario.narratives = narratives.filter((n) => !ids.has(n.id));
              await saveModel(cell, model);
              onDeleted?.(ids);
              toast({ html: t('DELETE_BATCH_DONE', { count: ids.size }) });
              selected = undefined;
            },
          },
        ],
      });
    },
  };
};
