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
model: claude-sonnet-4-6
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

    it('should return info for unknown tool', () => {
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

      const unknownToolViolation = violations.find(v =>
        v.message.includes('UnknownTool')
      );
      expect(unknownToolViolation).toBeDefined();
      expect(unknownToolViolation?.severity).toBe(Severity.INFO);
    });

    it('should accept mcp__ prefixed tools without warnings', () => {
      const content = `---
name: mcp-agent
description: Uses MCP tools
tools:
  - Read
  - mcp__github__list_issues
  - mcp__filesystem__read_file
---

You are an agent that uses MCP servers for context.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/mcp-agent.md', content);

      const violations = rule.lint(file);
      const toolViolation = violations.find(v => v.message.includes('mcp__'));
      expect(toolViolation).toBeUndefined();
    });

    it('should return info for unknown model', () => {
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
      expect(unknownModelViolation?.severity).toBe(Severity.INFO);
    });

    it('should flag legacy Claude 3 models as deprecated', () => {
      const content = `---
name: legacy-agent
description: Uses a legacy Claude 3 model
model: claude-3-5-sonnet
---

You are an agent on a deprecated model family.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/legacy.md', content);

      const violations = rule.lint(file);
      const deprecationViolation = violations.find(v =>
        v.message.includes('deprecated')
      );
      expect(deprecationViolation).toBeDefined();
      expect(deprecationViolation?.severity).toBe(Severity.INFO);
    });

    it('should accept Claude 4.X models without warnings', () => {
      const content = `---
name: modern-agent
description: Uses current Claude 4 models
model: claude-opus-4-7
---

You are an agent on a current Claude 4 model.`;

      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/modern.md', content);

      const violations = rule.lint(file);
      const modelViolation = violations.find(v =>
        v.message.includes('claude-opus-4-7')
      );
      expect(modelViolation).toBeUndefined();
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

  describe('file path filter', () => {
    it('should not lint files outside .claude/agents/', () => {
      const content = `---\nname: x\ndescription: y\n---\n\nHello world this is fine`;
      const rule = new SubagentStructureRule();

      const projectFile = new ContextFile('docs/agent.md', content);
      expect(rule.lint(projectFile)).toEqual([]);

      const skillFile = new ContextFile('.claude/skills/foo.md', content);
      expect(rule.lint(skillFile)).toEqual([]);
    });

    it('should not lint .claude/agents files that do not end in .md', () => {
      const rule = new SubagentStructureRule();
      const content = `---\nname: x\ndescription: y\n---\n\nHello.`;
      const file = new ContextFile('.claude/agents/foo.txt', content);

      expect(rule.lint(file)).toEqual([]);
    });
  });

  describe('frontmatter parsing edge cases', () => {
    it('should handle inline-array tools syntax', () => {
      const content = `---
name: inline-tools-agent
description: Uses inline array tools
tools: [Read, Edit, Bash]
---

You are a helpful agent. This prompt is long enough.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/inline.md', content);

      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('Unknown tool'))).toBe(
        false
      );
    });

    it('should accept quoted name and description', () => {
      const content = `---
name: "quoted-agent"
description: "Quoted description text"
---

You are a helpful agent that does many useful things.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/quoted.md', content);

      const violations = rule.lint(file);
      expect(
        violations.some(
          v =>
            v.message.includes('missing required "name"') ||
            v.message.includes('missing required "description"')
        )
      ).toBe(false);
    });

    it('should accept Claude 4.X aliases without warnings', () => {
      const variants = [
        'opus',
        'sonnet',
        'haiku',
        'claude-opus-4-7',
        'claude-sonnet-4-6',
        'claude-haiku-4-5',
      ];
      for (const m of variants) {
        const content = `---\nname: a\ndescription: b\nmodel: ${m}\n---\n\nLong enough prompt for tests to satisfy.`;
        const rule = new SubagentStructureRule();
        const file = new ContextFile('.claude/agents/a.md', content);
        const violations = rule.lint(file);

        expect(violations.some(v => v.message.includes(m))).toBe(false);
      }
    });

    it('should accept long-form Claude 4 model with date suffix', () => {
      const content = `---\nname: dated\ndescription: dated model\nmodel: claude-haiku-4-5-20251001\n---\n\nLong-enough prompt body for the rule to accept.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/dated.md', content);

      const violations = rule.lint(file);
      expect(
        violations.some(v => v.message.includes('claude-haiku-4-5-20251001'))
      ).toBe(false);
    });
  });

  describe('mcp__ wildcard regex', () => {
    it('should accept double-segment mcp__ tools', () => {
      const content = `---\nname: a\ndescription: b\ntools:\n  - mcp__github__list_issues\n---\n\nLong enough prompt for the rule.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/a.md', content);

      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('mcp__'))).toBe(false);
    });

    it('should accept single-segment mcp__ tools', () => {
      const content = `---\nname: a\ndescription: b\ntools:\n  - mcp__filesystem\n---\n\nLong enough prompt for the rule.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/a.md', content);

      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('mcp__'))).toBe(false);
    });

    it('should reject malformed mcp_ tools (single underscore)', () => {
      const content = `---\nname: a\ndescription: b\ntools:\n  - mcp_github__list\n---\n\nLong enough prompt for the rule.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/a.md', content);

      const violations = rule.lint(file);
      expect(
        violations.some(v =>
          v.message.includes('Unknown tool "mcp_github__list"')
        )
      ).toBe(true);
    });
  });

  describe('frontmatter parser detail', () => {
    it('should accept the major valid tools individually', () => {
      const tools = [
        'Read',
        'Edit',
        'Write',
        'Bash',
        'Glob',
        'Grep',
        'WebSearch',
        'WebFetch',
        'TodoWrite',
        'NotebookRead',
        'NotebookEdit',
        'Task',
        'Agent',
        'Skill',
        'ScheduleWakeup',
        'EnterPlanMode',
        'ExitPlanMode',
        'CronCreate',
      ];
      for (const tool of tools) {
        const content = `---\nname: a\ndescription: b\ntools:\n  - ${tool}\n---\n\nLong enough prompt for the rule.`;
        const rule = new SubagentStructureRule();
        const file = new ContextFile('.claude/agents/a.md', content);
        const violations = rule.lint(file);
        expect(
          violations.some(v => v.message.includes(`Unknown tool "${tool}"`)),
          `expected ${tool} to be accepted`
        ).toBe(false);
      }
    });

    it('should detect frontmatter with no closing ---', () => {
      const content = `---\nname: unclosed\ndescription: never closes\n\nNo closing fence.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/u.md', content);
      const violations = rule.lint(file);
      // With no closing ---, the prompt-content check finds no
      // post-frontmatter content and emits the missing-prompt ERROR.
      expect(
        violations.some(v => v.message.includes('missing prompt content'))
      ).toBe(true);
    });

    it('should report multiple frontmatter errors at once', () => {
      const content = `---\nname:\ndescription:\n---\n\nshort`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/m.md', content);
      const violations = rule.lint(file);
      // Empty name and description both fire as separate ERRORs.
      const nameMissing = violations.find(v =>
        v.message.includes('missing required "name"')
      );
      const descMissing = violations.find(v =>
        v.message.includes('missing required "description"')
      );
      expect(nameMissing).toBeDefined();
      expect(descMissing).toBeDefined();
    });

    it('should accept indented tools list with model field after', () => {
      const content = `---\nname: ind\ndescription: indented tools list\ntools:\n  - Read\n  - Edit\n  - Bash\nmodel: opus\n---\n\nLong enough prompt for the rule.`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/i.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('Unknown tool'))).toBe(
        false
      );
    });
  });

  describe('prompt content boundaries', () => {
    it('should flag prompts at 9 words (just below 10-word threshold)', () => {
      const content = `---\nname: nine\ndescription: nine-word prompt boundary test\n---\n\none two three four five six seven eight nine`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/n.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('too short'))).toBe(true);
    });

    it('should accept prompts at 10 words (boundary inclusive)', () => {
      const content = `---\nname: ten\ndescription: exact-ten word prompt boundary test\nmodel: opus\n---\n\none two three four five six seven eight nine ten`;
      const rule = new SubagentStructureRule();
      const file = new ContextFile('.claude/agents/t.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('too short'))).toBe(false);
    });
  });
});
