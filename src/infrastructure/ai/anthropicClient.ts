/**
 * AI text completion shared by `why --ai`, `suggest`, `analyze --ai`,
 * `lint --ai`, and `lint --fix --ai`.
 *
 * Providers: Anthropic (default), OpenAI, and local Ollama.
 */

import type { AiConfig, AiProviderName } from '../../domain/Config.js';
import { validateOllamaEndpoint } from './validateOllamaEndpoint.js';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_OLLAMA_MODEL = 'llama3.1';
export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';

export interface AnthropicCompleteOptions {
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

export interface ResolvedAiOptions {
  provider: AiProviderName;
  model: string;
  maxTokens: number;
  /** Present when provider is `anthropic` or `openai`. */
  apiKey?: string;
  /** Present when provider is `ollama` (validated origin). */
  endpoint?: string;
}

export interface AiResolveOverrides {
  maxTokens?: number;
  model?: string;
  provider?: AiProviderName;
}

/**
 * Call Anthropic Messages API and return the first text block.
 *
 * @throws when the HTTP response is not OK or the body has no text.
 */
export async function completeAnthropicText(
  options: AnthropicCompleteOptions
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_ANTHROPIC_MODEL,
      max_tokens: options.maxTokens ?? 800,
      messages: [{ role: 'user', content: options.prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Anthropic API error ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find(b => b.type === 'text')?.text;
  return text ?? '(empty response)';
}

/**
 * Call OpenAI Chat Completions API and return the first message content.
 */
export async function completeOpenAiText(options: {
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_OPENAI_MODEL,
      max_tokens: options.maxTokens ?? 800,
      messages: [{ role: 'user', content: options.prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenAI API error ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  return text !== undefined && text !== null && text !== ''
    ? text
    : '(empty response)';
}

/**
 * Call a local Ollama `/api/chat` endpoint (non-streaming).
 */
export async function completeOllamaText(options: {
  endpoint: string;
  model: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  // Validate before fetch so user-controlled endpoint cannot become an SSRF sink.
  const origin = validateOllamaEndpoint(options.endpoint);
  const chatUrl = new URL('/api/chat', origin);
  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      stream: false,
      messages: [{ role: 'user', content: options.prompt }],
      options: {
        num_predict: options.maxTokens ?? 800,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Ollama API error ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    message?: { content?: string };
  };
  const text = data.message?.content;
  return text !== undefined && text !== '' ? text : '(empty response)';
}

/**
 * Dispatch to the configured provider.
 */
export async function completeAiText(
  options: ResolvedAiOptions & { prompt: string }
): Promise<string> {
  if (options.provider === 'ollama') {
    const endpoint = options.endpoint ?? DEFAULT_OLLAMA_ENDPOINT;
    return completeOllamaText({
      endpoint,
      model: options.model,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
    });
  }

  if (options.provider === 'openai') {
    const apiKey = options.apiKey;
    if (apiKey === undefined || apiKey === '') {
      throw new Error(
        'OPENAI_API_KEY environment variable is required for the openai provider.'
      );
    }
    return completeOpenAiText({
      apiKey,
      prompt: options.prompt,
      model: options.model,
      maxTokens: options.maxTokens,
    });
  }

  const apiKey = options.apiKey;
  if (apiKey === undefined || apiKey === '') {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required for AI features.'
    );
  }

  return completeAnthropicText({
    apiKey,
    prompt: options.prompt,
    model: options.model,
    maxTokens: options.maxTokens,
  });
}

/** Read ANTHROPIC_API_KEY or throw a CLI-friendly Error. */
export function requireAnthropicApiKey(): string {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required for AI features.'
    );
  }
  return apiKey;
}

/** Read OPENAI_API_KEY or throw a CLI-friendly Error. */
export function requireOpenAiApiKey(): string {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new Error(
      'OPENAI_API_KEY environment variable is required for the openai provider.'
    );
  }
  return apiKey;
}

export function isAiProviderName(value: string): value is AiProviderName {
  return value === 'anthropic' || value === 'openai' || value === 'ollama';
}

export const AI_PROVIDER_HELP =
  'AI provider: anthropic (default), openai, or ollama';

/**
 * Resolve provider + model/tokens from config, refusing when `ai.enabled` is false.
 * Command-level overrides win over config.
 * - anthropic → `ANTHROPIC_API_KEY`
 * - openai → `OPENAI_API_KEY`
 * - ollama → `ai.endpoint` / `OLLAMA_HOST` (no key)
 */
export function resolveAiOptions(
  configAi: AiConfig | undefined,
  overrides?: AiResolveOverrides
): ResolvedAiOptions {
  if (configAi?.enabled === false) {
    throw new Error(
      'AI features are disabled in configuration (ai.enabled: false).'
    );
  }

  const providerRaw: string =
    overrides?.provider ?? configAi?.provider ?? 'anthropic';
  if (!isAiProviderName(providerRaw)) {
    throw new Error(
      `Unknown AI provider "${providerRaw}". Use "anthropic", "openai", or "ollama".`
    );
  }

  const maxTokens = overrides?.maxTokens ?? configAi?.maxTokens ?? 800;

  if (providerRaw === 'ollama') {
    const rawEndpoint =
      configAi?.endpoint ??
      process.env['OLLAMA_HOST'] ??
      DEFAULT_OLLAMA_ENDPOINT;
    const endpoint = validateOllamaEndpoint(rawEndpoint);

    return {
      provider: 'ollama',
      model: overrides?.model ?? configAi?.model ?? DEFAULT_OLLAMA_MODEL,
      maxTokens,
      endpoint,
    };
  }

  if (providerRaw === 'openai') {
    return {
      provider: 'openai',
      apiKey: requireOpenAiApiKey(),
      model: overrides?.model ?? configAi?.model ?? DEFAULT_OPENAI_MODEL,
      maxTokens,
    };
  }

  return {
    provider: 'anthropic',
    apiKey: requireAnthropicApiKey(),
    model: overrides?.model ?? configAi?.model ?? DEFAULT_ANTHROPIC_MODEL,
    maxTokens,
  };
}
