import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveAiOptions,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_ENDPOINT,
} from '../../../../src/infrastructure/ai/anthropicClient.js';

describe('resolveAiOptions', () => {
  const originalEnv = process.env['ANTHROPIC_API_KEY'];
  const originalOllama = process.env['OLLAMA_HOST'];

  beforeEach(() => {
    process.env['ANTHROPIC_API_KEY'] = 'test-key';
    delete process.env['OLLAMA_HOST'];
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = originalEnv;
    if (originalOllama === undefined) delete process.env['OLLAMA_HOST'];
    else process.env['OLLAMA_HOST'] = originalOllama;
  });

  it('uses anthropic defaults when config.ai is absent', () => {
    const resolved = resolveAiOptions(undefined);
    expect(resolved.provider).toBe('anthropic');
    expect(resolved.apiKey).toBe('test-key');
    expect(resolved.model).toBe(DEFAULT_ANTHROPIC_MODEL);
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

  it('requires ANTHROPIC_API_KEY for anthropic', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    expect(() => resolveAiOptions(undefined)).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('resolves ollama without an API key', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const resolved = resolveAiOptions(
      { provider: 'ollama', model: 'llama3.2' },
      undefined
    );
    expect(resolved.provider).toBe('ollama');
    expect(resolved.apiKey).toBeUndefined();
    expect(resolved.model).toBe('llama3.2');
    expect(resolved.endpoint).toBe(DEFAULT_OLLAMA_ENDPOINT);
  });

  it('uses OLLAMA_HOST and default ollama model', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    process.env['OLLAMA_HOST'] = 'http://localhost:11435/';
    const resolved = resolveAiOptions({ provider: 'ollama' });
    expect(resolved.model).toBe(DEFAULT_OLLAMA_MODEL);
    expect(resolved.endpoint).toBe('http://localhost:11435');
  });

  it('rejects unsafe OLLAMA_HOST values at resolve time', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    process.env['OLLAMA_HOST'] = 'http://169.254.169.254/';
    expect(() => resolveAiOptions({ provider: 'ollama' })).toThrow(
      /not allowed/
    );
  });

  it('lets --provider override config provider', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    const resolved = resolveAiOptions(
      { provider: 'anthropic' },
      { provider: 'ollama' }
    );
    expect(resolved.provider).toBe('ollama');
  });
});
