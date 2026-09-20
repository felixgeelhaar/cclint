import { describe, it, expect } from 'vitest';
import { ImportContextCostRule } from '../../../src/rules/ImportContextCostRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('ImportContextCostRule', () => {
  it('is quiet when there are no imports', () => {
    const file = new ContextFile('/r/CLAUDE.md', '# Project\n\nNo imports.\n');
    expect(new ImportContextCostRule().lint(file)).toEqual([]);
  });

  it('INFO when any @import is present', () => {
    const file = new ContextFile(
      '/r/CLAUDE.md',
      '@AGENTS.md\n\n# Project\n'
    );
    const violations = new ImportContextCostRule().lint(file);
    expect(violations.some(v => v.severity === Severity.INFO)).toBe(true);
    expect(violations.some(v => v.message.includes('do not save tokens'))).toBe(
      true
    );
  });

  it('WARNING when import count reaches soft threshold', () => {
    const content = [
      '@a.md',
      '@b.md',
      '@c.md',
      '@d.md',
      '@e.md',
      '',
      '# Project',
      '',
    ].join('\n');
    const file = new ContextFile('/r/CLAUDE.md', content);
    const violations = new ImportContextCostRule({ softImportCount: 5 }).lint(
      file
    );
    expect(violations.some(v => v.severity === Severity.WARNING)).toBe(true);
  });

  it('ignores imports inside fences', () => {
    const file = new ContextFile(
      '/r/CLAUDE.md',
      '# Project\n\n```md\n@secret.md\n```\n'
    );
    expect(new ImportContextCostRule().lint(file)).toEqual([]);
  });

  it('applies to AGENTS.md as well', () => {
    const rule = new ImportContextCostRule();
    expect(rule.appliesTo(new ContextFile('/r/AGENTS.md', '#\n'))).toBe(true);
  });
});
