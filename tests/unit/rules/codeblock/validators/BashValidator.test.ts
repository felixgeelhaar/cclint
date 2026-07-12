import { describe, it, expect } from 'vitest';
import { BashValidator } from '../../../../../src/rules/codeblock/validators/BashValidator.js';
import type { ValidationContext } from '../../../../../src/rules/codeblock/LanguageValidator.js';
import { CodeBlock } from '../../../../../src/domain/CodeBlock.js';
import { Location } from '../../../../../src/domain/Location.js';
import { Severity } from '../../../../../src/domain/Severity.js';

const context: ValidationContext = { ruleId: 'code-blocks', strict: true };

function bashBlock(
  content: string,
  metadata?: { isAntiPattern?: boolean }
): CodeBlock {
  return new CodeBlock('bash', content, new Location(2, 1), '', metadata);
}

describe('BashValidator', () => {
  const validator = new BashValidator();

  it('warns on unquoted variables', () => {
    const violations = validator.validate(bashBlock('echo $FILE'), context);

    const v = violations.find(x => x.message.includes('Quote variables'));
    expect(v).toBeDefined();
    expect(v!.severity).toBe(Severity.WARNING);
  });

  it('does not flag $@ or $* special vars', () => {
    const violations = validator.validate(
      bashBlock('fn() { echo "$@"; }'),
      context
    );

    expect(violations.some(v => v.message.includes('Quote variables'))).toBe(
      false
    );
  });

  it('errors on rm -rf outside anti-pattern blocks but not within them', () => {
    const flagged = validator.validate(bashBlock('rm -rf /tmp/x'), context);
    const rf = flagged.find(v => v.message.includes("'rm -rf'"));
    expect(rf).toBeDefined();
    expect(rf!.severity).toBe(Severity.ERROR);

    const marked = validator.validate(
      bashBlock('rm -rf /tmp/x', { isAntiPattern: true }),
      context
    );
    expect(marked.some(v => v.message.includes("'rm -rf'"))).toBe(false);
  });

  it('INFOs on cd without a following || guard, and stays quiet when guarded', () => {
    const unguarded = validator.validate(bashBlock('cd /var/log\nls'), context);
    const cd = unguarded.find(v => v.message.includes('cd command success'));
    expect(cd).toBeDefined();
    expect(cd!.severity).toBe(Severity.INFO);

    const guarded = validator.validate(
      bashBlock('cd /var/log\n|| exit 1'),
      context
    );
    expect(guarded.some(v => v.message.includes('cd command success'))).toBe(
      false
    );
  });
});
