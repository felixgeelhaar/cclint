import { describe, it, expect } from 'vitest';
import { CodeBlockRule } from '../../../src/rules/CodeBlockRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('CodeBlockRule', () => {
  const rule = new CodeBlockRule();

  it('should have correct id and description', () => {
    expect(rule.id).toBe('code-blocks');
    expect(rule.description).toBe('Validates code blocks for syntax and best practices');
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

    const varViolation = violations.find(v => v.message.includes("Use 'const' or 'let'"));
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

    const asyncViolation = violations.find(v => v.message.includes('error handling'));
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

    const errorViolation = violations.find(v => v.message.includes('Error not handled'));
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

    const quoteViolation = violations.find(v => v.message.includes('Quote variables'));
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
    const injectionViolation = violations.find(v => v.message.includes('SQL injection'));
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

    const jsonViolation = violations.find(v => v.message.includes('Invalid JSON'));
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

    const yamlViolation = violations.find(v => v.message.includes('spaces, not tabs'));
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
    const unmarkedViolation = violations.find(v => v.message.includes('not clearly marked'));
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

    const incompleteViolation = violations.find(v => v.message.includes('Incomplete'));
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

    const importViolation = violations.find(v => v.message.includes("doesn't show imports"));
    expect(importViolation).toBeDefined();
  });
});