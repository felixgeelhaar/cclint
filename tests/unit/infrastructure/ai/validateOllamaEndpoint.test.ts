import { describe, it, expect } from 'vitest';
import { validateOllamaEndpoint } from '../../../../src/infrastructure/ai/validateOllamaEndpoint.js';

describe('validateOllamaEndpoint', () => {
  it('normalizes a valid http origin', () => {
    expect(validateOllamaEndpoint('http://127.0.0.1:11434/')).toBe(
      'http://127.0.0.1:11434'
    );
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => validateOllamaEndpoint('file:///etc/passwd')).toThrow(
      /http or https/
    );
  });

  it('rejects credentials in the URL', () => {
    expect(() =>
      validateOllamaEndpoint('http://user:pass@127.0.0.1:11434')
    ).toThrow(/credentials/);
  });

  it('rejects cloud metadata hosts', () => {
    expect(() =>
      validateOllamaEndpoint('http://169.254.169.254/latest/meta-data')
    ).toThrow(/not allowed/);
    expect(() =>
      validateOllamaEndpoint('http://metadata.google.internal/')
    ).toThrow(/not allowed/);
  });

  it('rejects relative / invalid URLs', () => {
    expect(() => validateOllamaEndpoint('not-a-url')).toThrow(/Invalid/);
    expect(() => validateOllamaEndpoint('')).toThrow(/empty/);
  });
});
