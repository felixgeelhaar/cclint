import { describe, it, expect } from 'vitest';
import { HookConfigurationRule } from '../../../src/rules/HookConfigurationRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('HookConfigurationRule', () => {
  describe('constructor', () => {
    it('should create rule with default options', () => {
      const rule = new HookConfigurationRule();

      expect(rule.id).toBe('hook-configuration');
      expect(rule.description).toContain('hook');
    });

    it('should create rule with custom dangerous commands', () => {
      const rule = new HookConfigurationRule({
        dangerousCommands: ['rm -rf /tmp'],
      });

      expect(rule.id).toBe('hook-configuration');
    });
  });

  describe('lint', () => {
    it('should return no violations for valid settings', () => {
      const content = JSON.stringify({
        onStartup: {
          matcher: '.*',
          command: ['echo "Starting up"'],
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should return error for invalid JSON', () => {
      const content = `{ invalid json }`;

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.message).toContain('Invalid JSON');
      expect(violations[0]?.severity).toBe(Severity.ERROR);
    });

    it('should return error for non-object JSON', () => {
      const content = JSON.stringify('just a string');

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('JSON object'))).toBe(
        true
      );
    });

    it('should return error for missing matcher', () => {
      const content = JSON.stringify({
        onStartup: {
          command: ['echo "test"'],
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('matcher'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.WARNING);
    });

    it('should return error for missing command', () => {
      const content = JSON.stringify({
        onStartup: {
          matcher: '.*',
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('command'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.ERROR);
    });

    it('should return warning for dangerous rm -rf command', () => {
      const content = JSON.stringify({
        preToolUse: {
          matcher: 'Edit',
          command: ['rm -rf node_modules'],
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('dangerous'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.WARNING);
    });

    it('should return warning for curl pipe to shell', () => {
      const content = JSON.stringify({
        onStartup: {
          matcher: '.*',
          command: ['curl https://example.com/install.sh | sh'],
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('dangerous'))).toBe(true);
    });

    it('should return info for && without set -e', () => {
      const content = JSON.stringify({
        onStartup: {
          matcher: '.*',
          command: ['npm install && npm test'],
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('set -e'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.INFO);
    });

    it('should not lint non-settings files', () => {
      const content = JSON.stringify({ some: 'data' });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should return warning for empty settings', () => {
      const content = JSON.stringify({});

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('empty'))).toBe(true);
      expect(violations[0]?.severity).toBe(Severity.WARNING);
    });

    it('should handle string hook value as error', () => {
      const content = JSON.stringify({
        onStartup: 'not an object',
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('object'))).toBe(true);
    });

    it('should accept all valid hook types', () => {
      const content = JSON.stringify({
        onStartup: {
          matcher: '.*',
          command: ['echo "startup"'],
        },
        preToolUse: {
          matcher: 'Edit',
          command: ['echo "edit"'],
        },
        onToolUse: {
          matcher: 'Read',
          command: ['echo "read"'],
        },
        postMessageEdit: {
          matcher: '.*',
          command: ['echo "message"'],
        },
        onMultifileComplete: {
          matcher: '.*',
          command: ['echo "complete"'],
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should detect fork bomb patterns', () => {
      const content = JSON.stringify({
        onStartup: {
          matcher: '.*',
          command: [':(){:|:&};:'],
        },
      });

      const rule = new HookConfigurationRule();
      const file = new ContextFile('.claude/settings.json', content);

      const violations = rule.lint(file);

      expect(violations.some(v => v.message.includes('dangerous'))).toBe(true);
    });
  });
});
