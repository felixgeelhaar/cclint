/**
 * Thin Anthropic Messages API client shared by `why --ai`, `suggest`,
 * `analyze --ai`, and `lint --ai`.
 */

import type { AiConfig } from '../../domain/Config.js';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';

export interface AnthropicCompleteOptions {
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}

export interface ResolvedAiOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
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

/**
 * Resolve API key + model/tokens from config, refusing when `ai.enabled` is false.
 * Command-level overrides (e.g. `--max-tokens`) win over config.
 */
export function resolveAiOptions(
  configAi: AiConfig | undefined,
  overrides?: { maxTokens?: number; model?: string }
): ResolvedAiOptions {
  if (configAi?.enabled === false) {
    throw new Error(
      'AI features are disabled in configuration (ai.enabled: false).'
    );
  }

  return {
    apiKey: requireAnthropicApiKey(),
    model: overrides?.model ?? configAi?.model ?? DEFAULT_ANTHROPIC_MODEL,
    maxTokens:
      overrides?.maxTokens ?? configAi?.maxTokens ?? 800,
  };
}
