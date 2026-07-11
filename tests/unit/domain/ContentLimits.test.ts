import { describe, it, expect } from 'vitest';
import {
  assertWithinContentLimits,
  MAX_CONTENT_LENGTH,
  MAX_LINE_LENGTH,
} from '../../../src/domain/ContentLimits.js';

describe('ContentLimits', () => {
  it('accepts content within the limits', () => {
    expect(() =>
      assertWithinContentLimits('# ok\nshort line\n', '/x/CLAUDE.md')
    ).not.toThrow();
  });

  it('rejects content over the size cap', () => {
    const oversized = 'a'.repeat(MAX_CONTENT_LENGTH + 1);
    expect(() => assertWithinContentLimits(oversized, '/x/CLAUDE.md')).toThrow(
      /exceeds maximum size/
    );
  });

  it('rejects a line over the line-length cap and reports the line number', () => {
    const longLine = 'x'.repeat(MAX_LINE_LENGTH + 1);
    expect(() =>
      assertWithinContentLimits(`ok\n${longLine}`, '/x/CLAUDE.md')
    ).toThrow(/line 2 exceeding/);
  });

  it('uses caller-provided lines when supplied', () => {
    const longLine = 'x'.repeat(MAX_LINE_LENGTH + 1);
    // Pass pre-split lines; the function must not re-split the content.
    expect(() =>
      assertWithinContentLimits('ignored', '/x/CLAUDE.md', ['ok', longLine])
    ).toThrow(/line 2 exceeding/);
  });
});
