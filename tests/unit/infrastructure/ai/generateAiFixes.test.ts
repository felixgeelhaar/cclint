import { describe, it, expect } from 'vitest';
import {
  parseAiFixJson,
  validateAndBuildFix,
} from '../../../../src/infrastructure/ai/generateAiFixes.js';

describe('generateAiFixes parsers', () => {
  it('parses a bare JSON object', () => {
    const parsed = parseAiFixJson(
      '{"startLine":1,"startColumn":1,"endLine":1,"endColumn":6,"text":"# Hi","description":"fix title"}'
    );
    expect(parsed).toEqual({
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 6,
      text: '# Hi',
      description: 'fix title',
    });
  });

  it('parses JSON wrapped in markdown fences', () => {
    const parsed = parseAiFixJson(`Here you go:
\`\`\`json
{"startLine":2,"startColumn":1,"endLine":2,"endColumn":4,"text":"## X","description":"heading"}
\`\`\`
`);
    expect(parsed?.startLine).toBe(2);
    expect(parsed?.text).toBe('## X');
  });

  it('rejects malformed JSON', () => {
    expect(parseAiFixJson('not json')).toBeNull();
    expect(parseAiFixJson('{"startLine":"x"}')).toBeNull();
  });

  it('builds a Fix when ranges are in bounds', () => {
    const lines = ['# Title', 'body text'];
    const fix = validateAndBuildFix(
      {
        startLine: 2,
        startColumn: 1,
        endLine: 2,
        endColumn: 10,
        text: 'Body text.',
        description: 'capitalize',
      },
      lines
    );
    expect(fix).not.toBeNull();
    expect(fix?.description).toBe('[ai] capitalize');
    expect(fix?.range.start.line).toBe(2);
    expect(fix?.text).toBe('Body text.');
  });

  it('rejects out-of-range coordinates', () => {
    const lines = ['only'];
    expect(
      validateAndBuildFix(
        {
          startLine: 2,
          startColumn: 1,
          endLine: 2,
          endColumn: 2,
          text: 'x',
          description: 'bad',
        },
        lines
      )
    ).toBeNull();

    expect(
      validateAndBuildFix(
        {
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 99,
          text: 'x',
          description: 'bad',
        },
        lines
      )
    ).toBeNull();
  });
});
