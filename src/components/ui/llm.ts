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

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Base request interface
interface BaseRequest {
  messages: Message[];
  temperature: number;
  stream: boolean;
}

// API-specific request interfaces
interface OllamaRequest {
  messages: Array<{ role: 'user' | 'system'; content: string }>;
  /** JSON schema */
  format?: Record<string, any>;
  model: string;
  stream?: boolean;
  options?: {
    temperature?: number;
  };
}

// interface ClaudeRequest {
//   model: string;
//   messages: {
//     role: 'user' | 'assistant';
//     content: string;
//   }[];
//   system?: string;
//   temperature: number;
// }

interface OpenAIRequest extends BaseRequest {
  model: string;
}

// interface GeminiRequest {
//   contents: {
//     role: 'user' | 'model';
//     parts: {
//       text: string;
//     }[];
//   }[];
//   generationConfig: {
//     temperature: number;
//   };
// }

type LLMProvider = 'ollama' | 'claude' | 'openai' | 'gemini';

async function chatWithLLM(
  provider: LLMProvider,
  url: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  apiKey?: string
): Promise<string | undefined | { title: string; content: string }> {
  let requestBody: any;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  switch (provider) {
    case 'ollama':
      // url = `${url}${url.endsWith('/') ? '' : '/'}api/generate`;
      requestBody = {
        model,
        messages: [
          { role: 'user', content: userPrompt + '\n\nRespond using JSON.' },
        ],
        format: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title of the story',
            },
            content: {
              type: 'string',
              description: 'The main content of the story',
            },
          },
          required: ['title', 'content'],
          additionalProperties: false,
        },
        stream: false,
        options: { temperature },
      } as OllamaRequest;
      break;

    // case 'claude':
    //   if (!apiKey) throw new Error('API key required for Claude');
    //   headers['x-api-key'] = apiKey;
    //   // Claude doesn't support system messages in the messages array
    //   requestBody = {
    //     model,
    //     system: systemPrompt,
    //     messages: [{ role: 'user', content: userPrompt }],
    //     temperature,
    //   } as ClaudeRequest;
    //   break;

    case 'openai':
      if (!apiKey) throw new Error('API key required for OpenAI');
      headers['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        stream: false,
      } as OpenAIRequest;
      break;

    // case 'gemini':
    //   if (!apiKey) throw new Error('API key required for Gemini');
    //   // For Gemini, we append the API key to the URL instead of using a header
    //   url = `${url}?key=${apiKey}`;
    //   // Convert system prompt + user prompt into Gemini format
    //   requestBody = {
    //     contents: [
    //       {
    //         role: 'user',
    //         parts: [
    //           {
    //             text: `${systemPrompt}\n\n${userPrompt}`,
    //           },
    //         ],
    //       },
    //     ],
    //     generationConfig: {
    //       temperature,
    //     },
    //   } as GeminiRequest;
    //   break;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  console.log(
    `Request to ${provider}:`,
    JSON.stringify({ url, headers, body: requestBody }, null, 2)
  );

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      // Extract the response content based on the provider's response format
      switch (provider) {
        case 'ollama':
          try {
            const result = data?.message?.content
              ? (JSON.parse(data.message.content) as {
                  title: string;
                  content: string;
                })
              : undefined;
            if (!result) {
              console.warn(JSON.stringify(data, null, 2));
            }
            return result;
          } catch (e: any) {
            console.error(e);
            return '';
          }

        // case 'claude':
        //   return data.content?.[0]?.text;

        case 'openai':
          return data.choices?.[0]?.message?.content;

        // case 'gemini':
        //   return data.candidates?.[0]?.content?.parts?.[0]?.text;

        default:
          return undefined;
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      attempt++;
      // if (attempt < maxRetries) {
      //   const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      //   await new Promise((resolve) => setTimeout(resolve, delay));
      // }
    }
  }
  return undefined;
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
              { id: 'prompt', label: 'PROMPT', type: 'textare8' },
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
    .filter((c) => includedComponents.has(c.id) && narrative.components[c.id])
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

  const story = await chatWithLLM(
    id as LLMProvider,
    url,
    model,
    'You are a helpfull AI storywriter.',
    userPrompt,
    0.7,
    apiKey
  );
  return story;
};
