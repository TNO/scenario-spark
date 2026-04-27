import m from 'mithril';
import { LayoutForm, UIForm } from 'mithril-ui-form';
import { i18n, MeiosisComponent, saveModel, t } from '../../services';
import { Narrative } from '../../models';
import {
  Category,
  ID,
  Scenario,
  ScenarioComponent,
} from '../../models/data-model';
import { LLMClient } from '../../utils/llm-client';

export type PromptType = 'narrative' | 'effect' | 'persona' | 'communications';

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

export const LLMSelector: MeiosisComponent = () => {
  const form = (categories: Category[]) =>
    [
      {
        id: 'llm',
        label: t('LLM'),
        type: [
          {
            id: 'id',
            label: 'Service',
            type: 'select',
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
          {
            id: 'prompts',
            label: t('PROMPT_TYPE', 'PROMPTS'),
            repeat: true,
            pageSize: 4,
            max: 4,
            type: [
              {
                id: 'type',
                label: t('PROMPT_TYPE', 'LABEL'),
                type: 'select',
                options: [
                  { id: 'narrative', label: t('PROMPT_TYPE', 'NARRATIVE') },
                  // { id: 'effect', label: t('PROMPT_TYPE', 'EFFECT') },
                  // { id: 'persona', label: t('PROMPT_TYPE', 'PERSONA') },
                  // { id: 'communications', label: t('PROMPT_TYPE', 'COM') },
                ],
                className: 'col s12 m4',
              },
              {
                id: 'categories',
                label: 'Included categories',
                type: 'select',
                multiple: true,
                options: categories,
                className: 'col s12 m8',
              },
              {
                id: 'prompt',
                label: 'PROMPT',
                type: 'textarea',
              },
            ],
          },
        ] as UIForm<LLMConfig>,
      },
    ] as UIForm<Partial<Scenario>>;
  return {
    view: ({ attrs }) => {
      const {
        state: { model },
      } = attrs;
      const { categories = [] } = model.scenario || {};
      return m(LayoutForm<Partial<Scenario>>, {
        i18n: i18n.i18n,
        form: form(categories),
        obj: model.scenario,
        onchange: async () => {
          await saveModel(attrs, model);
        },
        //                onchange: (isValid) => {
        //   console.log(
        //     `LLMSelector model is valid ${isValid}:`,
        //     model.scenario.llm
        //   );
        //   saveModel(attrs, model);
        // },
      });
    },
  };
};

export const generateStory = async (
  config: LLMConfig,
  narrative: Narrative,
  categories: Category[],
  components: ScenarioComponent[],
  storyType: PromptType = 'narrative'
) => {
  const { id, apiKey, prompts = [] } = config;
  let storyPrompt = prompts.filter((p) => p.type === storyType).shift();
  if (
    !storyPrompt ||
    !storyPrompt.prompt ||
    !storyPrompt.categories ||
    storyPrompt.categories.length === 0
  )
    return '';
  const { prompt, categories: includedCategories = [] } = storyPrompt;

  console.log('Generating story with:', config, narrative, components);

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

  const includedComponents = categories
    .filter((c) => includedCategories.includes(c.id))
    .reduce((acc, cur) => {
      cur.componentIds?.forEach((id) => acc.add(id));
      return acc;
    }, new Set<string>());

  const lookup =
    components &&
    components
      .filter((c) => includedComponents.has(c.id))
      .reduce((acc, cur) => {
        cur.values &&
          cur.values.forEach((v) => {
            acc.set(cur.id + v.id, `${v.label}${v.desc ? ` (${v.desc})` : ''}`);
          });
        return acc;
      }, new Map() as Map<string, string>);

  // Translate narrative ids to labels
  const translatedNarrative = components
    .filter((c) => includedComponents.has(c.id) && Array.isArray(narrative.components[c.id]) && narrative.components[c.id].length > 0)
    .map((c) => {
      const values = narrative.components[c.id]
        .map((id) => lookup.get(c.id + id))
        .join(', ');
      return `- ${c.label}${c.desc ? ` (${c.desc})` : ''}: ${values}`;
    })
    .join('\n');

  console.log(translatedNarrative);

  const userPrompt =
    (prompt ?? '') +
    '\n\n' +
    // '\n\nCreate a story with the following elements:\n\n' +
    translatedNarrative;

  if (id === 'clipboard') return userPrompt;

  const result = await LLMClient.chat(
    { provider: id as 'ollama' | 'openai', url, model, apiKey, temperature: 0.7 },
    'You are a helpful AI storywriter.',
    userPrompt
  );

  if ((result as { error?: boolean })?.error) return '';
  if (!result) return '';
  return (result as { title: string; content: string }).content;
};
