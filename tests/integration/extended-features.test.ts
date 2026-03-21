import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { readFileSync } from 'fs';
import { ContextFile } from '../../src/domain/ContextFile.js';
import { RulesEngine } from '../../src/domain/RulesEngine.js';
import { SkillStructureRule } from '../../src/rules/SkillStructureRule.js';
import { SubagentStructureRule } from '../../src/rules/SubagentStructureRule.js';
import { HookConfigurationRule } from '../../src/rules/HookConfigurationRule.js';

describe('Extended Features Integration', () => {
  const fixturesDir = join(__dirname, '../fixtures');

  describe('skill-structure rule', () => {
    it('should pass for valid skill file', () => {
      const validSkillPath = join(
        fixturesDir,
        '.claude/skills/database-design-migration.md'
      );
      const content = readFileSync(validSkillPath, 'utf-8');
      const file = new ContextFile(validSkillPath, content);

      const rule = new SkillStructureRule();
      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should fail for invalid skill file', () => {
      const invalidSkillPath = join(fixturesDir, '.claude/skills/bad-skill.md');
      const content = readFileSync(invalidSkillPath, 'utf-8');
      const file = new ContextFile(invalidSkillPath, content);

      const rule = new SkillStructureRule();
      const violations = rule.lint(file);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.ruleId).toBe('skill-structure');
    });

    it('should detect invalid name format', () => {
      const skillPath = join(fixturesDir, '.claude/skills/bad-skill.md');
      const content = readFileSync(skillPath, 'utf-8');
      const file = new ContextFile(skillPath, content);

      const rule = new SkillStructureRule();
      const violations = rule.lint(file);

      const nameViolation = violations.find(v =>
        v.message.includes('kebab-case')
      );
      expect(nameViolation).toBeDefined();
    });
  });

  describe('subagent-structure rule', () => {
    it('should pass for valid agent file', () => {
      const validAgentPath = join(
        fixturesDir,
        '.claude/agents/security-reviewer.md'
      );
      const content = readFileSync(validAgentPath, 'utf-8');
      const file = new ContextFile(validAgentPath, content);

      const rule = new SubagentStructureRule();
      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should fail for invalid agent file', () => {
      const invalidAgentPath = join(fixturesDir, '.claude/agents/bad-agent.md');
      const content = readFileSync(invalidAgentPath, 'utf-8');
      const file = new ContextFile(invalidAgentPath, content);

      const rule = new SubagentStructureRule();
      const violations = rule.lint(file);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.ruleId).toBe('subagent-structure');
    });

    it('should validate valid tools in agent', () => {
      const agentPath = join(
        fixturesDir,
        '.claude/agents/security-reviewer.md'
      );
      const content = readFileSync(agentPath, 'utf-8');
      const file = new ContextFile(agentPath, content);

      const rule = new SubagentStructureRule();
      const violations = rule.lint(file);

      expect(violations.filter(v => v.message.includes('tool'))).toHaveLength(
        0
      );
    });
  });

  describe('hook-configuration rule', () => {
    it('should pass for valid settings file', () => {
      const validSettingsPath = join(fixturesDir, '.claude/settings.json');
      const content = readFileSync(validSettingsPath, 'utf-8');
      const file = new ContextFile(validSettingsPath, content);

      const rule = new HookConfigurationRule();
      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should warn for dangerous commands in settings', () => {
      const dangerousContent = JSON.stringify({
        onStartup: {
          matcher: '.*',
          command: ['rm -rf /important-data'],
        },
      });
      const file = new ContextFile('.claude/settings.json', dangerousContent);

      const rule = new HookConfigurationRule();
      const violations = rule.lint(file);

      const dangerViolation = violations.find(v =>
        v.message.includes('dangerous')
      );
      expect(dangerViolation).toBeDefined();
      expect(dangerViolation?.severity.level).toBe(1); // WARNING
    });
  });

  describe('RulesEngine integration', () => {
    it('should aggregate violations from all extended rules', () => {
      const validSkillPath = join(fixturesDir, '.claude/skills/bad-skill.md');
      const content = readFileSync(validSkillPath, 'utf-8');
      const file = new ContextFile(validSkillPath, content);

      const rules = [
        new SkillStructureRule(),
        new SubagentStructureRule(),
        new HookConfigurationRule(),
      ];

      const engine = new RulesEngine(rules);
      const result = engine.lint(file);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.getErrorCount()).toBeGreaterThan(0);
    });
  });
});
