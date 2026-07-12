import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FileDiscovery,
  isConfigFile,
  IGNORED_DIRECTORIES,
} from '../../../src/infrastructure/FileDiscovery.js';

/**
 * Build a project tree on disk and return the absolute paths written, so tests
 * can assert discovery against a known set.
 */
function writeTree(root: string, files: string[]): void {
  for (const relative of files) {
    const abs = join(root, relative);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, '# placeholder\n');
  }
}

describe('FileDiscovery', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cclint-discovery-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('discovers every kind of Claude Code config file', () => {
    writeTree(root, [
      'CLAUDE.md',
      'packages/app/CLAUDE.md', // nested CLAUDE.md
      '.claude/skills/my-skill/SKILL.md',
      '.claude/agents/reviewer.md',
      '.claude/output-styles/concise.md',
      '.claude/settings.json',
      '.claude/settings.local.json',
      '.mcp.json',
      '.claude-plugin/plugin.json',
      'marketplace.json',
    ]);

    const found = new FileDiscovery().discover(root);

    expect(found).toEqual(
      [
        join(root, 'CLAUDE.md'),
        join(root, 'packages/app/CLAUDE.md'),
        join(root, '.claude/skills/my-skill/SKILL.md'),
        join(root, '.claude/agents/reviewer.md'),
        join(root, '.claude/output-styles/concise.md'),
        join(root, '.claude/settings.json'),
        join(root, '.claude/settings.local.json'),
        join(root, '.mcp.json'),
        join(root, '.claude-plugin/plugin.json'),
        join(root, 'marketplace.json'),
      ].sort()
    );
  });

  it('returns results in a deterministic (sorted) order', () => {
    writeTree(root, ['b/CLAUDE.md', 'a/CLAUDE.md', 'CLAUDE.md']);

    const found = new FileDiscovery().discover(root);

    expect(found).toEqual([...found].sort());
  });

  it('ignores build/vcs/tooling directories', () => {
    writeTree(root, [
      'CLAUDE.md',
      'node_modules/pkg/CLAUDE.md',
      '.git/CLAUDE.md',
      'dist/CLAUDE.md',
      'coverage/CLAUDE.md',
      '.stryker-tmp/CLAUDE.md',
    ]);

    const found = new FileDiscovery().discover(root);

    expect(found).toEqual([join(root, 'CLAUDE.md')]);
  });

  it('does not match unrelated markdown or json files', () => {
    writeTree(root, [
      'README.md',
      'docs/guide.md',
      'package.json',
      '.claude/notes.md', // not under a recognised subdir
      '.claude/skills/README.txt', // not markdown
    ]);

    const found = new FileDiscovery().discover(root);

    expect(found).toEqual([]);
  });

  it('returns an empty array for a tree with no config files', () => {
    writeTree(root, ['src/index.ts', 'README.md']);

    expect(new FileDiscovery().discover(root)).toEqual([]);
  });

  describe('isConfigFile', () => {
    it('matches recognised patterns by path segments', () => {
      expect(isConfigFile(['CLAUDE.md'])).toBe(true);
      expect(isConfigFile(['pkg', 'CLAUDE.md'])).toBe(true);
      expect(
        isConfigFile(['.claude', 'skills', 'foo', 'SKILL.md'])
      ).toBe(true);
      expect(isConfigFile(['.claude', 'agents', 'a.md'])).toBe(true);
      expect(isConfigFile(['.claude', 'output-styles', 's.md'])).toBe(true);
      expect(isConfigFile(['.claude', 'settings.json'])).toBe(true);
      expect(isConfigFile(['.claude', 'settings.local.json'])).toBe(true);
      expect(isConfigFile(['.mcp.json'])).toBe(true);
      expect(isConfigFile(['.claude-plugin', 'plugin.json'])).toBe(true);
      expect(isConfigFile(['marketplace.json'])).toBe(true);
    });

    it('rejects near-misses', () => {
      expect(isConfigFile(['README.md'])).toBe(false);
      expect(isConfigFile(['.claude', 'notes.md'])).toBe(false);
      expect(isConfigFile(['.claude', 'skills', 'notes.txt'])).toBe(false);
      expect(isConfigFile(['settings.json'])).toBe(false); // not under .claude
      expect(isConfigFile(['plugin.json'])).toBe(false); // not under .claude-plugin
    });
  });

  it('exposes the ignore list for maintainability', () => {
    expect(IGNORED_DIRECTORIES.has('node_modules')).toBe(true);
    expect(IGNORED_DIRECTORIES.has('.git')).toBe(true);
    expect(IGNORED_DIRECTORIES.has('dist')).toBe(true);
    expect(IGNORED_DIRECTORIES.has('coverage')).toBe(true);
    expect(IGNORED_DIRECTORIES.has('.stryker-tmp')).toBe(true);
  });
});
