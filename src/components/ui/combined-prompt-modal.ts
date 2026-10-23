import m, { FactoryComponent } from 'mithril';
import { FlatButton, InputCheckbox, ModalPanel, TextArea, toast } from 'mithril-materialized';
import { CircularSpinner } from './preloader';
import type { MeiosisCell } from 'meiosis-setup/types';
import { saveNarrative, State, t } from '../../services';
import { Narrative, Persona } from '../../models';
import { buildDecisionInput, buildStoryInput } from '../../utils/decision';
import { narrativeToMarkdown } from '../../utils/index';
import { askLlmRaw } from './llm';
import { buildCombinedPrompt, CombinedResult, parseCombinedResponse } from '../../utils/combined-prompt';

export interface CombinedPromptModalAttrs {
  cell: MeiosisCell<State>;
  narrative: Narrative;
  /** Personas of the scenario */
  personas: Persona[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

const preview = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max)}…` : text);

/**
 * Copies one prompt for the narrative, the course-of-action reflections and the persona
 * feedback, and applies the pasted JSON answer to the selected fields. It stays open while
 * the user switches to the AI assistant.
 */
export const CombinedPromptModal: FactoryComponent<CombinedPromptModalAttrs> = () => {
  let answer = '';
  let result: CombinedResult | undefined;
  let parseError = false;
  let promptText = '';
  let busy = false;
  let wasOpen = false;
  /** Keys of the fields to apply: title, narrative, coa:<id>, persona:<id> */
  let selected = new Set<string>();

  const reset = () => {
    answer = '';
    result = undefined;
    parseError = false;
    promptText = '';
    busy = false;
    selected = new Set();
  };

  const decisionsIncluded = (cell: MeiosisCell<State>, narrative: Narrative) => {
    const { includeDecisionSupport, llm } = cell.state.model.scenario;
    const prompt = llm?.prompts?.find((p) => p.type === 'decision' && p.prompt?.trim());
    return includeDecisionSupport && prompt && narrative.coas?.length ? prompt : undefined;
  };

  const personaPrompt = (cell: MeiosisCell<State>) =>
    cell.state.model.scenario.llm?.prompts?.find((p) => p.type === 'persona' && p.prompt?.trim());

  const buildPrompt = ({ cell, narrative, personas }: CombinedPromptModalAttrs) => {
    const box = cell.state.model.scenario;
    const prompts = box.llm?.prompts || [];
    const narrativePrompt = prompts.find((p) => p.type === 'narrative');
    const decisionPrompt = decisionsIncluded(cell, narrative);
    const feedbackPrompt = personaPrompt(cell);
    return buildCombinedPrompt({
      narrative: {
        instructions: narrativePrompt?.prompt || t('LLM_DEFAULT_NARRATIVE_PROMPT'),
        input: buildStoryInput({
          box,
          narrative,
          includedCategories: narrativePrompt?.categories || box.categories.map((c) => c.id),
          storyType: 'narrative',
          tr: (key) => t(key),
        }),
        currentText: narrativeToMarkdown(narrative.desc),
      },
      decisions: decisionPrompt && {
        instructions: decisionPrompt.prompt,
        coas: (narrative.coas || []).map((coa) => ({
          id: coa.id,
          label: coa.label,
          // The situation is already part of the narrative task
          input: buildDecisionInput({
            box,
            narrative,
            coaId: coa.id,
            includedCategories: [],
            tr: (key, params) => (params ? t(key, params) : t(key)),
          }),
        })),
      },
      personas: feedbackPrompt && {
        instructions: feedbackPrompt.prompt,
        list: personas.map((p) => ({ id: p.id, label: p.label, desc: p.desc })),
      },
      tr: (key, params) => (params ? t(key, params) : t(key)),
    });
  };

  const parse = (attrs: CombinedPromptModalAttrs, value: string) => {
    answer = value;
    result = undefined;
    parseError = false;
    if (!value.trim()) return;
    try {
      result = parseCombinedResponse(value, attrs.narrative.coas || [], attrs.personas);
      selected = new Set([
        ...(result.title ? ['title'] : []),
        ...(result.narrative ? ['narrative'] : []),
        ...result.decisions.map((d) => `coa:${d.id}`),
        ...result.personas.map((p) => `persona:${p.id}`),
      ]);
    } catch {
      parseError = true;
    }
  };

  const apply = async ({ cell, narrative, onToggle }: CombinedPromptModalAttrs) => {
    if (!result) return;
    const { title, narrative: text, decisions, personas } = result;
    if (title && selected.has('title')) narrative.label = title;
    if (!narrative.label) narrative.label = title || t('NARRATIVE');
    if (text && selected.has('narrative')) narrative.desc = text;
    for (const { id, reflection } of decisions) {
      const coa = narrative.coas?.find((c) => c.id === id);
      if (coa && selected.has(`coa:${id}`)) coa.reflection = reflection;
    }
    for (const { id, feedback } of personas) {
      if (!selected.has(`persona:${id}`)) continue;
      narrative.personaEffects ??= {};
      narrative.personaEffects[id] = { ...narrative.personaEffects[id], story: feedback };
    }
    await saveNarrative(cell, narrative);
    toast({ html: t('COMBINED_APPLIED') });
    reset();
    onToggle(false);
  };

  const copyPrompt = async (attrs: CombinedPromptModalAttrs) => {
    const prompt = buildPrompt(attrs);
    try {
      await navigator.clipboard.writeText(prompt);
      promptText = '';
      toast({ html: t('COMBINED_COPIED') });
    } catch (error) {
      console.error(error);
      // Let the user copy it by hand
      promptText = prompt;
    }
    m.redraw();
  };

  const option = (key: string, label: string, value: string, existing?: string) =>
    m('.combined-option', [
      m(InputCheckbox, {
        label: existing?.trim() ? `${label} (${t('COMBINED_REPLACES')})` : label,
        checked: selected.has(key),
        onchange: (checked: boolean) => {
          if (checked) selected.add(key);
          else selected.delete(key);
        },
      }),
      m('p.grey-text.combined-preview', preview(value)),
    ]);

  return {
    view: ({ attrs }) => {
      const { cell, narrative, personas, isOpen, onToggle } = attrs;
      const llm = cell.state.model.scenario.llm;
      const viaApi = !!llm && llm.id !== 'clipboard';
      // Opening the dialog copies the prompt right away, so the user can paste it immediately
      if (isOpen && !wasOpen && !viaApi) copyPrompt(attrs);
      wasOpen = isOpen;
      return m(ModalPanel, {
        id: 'combinedPrompt',
        title: t('COMBINED_TITLE'),
        isOpen,
        fixedFooter: true,
        closeOnBackdropClick: false,
        onToggle: (open) => {
          if (!open) reset();
          onToggle(open);
        },
        description: t(viaApi ? 'COMBINED_HINT_API' : 'COMBINED_HINT'),
        content: m('.combined-prompt', [
          viaApi &&
            m(FlatButton, {
              label: t('COMBINED_GENERATE'),
              iconName: 'auto_awesome',
              disabled: busy,
              onclick: async () => {
                busy = true;
                m.redraw();
                try {
                  parse(attrs, await askLlmRaw(llm, buildPrompt(attrs)));
                } catch (error) {
                  console.error(error);
                  toast({ html: t('COMBINED_GENERATE_ERROR') });
                } finally {
                  busy = false;
                  m.redraw();
                }
              },
            }),
          m(FlatButton, {
            label: t('COMBINED_COPY'),
            iconName: 'content_copy',
            onclick: () => copyPrompt(attrs),
          }),
          busy && m(CircularSpinner),
          promptText && m(TextArea, { label: t('LLM_PROMPT_TEXT'), value: promptText, readonly: true }),
          m(TextArea, {
            label: t('COMBINED_PASTE'),
            value: answer,
            oninput: (value: string) => parse(attrs, value),
          }),
          parseError && m('p.red-text', t('COMBINED_PARSE_ERROR')),
          result && [
            result.title && option('title', t('COMBINED_FIELD_TITLE'), result.title, narrative.label),
            result.narrative &&
              option('narrative', t('COMBINED_FIELD_NARRATIVE'), result.narrative, narrativeToMarkdown(narrative.desc)),
            result.decisions.map(({ id, reflection }) => {
              const coa = narrative.coas?.find((c) => c.id === id);
              return option(`coa:${id}`, `${t('COA_REFLECTION')}: ${coa?.label}`, reflection, coa?.reflection);
            }),
            result.personas.map(({ id, feedback }) => {
              const persona = personas.find((p) => p.id === id);
              return option(
                `persona:${id}`,
                `${t('PERSONA_IMPRESSION')}: ${persona?.label}`,
                feedback,
                narrative.personaEffects?.[id]?.story,
              );
            }),
            result.unmatched.length > 0 &&
              m('p.orange-text', t('COMBINED_UNMATCHED', { names: result.unmatched.join(', ') })),
          ],
        ]),
        buttons: [
          {
            label: t('CANCEL'),
            onclick: () => {
              reset();
              onToggle(false);
            },
          },
          {
            label: t('COMBINED_APPLY'),
            disabled: !result || selected.size === 0,
            onclick: () => void apply(attrs),
          },
        ],
      });
    },
  };
};
