import { describe, it, expect } from 'vitest';
import { SkillStructureRule } from '../../../src/rules/SkillStructureRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('SkillStructureRule', () => {
  describe('constructor', () => {
    it('should create rule with default options', () => {
      const rule = new SkillStructureRule();

      expect(rule.id).toBe('skill-structure');
      expect(rule.description).toContain('skill');
    });

    it('should create rule with custom options', () => {
      const rule = new SkillStructureRule({
        requireDescription: false,
        maxDescriptionLength: 100,
      });

      expect(rule.id).toBe('skill-structure');
    });
  });

  describe('lint', () => {
    it('should return no violations for valid skill file', () => {
      const content = `---
name: my-awesome-skill
description: This skill does something useful
---

# My Awesome Skill

This skill helps with tasks.

1. First step
2. Second step
`;

      const rule = new SkillStructureRule();
      const file = new ContextFile(
        '.claude/skills/my-awesome-skill.md',
        content
      );

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should return error for missing frontmatter', () => {
      const content = `# My Skill

This skill has no frontmatter.`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/my-skill.md', content);

      const violations = rule.lint(file);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.message).toContain('frontmatter');
      expect(violations[0]?.severity).toBe(Severity.ERROR);
    });

    it('should return error for missing name', () => {
      const content = `---
description: This skill has no name
---

# Skill`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/unnamed.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('name'))).toBe(true);
    });

    it('should return error for invalid name format', () => {
      const content = `---
name: My Wrong Name With Spaces
description: Invalid name format
---

# Skill`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/bad-name.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('kebab-case'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.ERROR);
    });

    it('should return error for missing description', () => {
      const content = `---
name: valid-skill-name
---

# Skill`;

      const rule = new SkillStructureRule({ requireDescription: true });
      const file = new ContextFile('.claude/skills/missing-desc.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('description'))).toBe(
        true
      );
    });

    it('should return warning for description too short', () => {
      const content = `---
name: short-desc-skill
description: Short
---

# Skill`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/short.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('too short'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.WARNING);
    });

    it('should return warning for description too long', () => {
      const content = `---
name: long-desc-skill
description: ${'a'.repeat(250)}
---

# Skill`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/long.md', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('too long'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.WARNING);
    });

    it('should not lint non-skill files', () => {
      const content = `# Just a regular file

Some content.`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should accept valid kebab-case names', () => {
      const content = `---
name: my-valid-skill-name-123
description: Valid name with numbers
---

# Skill`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/valid.md', content);

      const violations = rule.lint(file);

      expect(
        violations.filter(v => v.message.includes('kebab-case'))
      ).toHaveLength(0);
    });

    it('should handle disable_model_invocation flag', () => {
      const content = `---
name: automated-skill
description: This skill runs without model invocation
disable_model_invocation: true
---

# Automated Skill`;

      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/automated.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });
  });
});
