import m from 'mithril';
import { LayoutForm, UIForm } from 'mithril-ui-form';
import { Select, TextArea, toast } from 'mithril-materialized';
import { i18n, MeiosisComponent, saveModel, t } from '../../services';
import { Narrative, Persona } from '../../models';
import {
  Category,
  ID,
  Scenario,
} from '../../models/data-model';
import { LLMClient } from '../../utils/llm-client';
import { buildDecisionInput, buildStoryInput } from '../../utils/decision';

export type PromptType = 'narrative' | 'effect' | 'persona' | 'communications' | 'decision';

export type Prompt = {
  type: PromptType;
  prompt: string;
  categories: ID[];
};
export interface LLMConfig {
  id: string;
  apiKey?: string;
  model?: string;
  url: string;
  prompts: Prompt[];
  temperature?: number;
  autoLLMCount?: number;
}

const LEGACY_MULTILINGUAL_DEFAULT_NARRATIVE_PROMPT = [
  'EN: Use the following elements to define a realistic scenario.',
  'NL: Gebruik de volgende elementen om een realistisch scenario te definieren.',
  'FR: Utilisez les elements suivants pour definir un scenario realiste.',
  'DE: Verwenden Sie die folgenden Elemente, um ein realistisches Szenario zu definieren.',
  'ES: Utiliza los siguientes elementos para definir un escenario realista.',
  'PL: Uzyj ponizszych elementow, aby zdefiniowac realistyczny scenariusz.',
].join('\n');

const getDefaultNarrativePrompt = () => t('LLM_DEFAULT_NARRATIVE_PROMPT');
const getDefaultPersonaPrompt = () => t('LLM_DEFAULT_PERSONA_PROMPT');
const getDefaultDecisionPrompt = () => t('LLM_DEFAULT_DECISION_PROMPT');

export const ensureDefaultLLMConfig = (
  scenario: Partial<Scenario>,
  categories: Category[],
): boolean => {
  const allCategoryIds = categories.map((c) => c.id);
  const defaultNarrativePrompt: Prompt = {
    type: 'narrative',
    categories: allCategoryIds,
    prompt: getDefaultNarrativePrompt(),
  };
  const defaultPersonaPrompt: Prompt = {
    type: 'persona',
    categories: allCategoryIds,
    prompt: getDefaultPersonaPrompt(),
  };

  let changed = false;

  if (!scenario.llm) {
    scenario.llm = {
      id: 'clipboard',
      url: '',
      model: 'gemma3',
      temperature: 0.7,
      prompts: [defaultNarrativePrompt, defaultPersonaPrompt],
    };
    ensureDecisionPrompt(scenario, allCategoryIds);
    return true;
  }

  if (!scenario.llm.id) {
    scenario.llm.id = 'clipboard';
    changed = true;
  }

  if (!Array.isArray(scenario.llm.prompts)) {
    scenario.llm.prompts = [defaultNarrativePrompt, defaultPersonaPrompt];
    changed = true;
  }

  const narrativePrompt = scenario.llm.prompts.find(
    (p) => p.type === 'narrative',
  );
  if (!narrativePrompt) {
    scenario.llm.prompts.push(defaultNarrativePrompt);
    changed = true;
  } else {
    if (
      !Array.isArray(narrativePrompt.categories) ||
      narrativePrompt.categories.length === 0
    ) {
      narrativePrompt.categories = allCategoryIds;
      changed = true;
    }
    if (
      !narrativePrompt.prompt?.trim() ||
      narrativePrompt.prompt === LEGACY_MULTILINGUAL_DEFAULT_NARRATIVE_PROMPT
    ) {
      narrativePrompt.prompt = getDefaultNarrativePrompt();
      changed = true;
    }
  }

  const personaPrompt = scenario.llm.prompts.find((p) => p.type === 'persona');
  if (!personaPrompt) {
    scenario.llm.prompts.push(defaultPersonaPrompt);
    changed = true;
  } else {
    if (
      !Array.isArray(personaPrompt.categories) ||
      personaPrompt.categories.length === 0
    ) {
      personaPrompt.categories = allCategoryIds;
      changed = true;
    }
    if (!personaPrompt.prompt?.trim()) {
      personaPrompt.prompt = getDefaultPersonaPrompt();
      changed = true;
    }
  }

  return ensureDecisionPrompt(scenario, allCategoryIds) || changed;
};

/** Add the decision-reflection prompt when decision support is on; user text is kept. */
const ensureDecisionPrompt = (scenario: Partial<Scenario>, allCategoryIds: ID[]) => {
  const prompts = scenario.llm?.prompts;
  if (!scenario.includeDecisionSupport || !prompts) return false;
  const decisionPrompt = prompts.find((p) => p.type === 'decision');
  if (!decisionPrompt) {
    prompts.push({ type: 'decision', categories: allCategoryIds, prompt: getDefaultDecisionPrompt() });
    return true;
  }
  let changed = false;
  if (!Array.isArray(decisionPrompt.categories) || decisionPrompt.categories.length === 0) {
    decisionPrompt.categories = allCategoryIds;
    changed = true;
  }
  if (!decisionPrompt.prompt?.trim()) {
    decisionPrompt.prompt = getDefaultDecisionPrompt();
    changed = true;
  }
  return changed;
};

export const LLMSelector: MeiosisComponent = () => {
  type EditablePromptType = 'narrative' | 'persona' | 'decision';
  let selectedType: EditablePromptType = 'narrative';
  let configuredScenario: Scenario | undefined;
  const PromptTypeSelect = Select<EditablePromptType>();
  const CategorySelect = Select<ID>();
  const form = () =>
    [
      {
        id: 'llm',
        label: t('LLM'),
        type: [
          {
            id: 'id',
            label: 'Service',
            type: 'select',
            value: 'clipboard',
            className: 'col s12 m3',
            options: [
              { id: 'ollama', label: 'Ollama' },
              { id: 'openai', label: 'OpenAI' },
              { id: 'clipboard', label: 'Clipboard' },
            ],
          },
          {
            id: 'model',
            label: t('MODEL'),
            value: 'gemma3',
            className: 'col s12 m3',
            type: 'text',
          },
          {
            id: 'temperature',
            label: t('TEMPERATURE', 'BTN'),
            description: t('TEMPERATURE', 'DESC'),
            className: 'col s12 m3',
            type: 'number',
            value: '0.7',
            min: 0,
            max: 1,
            step: 0.1,
          },
          // {
          //   id: 'autoLLMCount',
          //   label: t('AUTO_CREATE', 'COUNT'),
          //   description: t('AUTO_CREATE', 'COUNT_DESC'),
          //   className: 'col s12 m3',
          //   type: 'number',
          //   value: '10',
          //   min: 0,
          //   max: 100,
          //   step: 1,
          // },
          {
            id: 'apiKey',
            show: 'id=openai',
            label: t('API_KEY'),
            type: 'text',
            className: 'col s12 m3',
          },
          {
            id: 'url',
            label: t('URL'),
            description: t('OLLAMA_URL'),
            type: 'url',
            className: 'col s12 m6',
            show: 'id!=clipboard',
          },
        ] as UIForm<LLMConfig>,
      },
    ] as UIForm<Partial<Scenario>>;
  return {
    oninit: async ({ attrs }) => {
      const {
        state: { model },
      } = attrs;
      const { categories = [] } = model.scenario || {};
      if (ensureDefaultLLMConfig(model.scenario, categories)) {
        await saveModel(attrs, model);
      }
      configuredScenario = model.scenario;
    },
    onbeforeupdate: ({ attrs }) => {
      const {
        state: { model },
      } = attrs;
      const { categories = [] } = model.scenario || {};
      if (configuredScenario !== model.scenario) {
        if (ensureDefaultLLMConfig(model.scenario, categories)) {
          void saveModel(attrs, model);
        }
        configuredScenario = model.scenario;
      }
      return true;
    },
    view: ({ attrs }) => {
      const {
        state: { model },
      } = attrs;
      const { categories = [] } = model.scenario || {};
      const prompts = model.scenario.llm?.prompts || [];
      if (!prompts.some((p) => p.type === selectedType)) selectedType = 'narrative';
      const selectedPrompt = prompts.find((p) => p.type === selectedType);
      const hasDecisionPrompt = prompts.some((p) => p.type === 'decision');
      return m('div', [
        m(LayoutForm<Partial<Scenario>>, {
          i18n: i18n.i18n,
          form: form(),
          obj: model.scenario,
          onchange: async () => {
            await saveModel(attrs, model);
          },
        }),
        selectedPrompt &&
          m('.row.llm-prompt-editor', [
            m(PromptTypeSelect, {
              label: t('PROMPT_TYPE', 'LABEL'),
              className: 'col s12 m4',
              checkedId: selectedType,
              options: [
                { id: 'narrative', label: t('PROMPT_TYPE', 'NARRATIVE') },
                { id: 'persona', label: t('PROMPT_TYPE', 'PERSONA') },
                ...(hasDecisionPrompt
                  ? [{ id: 'decision' as const, label: t('PROMPT_TYPE', 'DECISION') }]
                  : []),
              ],
              onchange: (ids) => {
                if (ids[0] === 'narrative' || ids[0] === 'persona' || ids[0] === 'decision') {
                  selectedType = ids[0];
                }
              },
            }),
            m(CategorySelect, {
              label: t('LLM_INCLUDED_CATEGORIES'),
              className: 'col s12 m8',
              multiple: true,
              checkedId: selectedPrompt.categories,
              options: categories,
              onchange: async (ids) => {
                if (ids.length === 0) {
                  toast({ html: t('LLM_CATEGORY_REQUIRED') });
                  return;
                }
                selectedPrompt.categories = ids;
                await saveModel(attrs, model);
              },
            }),
            m(TextArea, {
              label: t('LLM_PROMPT_TEXT'),
              className: 'col s12',
              value: selectedPrompt.prompt,
              oninput: (value) => {
                selectedPrompt.prompt = value;
              },
              onchange: async (value) => {
                selectedPrompt.prompt = value;
                await saveModel(attrs, model);
              },
            }),
          ]),
      ]);
    },
  };
};

export const generateStory = async (
  config: LLMConfig,
  narrative: Narrative,
  box: Pick<Scenario, 'categories' | 'components' | 'includeDecisionSupport'>,
  storyType: PromptType = 'narrative',
  personaContext?: {
    target: Persona;
    selected: Persona[];
    narrativeText: string;
  },
  decisionContext?: {
    /** COA to assess; default the active COA */
    coaId?: ID;
    narrativeText?: string;
  },
) => {
  const { id, apiKey, prompts = [] } = config;
  let storyPrompt = prompts.filter((p) => p.type === storyType).shift();
  if (
    !storyPrompt ||
    !storyPrompt.prompt ||
    !storyPrompt.categories ||
    storyPrompt.categories.length === 0
  ) {
    if (storyType === 'persona' || storyType === 'decision') {
      throw new Error(`Configure a ${storyType} prompt with at least one category.`);
    }
    return '';
  }
  const { prompt, categories: includedCategories = [] } = storyPrompt;

  let url = config.url || '';
  let model = config.model || '';
  switch (id) {
    case 'clipboard':
      break;
    case 'ollama':
      break;
    case 'openai':
      url = url || 'https://api.openai.com/v1/chat/completions';
      model = model || 'gpt-4o-mini';
      break;
    default:
      throw new Error(`Unknown service: ${id}`);
  }

  if (storyType === 'decision') {
    const userPrompt = [
      prompt,
      buildDecisionInput({
        box,
        narrative,
        coaId: decisionContext?.coaId,
        includedCategories,
        narrativeText: decisionContext?.narrativeText,
        tr: (key, params) => (params ? t(key, params) : t(key)),
      }),
    ].join('\n\n');
    if (id === 'clipboard') return userPrompt;
    const result = await LLMClient.chatRaw(
      { provider: id as 'ollama' | 'openai', url, model, apiKey, temperature: config.temperature },
      userPrompt,
    );
    if (typeof result !== 'string') throw new Error(result.message);
    if (!result.trim()) throw new Error('Empty response from LLM');
    return result.trim();
  }

  // Situation and suggested actions (decision categories) as separate sections
  const translatedNarrative = buildStoryInput({
    box,
    narrative,
    includedCategories,
    storyType,
    tr: (key) => t(key),
  });

  if (storyType === 'persona' && !personaContext) {
    throw new Error('Persona context is required for feedback generation.');
  }
  const userPrompt = [
    prompt,
    translatedNarrative,
    personaContext && t('LLM_PERSONA_CONTEXT', {
      personas: personaContext.selected
        .map((p) => `- ${p.label}${p.desc ? `: ${p.desc}` : ''}`)
        .join('\n'),
    }),
    personaContext && t('LLM_PERSONA_TARGET', { persona: personaContext.target.label }),
    personaContext?.narrativeText &&
      t('LLM_SCENARIO_TEXT', { narrative: personaContext.narrativeText }),
  ]
    .filter(Boolean)
    .join('\n\n');

  if (id === 'clipboard') return userPrompt;

  if (storyType === 'persona') {
    const result = await LLMClient.chatRaw(
      { provider: id as 'ollama' | 'openai', url, model, apiKey, temperature: config.temperature },
      userPrompt,
    );
    if (typeof result !== 'string') throw new Error(result.message);
    if (!result.trim()) throw new Error('Empty response from LLM');
    return result.trim();
  }

  const result = await LLMClient.chat(
    {
      provider: id as 'ollama' | 'openai',
      url,
      model,
      apiKey,
      temperature: 0.7,
    },
    'You are a helpful AI storywriter.',
    userPrompt,
  );

  if ((result as { error?: boolean })?.error) return '';
  if (!result) return '';
  return (result as { title: string; content: string }).content;
};
