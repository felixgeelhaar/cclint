import { describe, it, expect } from 'vitest';
import { shouldIgnorePath } from '../../../src/infrastructure/ignoreMatch.js';

describe('shouldIgnorePath', () => {
  it('returns false when patterns are missing or empty', () => {
    expect(shouldIgnorePath('/repo/CLAUDE.md', undefined)).toBe(false);
    expect(shouldIgnorePath('/repo/CLAUDE.md', [])).toBe(false);
  });

  it('matches plain path fragments (substring)', () => {
    expect(
      shouldIgnorePath('/repo/node_modules/pkg/CLAUDE.md', ['node_modules/'])
    ).toBe(true);
    expect(
      shouldIgnorePath('/repo/CLAUDE.backup.md', ['CLAUDE.backup.md'])
    ).toBe(true);
  });

  it('matches basename globs like *.backup.md', () => {
    expect(
      shouldIgnorePath('/repo/docs/CLAUDE.backup.md', ['*.backup.md'], {
        projectRoot: '/repo',
      })
    ).toBe(true);
    expect(
      shouldIgnorePath('/repo/CLAUDE.md', ['*.backup.md'], {
        projectRoot: '/repo',
      })
    ).toBe(false);
  });

  it('matches relative globs like temp/**', () => {
    expect(
      shouldIgnorePath('/repo/temp/x/CLAUDE.md', ['temp/**'], {
        projectRoot: '/repo',
      })
    ).toBe(true);
    expect(
      shouldIgnorePath('/repo/src/CLAUDE.md', ['temp/**'], {
        projectRoot: '/repo',
      })
    ).toBe(false);
  });

  it('matches nested package globs', () => {
    expect(
      shouldIgnorePath('/repo/packages/legacy/AGENTS.md', [
        'packages/legacy/**',
      ], { projectRoot: '/repo' })
    ).toBe(true);
  });
});
