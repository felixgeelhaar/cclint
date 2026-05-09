import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ImportResolutionRule } from '../../../src/rules/ImportResolutionRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('ImportResolutionRule', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-importres-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function write(relPath: string, content: string): string {
    const full = join(workDir, relPath);
    const dir = full.substring(0, full.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(full, content, 'utf-8');
    return full;
  }

  function fileFor(path: string, content: string): ContextFile {
    return new ContextFile(path, content);
  }

  describe('rule identity', () => {
    it('should have id import-resolution', () => {
      expect(new ImportResolutionRule().id).toBe('import-resolution');
    });

    it('should have a description', () => {
      expect(new ImportResolutionRule().description.length).toBeGreaterThan(0);
    });
  });

  describe('resolution', () => {
    it('should not flag imports that resolve to existing files', () => {
      write('included.md', '# Included\n');
      const mainPath = write('CLAUDE.md', '# Main\n\n@./included.md\n');

      const rule = new ImportResolutionRule();
      const violations = rule.lint(
        fileFor(mainPath, '# Main\n\n@./included.md\n')
      );

      expect(violations).toEqual([]);
    });

    it('should flag imports that do not resolve', () => {
      const mainPath = write('CLAUDE.md', '# Main\n\n@./missing.md\n');

      const rule = new ImportResolutionRule();
      const violations = rule.lint(
        fileFor(mainPath, '# Main\n\n@./missing.md\n')
      );

      expect(violations).toHaveLength(1);
      expect(violations[0]?.severity).toBe(Severity.ERROR);
      expect(violations[0]?.message).toContain('does not exist');
    });

    it('should resolve absolute paths', () => {
      const target = write('absolute.md', '# T\n');
      const mainPath = write('CLAUDE.md', `# Main\n\n@${target}\n`);

      const rule = new ImportResolutionRule();
      const violations = rule.lint(fileFor(mainPath, `# Main\n\n@${target}\n`));

      expect(violations).toEqual([]);
    });

    it('should resolve home directory paths if HOME is set', () => {
      const homeMd = write('home/notes.md', '# Notes\n');
      const homeRoot = join(workDir, 'home');
      const originalHome = process.env['HOME'];
      process.env['HOME'] = homeRoot;
      try {
        const mainPath = write('CLAUDE.md', '# Main\n\n@~/notes.md\n');

        const rule = new ImportResolutionRule();
        const violations = rule.lint(
          fileFor(mainPath, '# Main\n\n@~/notes.md\n')
        );

        // Either resolves, or homeMd path was used to ensure ~/notes.md exists
        expect(homeMd).toBeDefined();
        expect(
          violations.filter(v => v.message.includes('does not exist'))
        ).toEqual([]);
      } finally {
        if (originalHome === undefined) delete process.env['HOME'];
        else process.env['HOME'] = originalHome;
      }
    });
  });

  describe('circular dependencies', () => {
    it('should detect direct A → A self-import', () => {
      const mainPath = write('CLAUDE.md', '# Main\n\n@./CLAUDE.md\n');

      const rule = new ImportResolutionRule();
      const violations = rule.lint(
        fileFor(mainPath, '# Main\n\n@./CLAUDE.md\n')
      );

      expect(violations.some(v => v.message.includes('Circular'))).toBe(true);
    });

    it('should detect indirect A → B → A cycle', () => {
      const aPath = join(workDir, 'A.md');
      const bPath = join(workDir, 'B.md');
      writeFileSync(aPath, `# A\n\n@./B.md\n`, 'utf-8');
      writeFileSync(bPath, `# B\n\n@./A.md\n`, 'utf-8');

      const rule = new ImportResolutionRule();
      const violations = rule.lint(fileFor(aPath, `# A\n\n@./B.md\n`));

      expect(violations.some(v => v.message.includes('Circular'))).toBe(true);
    });
  });

  describe('depth limit', () => {
    it('should flag chains exceeding maxDepth', () => {
      // Build a chain longer than the default depth (5).
      const files = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
      for (let i = 0; i < files.length; i++) {
        const next = files[i + 1];
        const ref = next ? `@./${next}.md\n` : '';
        writeFileSync(
          join(workDir, `${files[i]}.md`),
          `# ${files[i]}\n\n${ref}`,
          'utf-8'
        );
      }

      const rule = new ImportResolutionRule(5);
      const rootPath = join(workDir, 'L0.md');
      const violations = rule.lint(fileFor(rootPath, '# L0\n\n@./L1.md\n'));

      expect(
        violations.some(v => v.message.includes('exceeds maximum depth'))
      ).toBe(true);
    });

    it('should respect a custom maxDepth', () => {
      writeFileSync(join(workDir, 'B.md'), '# B\n\n@./C.md\n', 'utf-8');
      writeFileSync(join(workDir, 'C.md'), '# C\n', 'utf-8');
      const aPath = join(workDir, 'A.md');
      writeFileSync(aPath, '# A\n\n@./B.md\n', 'utf-8');

      const rule = new ImportResolutionRule(1);
      const violations = rule.lint(fileFor(aPath, '# A\n\n@./B.md\n'));

      expect(
        violations.some(v => v.message.includes('exceeds maximum depth'))
      ).toBe(true);
    });
  });

  describe('code-block exclusions', () => {
    it('should ignore @path occurrences inside fenced code blocks', () => {
      const mainPath = write(
        'CLAUDE.md',
        '# Main\n\n```\n@./missing.md\n```\n'
      );

      const rule = new ImportResolutionRule();
      const violations = rule.lint(
        fileFor(mainPath, '# Main\n\n```\n@./missing.md\n```\n')
      );

      expect(violations).toEqual([]);
    });

    it('should ignore @path occurrences inside inline code spans', () => {
      const mainPath = write(
        'CLAUDE.md',
        '# Main\n\nUse `@./missing.md` syntax.\n'
      );

      const rule = new ImportResolutionRule();
      const violations = rule.lint(
        fileFor(mainPath, '# Main\n\nUse `@./missing.md` syntax.\n')
      );

      expect(violations).toEqual([]);
    });
  });
});
