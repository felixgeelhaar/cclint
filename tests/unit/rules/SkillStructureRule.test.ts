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

  describe('file path filter', () => {
    it('should skip files outside .claude/skills/', () => {
      const content =
        '---\nname: x\ndescription: this should normally fire\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('docs/skill.md', content);
      expect(rule.lint(file)).toEqual([]);
    });

    it('should skip non-md files inside .claude/skills/', () => {
      const content =
        '---\nname: x\ndescription: this should normally fire\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/foo.txt', content);
      expect(rule.lint(file)).toEqual([]);
    });
  });

  describe('skill name validation', () => {
    it('should ERROR on PascalCase names', () => {
      const content =
        '---\nname: MyBadName\ndescription: This is a valid description.\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x => x.message.includes('kebab-case'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.ERROR);
    });

    it('should ERROR on snake_case names', () => {
      const content =
        '---\nname: snake_case\ndescription: This is a valid description.\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('kebab-case'))).toBe(true);
    });

    it('should ERROR on names starting with a digit', () => {
      const content =
        '---\nname: 1-skill\ndescription: This is a valid description.\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('kebab-case'))).toBe(true);
    });

    it('should accept multi-segment kebab-case', () => {
      const content =
        '---\nname: my-skill-name\ndescription: This is a valid description.\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('kebab-case'))).toBe(
        false
      );
    });

    it('should accept names with embedded digits', () => {
      const content =
        '---\nname: skill-v2\ndescription: This is a valid description.\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('kebab-case'))).toBe(
        false
      );
    });
  });

  describe('description length boundaries', () => {
    it('should WARN on too-short descriptions (<10 chars)', () => {
      const content = '---\nname: x\ndescription: short\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x => x.message.includes('too short'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should WARN on too-long descriptions (>200 chars by default)', () => {
      const longDesc = 'a'.repeat(201);
      const content = `---\nname: x\ndescription: ${longDesc}\n---\n\nBody.`;
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      const v = violations.find(x => x.message.includes('too long'));
      expect(v).toBeDefined();
      expect(v?.severity).toBe(Severity.WARNING);
    });

    it('should accept exactly 10-character description (lower bound inclusive)', () => {
      const content = '---\nname: x\ndescription: 1234567890\n---\n\nBody.';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('too short'))).toBe(false);
    });
  });

  describe('structure check', () => {
    it('should WARN when file is empty (no content at all)', () => {
      // Note: current implementation considers frontmatter key:value
      // pairs as "content" because validateStructure iterates over all
      // lines including frontmatter body. Pin behavior: warning fires
      // only on a literally empty file.
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', '');
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('appears empty'))).toBe(
        true
      );
    });

    it('should not warn when body has prose content after frontmatter', () => {
      const content =
        '---\nname: x\ndescription: This is a valid description here.\n---\n\n# Skill\n\nUseful instructions go here.\n';
      const rule = new SkillStructureRule();
      const file = new ContextFile('.claude/skills/x.md', content);
      const violations = rule.lint(file);
      expect(violations.some(v => v.message.includes('appears empty'))).toBe(
        false
      );
    });
  });
});
