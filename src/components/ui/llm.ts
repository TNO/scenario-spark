import m from 'mithril';
import { FormAttributes, LayoutForm, UIForm } from 'mithril-ui-form';
import { i18n, MeiosisComponent, saveModel } from '../../services';
import { DataModel, Narrative } from '../../models';
import { ScenarioComponent } from '../../models/data-model';

export interface LLMConfig {
  id: string;
  apiKey?: string;
  model?: string;
  url: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
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
            label: 'LLM',
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
                  { id: 'chatgpt', label: 'ChatGPT' },
                ],
              },
              {
                id: 'model',
                label: 'Model',
                value: 'llama3.3',
                className: 'col s12 m4',
                type: 'text',
              },
              {
                id: 'temperature',
                label: 'Temperature',
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
                label: 'API Key',
                type: 'text',
              },
              { id: 'systemPrompt', label: 'System prompt', type: 'textarea' },
              { id: 'userPrompt', label: 'User prompt', type: 'textarea' },
              { id: 'url', label: 'URL', type: 'url', className: 'col s12 m6' },
              {
                id: 'apiKey',
                show: 'id!=ollama',
                label: 'API Key',
                type: 'text',
                className: 'col s12 m6',
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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
}

async function chatWithOllama(
  url: string,
  model: string = 'llama3.3',
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7
): Promise<string | undefined> {
  const requestBody: ChatRequest = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    stream: false,
    temperature: temperature,
  };

  try {
    const body = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    };
    console.log(JSON.stringify(body));
    const response = await fetch(url, body);

    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    console.error('Failed to chat with Ollama:', error);
    return undefined;
  }
}

export const generateStory = async (
  config: LLMConfig,
  narrative: Narrative,
  components: ScenarioComponent[]
) => {
  const { id, apiKey, systemPrompt, url: ollama, userPrompt } = config;

  console.log('Generating story with:', config, narrative, components);

  let url: string;
  switch (id) {
    case 'ollama':
      url = ollama;
      break;
    case 'gemini':
      url = 'https://api.openai.com/v1/engines/davinci/completions';
      break;
    case 'claude':
      url = 'https://api.openai.com/v1/engines/text-davinci-003/completions';
      break;
    case 'chatgpt':
      url = 'https://api.openai.com/v1/engines/text-davinci-003/completions';
      break;
    default:
      throw new Error(`Unknown service: ${id}`);
  }

  const lookup =
    components &&
    components.reduce((acc, cur) => {
      cur.values &&
        cur.values.forEach((v) => {
          acc.set(cur.id + v.id, `${v.label}${v.desc ? ` (${v.desc})` : ''}`);
        });
      return acc;
    }, new Map() as Map<string, string>);

  // Translate narrative ids to labels
  const translatedNarrative = components
    .filter((c) => narrative.components[c.id])
    .map((c) => {
      const values = narrative.components[c.id]
        .map((id) => lookup.get(c.id + id))
        .join(', ');
      return `${c.label}${c.desc ? ` (${c.desc})` : ''}: ${values}`;
    })
    .join('\n');

  console.log(translatedNarrative);

  const story = await chatWithOllama(
    url,
    'llama3.3',
    systemPrompt ?? 'You are a helpfull AI storywriter.',
    (userPrompt ?? 'Create a scenario with the following elements:') +
      '\n\n' +
      translatedNarrative,
    0.7
  );
  return story;
};
