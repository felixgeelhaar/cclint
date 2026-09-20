import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveAiOptions } from '../../../../src/infrastructure/ai/anthropicClient.js';

describe('resolveAiOptions', () => {
  const originalEnv = process.env['ANTHROPIC_API_KEY'];

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = originalEnv;
  });

  it('uses defaults when config.ai is absent', () => {
    const resolved = resolveAiOptions(undefined);
    expect(resolved.apiKey).toBe('test-key');
    expect(resolved.model).toBe('claude-haiku-4-5');
    expect(resolved.maxTokens).toBe(800);
  });

  it('honors config model and maxTokens', () => {
    const resolved = resolveAiOptions({
      model: 'claude-sonnet-4-5',
      maxTokens: 1200,
    });
    expect(resolved.model).toBe('claude-sonnet-4-5');
    expect(resolved.maxTokens).toBe(1200);
  });

  it('lets command overrides win over config', () => {
    const resolved = resolveAiOptions(
      { model: 'from-config', maxTokens: 100 },
      { model: 'from-flag', maxTokens: 500 }
    );
    expect(resolved.model).toBe('from-flag');
    expect(resolved.maxTokens).toBe(500);
  });

  it('refuses when ai.enabled is false', () => {
    expect(() => resolveAiOptions({ enabled: false })).toThrow(
      /ai\.enabled: false/
    );
  });

  it('requires ANTHROPIC_API_KEY', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    expect(() => resolveAiOptions(undefined)).toThrow(/ANTHROPIC_API_KEY/);
  });
});
