import { describe, it, expect } from 'vitest';
import { JsonValidator } from '../../../../../src/rules/codeblock/validators/JsonValidator.js';
import type { ValidationContext } from '../../../../../src/rules/codeblock/LanguageValidator.js';
import { CodeBlock } from '../../../../../src/domain/CodeBlock.js';
import { Location } from '../../../../../src/domain/Location.js';
import { Severity } from '../../../../../src/domain/Severity.js';

const context: ValidationContext = { ruleId: 'code-blocks', strict: true };

function jsonBlock(content: string): CodeBlock {
  return new CodeBlock('json', content, new Location(3, 1));
}

describe('JsonValidator', () => {
  const validator = new JsonValidator();

  it('flags invalid JSON with ERROR severity and includes the parser message', () => {
    const violations = validator.validate(
      jsonBlock('{ "broken": ,, }'),
      context
    );

    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain('Invalid JSON syntax:');
    expect(violations[0]!.severity).toBe(Severity.ERROR);
    expect(violations[0]!.ruleId).toBe('code-blocks');
  });

  it('accepts valid JSON without violations', () => {
    const violations = validator.validate(
      jsonBlock('{ "ok": true, "n": 1 }'),
      context
    );

    expect(violations).toHaveLength(0);
  });

  it('reports the violation at the block location', () => {
    const block = new CodeBlock('json', '{ bad }', new Location(7, 1));
    const violations = validator.validate(block, context);

    expect(violations[0]!.location.line).toBe(7);
  });
});
