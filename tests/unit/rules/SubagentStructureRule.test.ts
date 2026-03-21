import { describe, it, expect } from 'vitest';
import { SubagentStructureRule } from '../../../src/rules/SubagentStructureRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('SubagentStructureRule', () => {
  describe('constructor', () => {
    it('should create rule with default options', () => {
      const rule = new SubagentStructureRule();

      expect(rule.id).toBe('subagent-structure');
      expect(rule.description).toContain('subagent');
    });

    it('should create rule with custom options', () => {
      const rule = new SubagentStructureRule({
        allowDangerousTools: true,
      });

      expect(rule.id).toBe('subagent-structure');
    });
  });

  describe('lint', () => {
    it('should return no violations for valid agent file', () => {
      const content = `---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools:
  - Read
  - Grep
  - Glob
model: claude-3-5-sonnet
---

You are a senior security engineer. Review code for:
- Injection vulnerabilities
- Authentication flaws
- Secrets in code

Provide specific line references.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile(
        '.claude/agents/security-reviewer.md',
        content
      );

      const violations = rule.lint(file);

      if (violations.length > 0) {
        console.log(
          'Violations:',
          violations.map(v => ({ message: v.message, severity: v.severity }))
        );
      }
      expect(violations).toHaveLength(0);
    });

    it('should return error for missing frontmatter', () => {
      const content = `# My Agent

You are an agent with no frontmatter.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/my-agent.md', content);

      const violations = rule.lint(file);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.message).toContain('frontmatter');
      expect(violations[0]?.severity).toBe(Severity.ERROR);
    });

    it('should return error for missing name', () => {
      const content = `---
description: An agent without a name
---

# Agent`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/unnamed.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('name'))).toBe(true);
    });

    it('should return error for missing description', () => {
      const content = `---
name: missing-desc-agent
---

# Agent`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/missing-desc.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('description'))).toBe(
        true
      );
    });

    it('should return warning for unknown tool', () => {
      const content = `---
name: weird-agent
description: An agent with weird tools
tools:
  - Read
  - UnknownTool
---

# Agent`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/weird.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('UnknownTool'))).toBe(
        true
      );
      expect(violations[0]?.severity).toBe(Severity.WARNING);
    });

    it('should return warning for unknown model', () => {
      const content = `---
name: unknown-model-agent
description: Uses an unknown model
model: claude-99
---

# Agent`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/unknown-model.md', content);

      const violations = rule.lint(file);

      const unknownModelViolation = violations.find(v =>
        v.message.includes('claude-99')
      );
      expect(unknownModelViolation).toBeDefined();
      expect(unknownModelViolation?.severity).toBe(Severity.WARNING);
    });

    it('should return error for missing prompt content', () => {
      const content = `---
name: empty-agent
description: An agent with no prompt
---

`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/empty.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('prompt'))).toBe(true);
    });

    it('should return warning for short prompt', () => {
      const content = `---
name: short-agent
description: Short prompt agent
---

You are an agent.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/short.md', content);

      const violations = rule.lint(file);

      const tooShortViolation = violations.find(v =>
        v.message.includes('too short')
      );
      expect(tooShortViolation).toBeDefined();
      expect(tooShortViolation?.severity).toBe(Severity.WARNING);
    });

    it('should not lint non-agent files', () => {
      const content = `# Just a regular file

Some content.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should accept valid tools', () => {
      const content = `---
name: valid-tools-agent
description: Uses valid tools
tools:
  - Read
  - Edit
  - Bash
  - Glob
  - Grep
---

You are a helpful agent. Review and fix code issues.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/valid-tools.md', content);

      const violations = rule.lint(file);

      expect(violations.filter(v => v.message.includes('tool'))).toHaveLength(
        0
      );
    });

    it('should accept valid models', () => {
      const content = `---
name: sonnet-agent
description: Uses sonnet model
model: sonnet
---

You are a helpful agent.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/sonnet.md', content);

      const violations = rule.lint(file);

      expect(violations.filter(v => v.message.includes('model'))).toHaveLength(
        0
      );
    });
  });
});
