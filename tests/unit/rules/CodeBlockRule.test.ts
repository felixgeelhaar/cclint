import { describe, it, expect } from 'vitest';
import { CodeBlockRule } from '../../../src/rules/CodeBlockRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('CodeBlockRule', () => {
  const rule = new CodeBlockRule();

  it('should have correct id and description', () => {
    expect(rule.id).toBe('code-blocks');
    expect(rule.description).toBe(
      'Validates code blocks for syntax and best practices'
    );
  });

  it('should detect code blocks without language specification', () => {
    const content = `
# Example

\`\`\`
const x = 5;
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain('should specify a language');
  });

  it('should detect var usage in JavaScript', () => {
    const content = `
# JavaScript Example

\`\`\`javascript
var x = 5;
const y = 10;
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const varViolation = violations.find(v =>
      v.message.includes("Use 'const' or 'let'")
    );
    expect(varViolation).toBeDefined();
    expect(varViolation!.severity).toBe(Severity.ERROR);
  });

  it('should detect loose equality in JavaScript', () => {
    const content = `
# Example

\`\`\`javascript
if (x == 5) {
  console.log('equal');
}
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const eqViolation = violations.find(v => v.message.includes('==='));
    expect(eqViolation).toBeDefined();
    expect(eqViolation!.severity).toBe(Severity.WARNING);
  });

  it('should detect missing error handling in async functions', () => {
    const content = `
# Async Example

\`\`\`javascript
async function getData() {
  const response = await fetch('/api');
  return response.json();
}
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const asyncViolation = violations.find(v =>
      v.message.includes('error handling')
    );
    expect(asyncViolation).toBeDefined();
  });

  it('should detect bare except in Python', () => {
    const content = `
# Python Example

\`\`\`python
try:
    do_something()
except:
    pass
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const exceptViolation = violations.find(v => v.message.includes('bare'));
    expect(exceptViolation).toBeDefined();
  });

  it('should detect unhandled errors in Go', () => {
    const content = `
# Go Example

\`\`\`go
data, err := ioutil.ReadFile("file.txt")
fmt.Println(data)
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const errorViolation = violations.find(v =>
      v.message.includes('Error not handled')
    );
    expect(errorViolation).toBeDefined();
    expect(errorViolation!.severity).toBe(Severity.ERROR);
  });

  it('should detect unquoted variables in bash', () => {
    const content = `
# Bash Example

\`\`\`bash
FILE=$1
echo $FILE
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const quoteViolation = violations.find(v =>
      v.message.includes('Quote variables')
    );
    expect(quoteViolation).toBeDefined();
  });

  it('should detect SQL injection patterns', () => {
    const content = `
# SQL Example

\`\`\`sql
SELECT * FROM users WHERE id = \${userId}
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    expect(violations).toHaveLength(2); // SELECT * and injection
    const injectionViolation = violations.find(v =>
      v.message.includes('SQL injection')
    );
    expect(injectionViolation).toBeDefined();
    expect(injectionViolation!.severity).toBe(Severity.ERROR);
  });

  it('should validate JSON syntax', () => {
    const content = `
# JSON Example

\`\`\`json
{
  "name": "test",
  "value": 123,
}
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const jsonViolation = violations.find(v =>
      v.message.includes('Invalid JSON')
    );
    expect(jsonViolation).toBeDefined();
    expect(jsonViolation!.severity).toBe(Severity.ERROR);
  });

  it('should detect tabs in YAML', () => {
    const content = `
# YAML Example

\`\`\`yaml
key:
\tvalue: test
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const yamlViolation = violations.find(v =>
      v.message.includes('spaces, not tabs')
    );
    expect(yamlViolation).toBeDefined();
    expect(yamlViolation!.severity).toBe(Severity.ERROR);
  });

  it('should not flag anti-patterns when properly marked', () => {
    const content = `
# Bad Example - Anti-pattern

\`\`\`javascript
var x = 5; // This is wrong
eval("alert('hi')");
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    // Should still flag var usage but not complain about it being unmarked
    const unmarkedViolation = violations.find(v =>
      v.message.includes('not clearly marked')
    );
    expect(unmarkedViolation).toBeUndefined();
  });

  it('should detect incomplete code blocks', () => {
    const content = `
# Example

\`\`\`javascript
function doSomething() {
  // ...
}
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const incompleteViolation = violations.find(v =>
      v.message.includes('Incomplete')
    );
    expect(incompleteViolation).toBeDefined();
  });

  it('should check for missing imports', () => {
    const content = `
# Example

\`\`\`javascript
const app = express();
app.use(cors());
\`\`\`
`;
    const file = new ContextFile('test.md', content);
    const violations = rule.lint(file);

    const importViolation = violations.find(v =>
      v.message.includes("doesn't show imports")
    );
    expect(importViolation).toBeDefined();
  });

  describe('JSON validator', () => {
    it('should flag invalid JSON syntax with ERROR severity', () => {
      const content = '# T\n\n```json\n{ "broken": ,, }\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      const v = violations.find(x => x.message.includes('Invalid JSON syntax'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.ERROR);
    });

    it('should not flag valid JSON', () => {
      const content = '# T\n\n```json\n{"ok": true, "n": 1}\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('Invalid JSON'))).toBe(
        false
      );
    });
  });

  describe('YAML validator', () => {
    it('should flag tabs in YAML', () => {
      const content = '# T\n\n```yaml\nkey:\n\tvalue: 1\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      const v = violations.find(x => x.message.includes('spaces, not tabs'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.ERROR);
    });

    it('should accept space-indented YAML', () => {
      const content = '# T\n\n```yaml\nkey:\n  nested: 1\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('spaces, not tabs'))).toBe(
        false
      );
    });
  });

  describe('SQL validator', () => {
    it('should warn on SELECT *', () => {
      const content = '# T\n\n```sql\nSELECT * FROM users;\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      const v = violations.find(x => x.message.includes('SELECT *'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should flag template-literal SQL injection patterns', () => {
      const content =
        '# T\n\n```sql\nSELECT id FROM users WHERE name = ${userInput};\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      const v = violations.find(x =>
        x.message.includes('SQL injection vulnerability')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.ERROR);
    });

    it('should not flag parameterized queries', () => {
      const content =
        '# T\n\n```sql\nSELECT id FROM users WHERE name = $1 AND active = $2;\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      expect(
        violations.some(v => v.message.includes('SQL injection vulnerability'))
      ).toBe(false);
      expect(violations.some(v => v.message.includes('SELECT *'))).toBe(false);
    });
  });

  describe('Python validator', () => {
    it('should INFO on print() in non-example (anti-pattern) blocks', () => {
      // Heading containing "anti-pattern" sets metadata.isExample=false,
      // which is the only branch where the print() check fires.
      const content = '# Anti-pattern\n\n```python\nprint("hello")\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('print()'))).toBe(true);
    });

    it('should WARN on bare except clause', () => {
      const content =
        '# T\n\n```python\ntry:\n    risky()\nexcept:\n    pass\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      const v = violations.find(
        x => x.message.includes('bare') && x.message.includes('except')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should INFO on functions without type hints', () => {
      const content =
        '# T\n\n```python\ndef greet(name):\n    return name\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('type hints'))).toBe(true);
    });

    it('should accept type-hinted functions', () => {
      const content =
        '# T\n\n```python\ndef greet(name: str) -> str:\n    return name\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('type hints'))).toBe(
        false
      );
    });
  });

  describe('Go validator', () => {
    it('should ERROR on unhandled error from := assignment', () => {
      const content =
        '# T\n\n```go\nresult, err := doThing()\nfmt.Println(result)\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      const v = violations.find(x => x.message.includes('Error not handled'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.ERROR);
    });

    it('should accept properly handled error', () => {
      const content =
        '# T\n\n```go\nresult, err := doThing()\nif err != nil {\n  return err\n}\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      expect(
        violations.some(v => v.message.includes('Error not handled'))
      ).toBe(false);
    });

    it('should WARN on panic() outside anti-pattern blocks', () => {
      const content = '# T\n\n```go\npanic("boom")\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);

      const v = violations.find(x => x.message.includes('panic()'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });
  });
});
