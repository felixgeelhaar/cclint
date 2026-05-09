import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MonorepoHierarchyRule } from '../../../src/rules/MonorepoHierarchyRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('MonorepoHierarchyRule', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-monorepo-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function writeFile(relPath: string, content: string): string {
    const full = join(workDir, relPath);
    const dir = full.substring(0, full.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(full, content, 'utf-8');
    return full;
  }

  describe('rule identity', () => {
    it('should have id monorepo-hierarchy', () => {
      expect(new MonorepoHierarchyRule().id).toBe('monorepo-hierarchy');
    });

    it('should have a description', () => {
      expect(new MonorepoHierarchyRule().description.length).toBeGreaterThan(0);
    });
  });

  describe('non-Claude files', () => {
    it('should skip non-Claude files', () => {
      const path = writeFile('foo/README.md', '# Readme');
      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(new ContextFile(path, '# Readme'));

      expect(violations).toEqual([]);
    });

    it('should skip arbitrary documentation', () => {
      const path = writeFile('docs/api.md', '# API');
      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(new ContextFile(path, '# API'));

      expect(violations).toEqual([]);
    });
  });

  describe('isolated CLAUDE.md', () => {
    it('should not produce violations when no other CLAUDE.md files exist nearby', () => {
      const path = writeFile('only/CLAUDE.md', '# Project\n\nDetails.');
      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(
        new ContextFile(path, '# Project\n\nDetails.')
      );

      // No parent / sibling / child CLAUDE.md files in the temp dir.
      expect(violations).toEqual([]);
    });
  });

  describe('parent file detection', () => {
    it('should detect a parent CLAUDE.md and emit guidance', () => {
      const parentContent = '# Parent\n\n## Architecture\n\nShared.';
      writeFile('CLAUDE.md', parentContent);
      const childPath = writeFile(
        'packages/web/CLAUDE.md',
        '# Web\n\n## Architecture\n\nApp-specific.'
      );

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(
        new ContextFile(childPath, '# Web\n\n## Architecture\n\nApp-specific.')
      );

      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('sibling detection', () => {
    it('should detect a sibling CLAUDE.md', () => {
      const aContent = '# A\n\n## Architecture\n\n## Setup\n\n## Testing';
      const bContent = '# B\n\n## Architecture\n\n## Setup\n\n## Testing';
      writeFile('packages/a/CLAUDE.md', aContent);
      const bPath = writeFile('packages/b/CLAUDE.md', bContent);

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(new ContextFile(bPath, bContent));

      // Sibling at packages/a/CLAUDE.md exists; rule should fire some
      // signal about sibling overlap.
      expect(violations.length).toBeGreaterThan(0);
    });

    it('should WARN with sibling-overlap message when ≥3 topics overlap', () => {
      const shared =
        '# Pkg\n\n## Architecture\n\n## Setup\n\n## Testing\n\n## Deployment';
      writeFile('packages/a/CLAUDE.md', shared);
      const bPath = writeFile('packages/b/CLAUDE.md', shared);

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(new ContextFile(bPath, shared));

      const v = violations.find(x => x.message.includes('overlapping topics'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should not warn when sibling has no topic overlap', () => {
      writeFile('packages/a/CLAUDE.md', '# A\n\n## Architecture');
      const bPath = writeFile('packages/b/CLAUDE.md', '# B\n\n## Deployment');

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(
        new ContextFile(bPath, '# B\n\n## Deployment')
      );

      expect(
        violations.some(v => v.message.includes('overlapping topics'))
      ).toBe(false);
    });
  });

  describe('parent conflict detail', () => {
    it('should WARN with parent-conflict message when topics overlap', () => {
      writeFile('CLAUDE.md', '# Root\n\n## Architecture\n\n## Setup');
      const childPath = writeFile(
        'packages/web/CLAUDE.md',
        '# Web\n\n## Architecture\n\nApp-specific.'
      );

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(
        new ContextFile(childPath, '# Web\n\n## Architecture\n\nApp-specific.')
      );

      const v = violations.find(x => x.message.includes('also defines'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });
  });

  describe('children organization', () => {
    it('should INFO when more than three child CLAUDE.md files exist', () => {
      const rootPath = writeFile('CLAUDE.md', '# Root\n');
      writeFile('packages/a/CLAUDE.md', '# A\n');
      writeFile('packages/b/CLAUDE.md', '# B\n');
      writeFile('packages/c/CLAUDE.md', '# C\n');
      writeFile('packages/d/CLAUDE.md', '# D\n');

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(new ContextFile(rootPath, '# Root\n'));

      const v = violations.find(x =>
        x.message.includes('child CLAUDE.md files')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should not INFO when only two child CLAUDE.md files exist', () => {
      const rootPath = writeFile('CLAUDE.md', '# Root\n');
      writeFile('packages/a/CLAUDE.md', '# A\n');
      writeFile('packages/b/CLAUDE.md', '# B\n');

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(new ContextFile(rootPath, '# Root\n'));

      expect(
        violations.some(v => v.message.includes('child CLAUDE.md files'))
      ).toBe(false);
    });
  });

  describe('monorepo guidance', () => {
    it('should INFO suggesting parent CLAUDE.md when only children exist', () => {
      const rootPath = writeFile('CLAUDE.md', '# Root\n');
      writeFile('packages/a/CLAUDE.md', '# A\n');

      const rule = new MonorepoHierarchyRule();
      const violations = rule.lint(new ContextFile(rootPath, '# Root\n'));

      // No parent above root, but children exist → guidance fires.
      const v = violations.find(x =>
        x.message.includes('creating a parent CLAUDE.md')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });
  });

  describe('CLAUDE.local.md handling', () => {
    it('should still validate CLAUDE.local.md filename', () => {
      const path = writeFile('CLAUDE.local.md', '# Local\n');
      const rule = new MonorepoHierarchyRule();
      // Rule does not skip CLAUDE.local.md (filename is allowlisted),
      // and an isolated local file produces no violations.
      const violations = rule.lint(new ContextFile(path, '# Local\n'));
      expect(violations).toEqual([]);
    });
  });
});
