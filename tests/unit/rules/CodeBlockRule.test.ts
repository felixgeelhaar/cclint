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

  describe('JavaScript/TypeScript validator', () => {
    it('should INFO on console.log in non-anti-pattern blocks', () => {
      const content = '# T\n\n```javascript\nconsole.log("hi");\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x => x.message.includes('console statements'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should INFO on console.error / console.warn equally', () => {
      const cWarn = '# T\n\n```javascript\nconsole.warn("hi");\n```\n';
      const cErr = '# T\n\n```javascript\nconsole.error("hi");\n```\n';
      const rule2 = new CodeBlockRule();
      expect(
        rule2
          .lint(new ContextFile('t.md', cWarn))
          .some(v => v.message.includes('console statements'))
      ).toBe(true);
      expect(
        rule2
          .lint(new ContextFile('t.md', cErr))
          .some(v => v.message.includes('console statements'))
      ).toBe(true);
    });

    it('should not WARN on == when comparing to null', () => {
      const content = '# T\n\n```javascript\nif (x == null) { return; }\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes("'==='"))).toBe(false);
    });

    it('should accept async functions with try/catch', () => {
      const content =
        '# T\n\n```javascript\nasync function f() { try { await x(); } catch (e) { } }\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      expect(
        violations.some(v =>
          v.message.includes('Async function should include')
        )
      ).toBe(false);
    });

    it('should ERROR on var in strict mode (default)', () => {
      const content = '# T\n\n```javascript\nvar x = 1;\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x => x.message.includes("'const' or 'let'"));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.ERROR);
    });

    it('should WARN on var when strict mode is disabled', () => {
      const rule2 = new CodeBlockRule({ strict: false });
      const content = '# T\n\n```javascript\nvar x = 1;\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule2.lint(file);
      const v = violations.find(x => x.message.includes("'const' or 'let'"));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });
  });

  describe('Bash validator (extra)', () => {
    it('should ERROR on rm -rf in non-anti-pattern bash blocks', () => {
      const content = '# T\n\n```bash\nrm -rf /tmp/x\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x => x.message.includes("'rm -rf'"));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.ERROR);
    });

    it('should INFO on cd without || on next line', () => {
      const content = '# T\n\n```bash\ncd /var/log\nls\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x => x.message.includes('cd command success'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.INFO);
    });

    it('should not flag cd when next line uses ||', () => {
      const content = '# T\n\n```bash\ncd /var/log\n|| exit 1\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      expect(
        violations.some(v => v.message.includes('cd command success'))
      ).toBe(false);
    });

    it('should not flag $@ or $* (intentional special vars)', () => {
      const content = '# T\n\n```bash\nfn() { echo "$@"; }\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('Quote variables'))).toBe(
        false
      );
    });
  });

  describe('language disable', () => {
    it('should skip language-specific validation when language not in enabled set', () => {
      const rule2 = new CodeBlockRule({
        languages: ['python'], // disable js
      });
      const content =
        '# T\n\n```javascript\nvar x = 1;\nconsole.log(x);\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule2.lint(file);
      // Disabled language → no js-specific violations.
      expect(violations.some(v => v.message.includes("'const' or 'let'"))).toBe(
        false
      );
      expect(
        violations.some(v => v.message.includes('console statements'))
      ).toBe(false);
    });
  });

  describe('untyped fence', () => {
    it('should always WARN on untyped fence regardless of content', () => {
      const content = '# T\n\n```\nplain text\n```\n';
      const file = new ContextFile('t.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x =>
        x.message.includes('should specify a language')
      );
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });
  });
});
