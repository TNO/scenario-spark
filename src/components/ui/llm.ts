import m from 'mithril';
import { FormAttributes, LayoutForm, UIForm } from 'mithril-ui-form';
import { i18n, MeiosisComponent, saveModel, t } from '../../services';
import { DataModel, Narrative } from '../../models';
import { Category, ScenarioComponent } from '../../models/data-model';

export interface LLMConfig {
  id: string;
  apiKey?: string;
  model?: string;
  url: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
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
interface OllamaRequest extends BaseRequest {
  model: string;
}

interface ClaudeRequest {
  model: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  system?: string;
  temperature: number;
}

interface OpenAIRequest extends BaseRequest {
  model: string;
}

interface GeminiRequest {
  contents: {
    role: 'user' | 'model';
    parts: {
      text: string;
    }[];
  }[];
  generationConfig: {
    temperature: number;
  };
}

type LLMProvider = 'ollama' | 'claude' | 'openai' | 'gemini';

async function chatWithLLM(
  provider: LLMProvider,
  url: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  apiKey?: string
): Promise<string | undefined> {
  try {
    let requestBody: any;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (provider) {
      case 'ollama':
        requestBody = {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          temperature,
        } as OllamaRequest;
        break;

      case 'claude':
        if (!apiKey) throw new Error('API key required for Claude');
        headers['x-api-key'] = apiKey;
        // Claude doesn't support system messages in the messages array
        requestBody = {
          model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          temperature,
        } as ClaudeRequest;
        break;

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

      case 'gemini':
        if (!apiKey) throw new Error('API key required for Gemini');
        // For Gemini, we append the API key to the URL instead of using a header
        url = `${url}?key=${apiKey}`;
        // Convert system prompt + user prompt into Gemini format
        requestBody = {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\n${userPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature,
          },
        } as GeminiRequest;
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    console.log(
      `Request to ${provider}:`,
      JSON.stringify({ url, headers, body: requestBody }, null, 2)
    );

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
        return data.message?.content;

      case 'claude':
        return data.content?.[0]?.text;

      case 'openai':
        return data.choices?.[0]?.message?.content;

      case 'gemini':
        return data.candidates?.[0]?.content?.parts?.[0]?.text;

      default:
        return undefined;
    }
  } catch (error) {
    console.error(`Failed to chat with ${provider}:`, error);
    return undefined;
  }
}

export const LLMSelector: MeiosisComponent = () => {
  return {
    view: ({ attrs }) => {
      const {
        state: { model },
      } = attrs;
      return m(LayoutForm, {
        i18n: i18n.i18n,
        form: [
          {
            id: 'llm',
            label: t('LLM'),
            type: [
              {
                id: 'id',
                label: 'Service',
                type: 'select',
                className: 'col s12 m4',
                options: [
                  { id: 'ollama', label: 'Ollama' },
                  { id: 'gemini', label: 'Gemini' },
                  { id: 'claude', label: 'Claude' },
                  { id: 'openai', label: 'OpenAI' },
                ],
              },
              {
                id: 'model',
                label: t('MODEL'),
                value: 'llama3.3',
                className: 'col s12 m4',
                type: 'text',
              },
              {
                id: 'temperature',
                label: t('TEMPERATURE'),
                className: 'col s12 m4',
                type: 'number',
                value: '0.7',
                min: 0,
                max: 1,
                step: 0.1,
              },
              {
                id: 'apiKey',
                show: 'id!=ollama',
                label: t('API_KEY'),
                type: 'text',
              },
              {
                id: 'systemPrompt',
                label: t('SYSTEM_PROMPT'),
                type: 'textarea',
              },
              { id: 'userPrompt', label: t('USER_PROMPT'), type: 'textarea' },
              {
                id: 'url',
                label: t('URL'),
                type: 'url',
                className: 'col s12 m6',
                show: 'id=ollama',
              },
            ] as UIForm<LLMConfig>,
          },
        ],
        obj: model,
        onchange: () => {
          console.log('LLMSelector model:', model.llm);
          saveModel(attrs, model);
        },
      } as FormAttributes<Partial<DataModel>>);
    },
  };
};

export const generateStory = async (
  config: LLMConfig,
  narrative: Narrative,
  categories: Category[],
  components: ScenarioComponent[]
) => {
  const { id, apiKey, systemPrompt, url: ollama, userPrompt } = config;
  let { model } = config;

  console.log('Generating story with:', config, narrative, components);

  let url: string;
  switch (id) {
    case 'ollama':
      url = ollama;
      if (!model) model = 'llama3.3';
      break;
    case 'gemini':
      url =
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
      if (!model) model = 'gemini-pro';
      break;
    case 'claude':
      url = 'https://api.anthropic.com/v1/messages';
      if (!model) model = 'claude-3-5-sonnet-latest';
      break;
    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions';
      if (!model) model = 'gpt-4o-mini';
      break;
    default:
      throw new Error(`Unknown service: ${id}`);
  }

  const includedComponents = categories
    .filter((c) => c.includeLLM)
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
      return `${c.label}${c.desc ? ` (${c.desc})` : ''}: ${values}`;
    })
    .join('\n');

  console.log(translatedNarrative);

  const story = await chatWithLLM(
    id as LLMProvider,
    url,
    model,
    systemPrompt ?? 'You are a helpfull AI storywriter.',
    (userPrompt ?? 'Create a scenario with the following elements:') +
      '\n\n' +
      translatedNarrative,
    0.7,
    apiKey
  );
  return story;
};
