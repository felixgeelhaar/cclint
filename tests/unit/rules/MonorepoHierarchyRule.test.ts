import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MonorepoHierarchyRule } from '../../../src/rules/MonorepoHierarchyRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';

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
  });
});
