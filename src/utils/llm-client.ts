import { t } from '../services';

export type LLMProvider = 'ollama' | 'openai' | 'clipboard';

export type LLMSettings = {
  provider: LLMProvider;
  url: string;
  model: string;
  apiKey?: string;
  temperature?: number;
};

export type LLMResponse = { title: string; content: string };

export type LLMError = { error: true; message: string };

export type LLMResult = LLMResponse | LLMError | null;

/** Shared LLM client with retry logic and provider abstraction */
export class LLMClient {
  static async chat(
    settings: LLMSettings,
    systemPrompt: string,
    userPrompt: string
  ): Promise<LLMResult> {
    if (settings.provider === 'clipboard') {
      return this.buildResponse(`${systemPrompt}\n\n${userPrompt}`);
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const temperature = settings.temperature ?? 0.7;
    let url = settings.url;

    if (settings.provider === 'openai' && !settings.apiKey) {
      return { error: true, message: 'API key required for OpenAI' };
    }

    let requestBody: Record<string, any>;

    if (settings.provider === 'ollama') {
      requestBody = {
        model: settings.model || 'gemma2',
        messages: [
          {
            role: 'user',
            content: `${t('RESPONSE_INSTRUCTIONS')}\n\n${userPrompt}`,
          },
        ],
        stream: false,
        options: { temperature },
      };
    } else if (settings.provider === 'openai') {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
      url = url || 'https://api.openai.com/v1/chat/completions';
      requestBody = {
        model: settings.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        stream: false,
      };
    } else {
      return { error: true, message: `Unsupported provider: ${settings.provider}` };
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        let text: string | undefined;

        if (settings.provider === 'ollama') {
          text = data?.message?.content;
        } else if (settings.provider === 'openai') {
          text = data.choices?.[0]?.message?.content;
        }

        if (!text) {
          return { error: true, message: 'Empty response from LLM' };
        }

        return this.buildResponse(text);
      } catch (error: any) {
        console.error(`LLM attempt ${attempt + 1} failed:`, error);
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return { error: true, message: 'LLM request failed after retries' };
  }

  /** Generate raw text (no title/content parsing) */
  static async chatRaw(
    settings: LLMSettings,
    prompt: string
  ): Promise<string | LLMError> {
    if (settings.provider === 'clipboard') {
      return prompt;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const temperature = settings.temperature ?? 0.7;
    let url = settings.url;

    if (settings.provider === 'openai' && !settings.apiKey) {
      return { error: true, message: 'API key required for OpenAI' };
    }

    let requestBody: Record<string, any>;

    if (settings.provider === 'ollama') {
      requestBody = {
        model: settings.model || 'gemma2',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature },
      };
    } else if (settings.provider === 'openai') {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
      url = url || 'https://api.openai.com/v1/chat/completions';
      requestBody = {
        model: settings.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature,
        stream: false,
      };
    } else {
      return { error: true, message: `Unsupported provider: ${settings.provider}` };
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (settings.provider === 'ollama') {
          return data?.message?.content || '';
        }
        return data.choices?.[0]?.message?.content || '';
      } catch (error: any) {
        console.error(`LLM attempt ${attempt + 1} failed:`, error);
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return { error: true, message: 'LLM request failed after retries' };
  }

  private static buildResponse(text: string): LLMResponse {
    try {
      const lines = text.trim().split('\n');
      const title = lines.find((line) => line.trim()) || '';
      const blankLineIndex = lines.findIndex(
        (line, idx) => idx > 0 && line.trim() === ''
      );

      let content: string;
      if (blankLineIndex !== -1) {
        content = lines.slice(blankLineIndex + 1).join('\n').trim();
      } else {
        const titleIndex = lines.indexOf(title);
        content = lines.slice(titleIndex + 1).join('\n').trim();
      }

      return { title, content };
    } catch {
      return { title: '', content: text };
    }
  }
}
