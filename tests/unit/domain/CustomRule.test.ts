import { describe, it, expect } from 'vitest';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Violation } from '../../../src/domain/Violation.js';
import { Location } from '../../../src/domain/Location.js';
import { Severity } from '../../../src/domain/Severity.js';
import { CustomRule } from '../../../src/domain/CustomRule.js';
import type { Fix } from '../../../src/domain/AutoFix.js';

class TestCustomRule extends CustomRule {
  constructor() {
    super('test-rule', 'Test custom rule for validation');
  }

  protected validateInternal(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    
    if (file.content.includes('FORBIDDEN')) {
      violations.push(
        new Violation(
          this.id,
          'Content contains forbidden text',
          Severity.ERROR,
          new Location(1, 1)
        )
      );
    }
    
    return violations;
  }

  generateFixes(violations: Violation[], content: string): Fix[] {
    return violations
      .filter(v => v.ruleId === this.id && v.message.includes('forbidden'))
      .map(v => ({
        range: {
          start: new Location(1, 1),
          end: new Location(1, 10),
        },
        text: 'ALLOWED',
        description: 'Replace forbidden text',
      }));
  }
}

describe('CustomRule', () => {
  it('should extend base Rule interface', () => {
    const rule = new TestCustomRule();
    
    expect(rule.id).toBe('test-rule');
    expect(rule.description).toBe('Test custom rule for validation');
  });

  it('should validate content according to custom logic', () => {
    const rule = new TestCustomRule();
    const file = new ContextFile('test.md', 'This contains FORBIDDEN text');
    
    const violations = rule.lint(file);
    
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('test-rule');
    expect(violations[0].message).toBe('Content contains forbidden text');
    expect(violations[0].severity).toBe(Severity.ERROR);
  });

  it('should not create violations for allowed content', () => {
    const rule = new TestCustomRule();
    const file = new ContextFile('test.md', 'This is allowed content');
    
    const violations = rule.lint(file);
    
    expect(violations).toHaveLength(0);
  });

  it('should generate fixes for violations', () => {
    const rule = new TestCustomRule();
    const violations = [
      new Violation(
        'test-rule',
        'Content contains forbidden text',
        Severity.ERROR,
        new Location(1, 1)
      ),
    ];
    
    const fixes = rule.generateFixes(violations, 'FORBIDDEN text');
    
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toEqual({
      range: {
        start: { line: 1, column: 1 },
        end: { line: 1, column: 10 },
      },
      text: 'ALLOWED',
      description: 'Replace forbidden text',
    });
  });

  it('should not generate fixes for other rules', () => {
    const rule = new TestCustomRule();
    const violations = [
      new Violation(
        'other-rule',
        'Some other violation',
        Severity.ERROR,
        new Location(1, 1)
      ),
    ];
    
    const fixes = rule.generateFixes(violations, 'content');
    
    expect(fixes).toHaveLength(0);
  });
});