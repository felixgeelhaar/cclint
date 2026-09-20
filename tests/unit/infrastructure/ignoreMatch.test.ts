import { describe, it, expect } from 'vitest';
import { shouldIgnorePath } from '../../../src/infrastructure/ignoreMatch.js';

describe('shouldIgnorePath', () => {
  it('returns false when patterns are missing or empty', () => {
    expect(shouldIgnorePath('/repo/CLAUDE.md', undefined)).toBe(false);
    expect(shouldIgnorePath('/repo/CLAUDE.md', [])).toBe(false);
  });

  it('matches path fragments (substring)', () => {
    expect(shouldIgnorePath('/repo/node_modules/pkg/CLAUDE.md', ['node_modules/'])).toBe(
      true
    );
    expect(shouldIgnorePath('/repo/CLAUDE.backup.md', ['CLAUDE.backup.md'])).toBe(
      true
    );
  });

  it('does not treat globs as globs', () => {
    expect(shouldIgnorePath('/repo/foo.backup.md', ['*.backup.md'])).toBe(false);
    expect(shouldIgnorePath('/repo/temp/x/CLAUDE.md', ['temp/**'])).toBe(false);
    expect(shouldIgnorePath('/repo/temp/x/CLAUDE.md', ['temp/'])).toBe(true);
  });
});
