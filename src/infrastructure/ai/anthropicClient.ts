/**
 * Thin Anthropic Messages API client shared by `why --ai`, `suggest`, and
 * `analyze --ai`.
 */

export interface AnthropicCompleteOptions {
  apiKey: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
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
      model: options.model ?? 'claude-haiku-4-5',
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
