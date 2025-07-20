import { describe, it, expect } from 'vitest';
import { ContentRule } from '../../../src/rules/ContentRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('ContentRule', () => {
  describe('constructor', () => {
    it('should create rule with default required patterns', () => {
      const rule = new ContentRule();

      expect(rule.id).toBe('content');
      expect(rule.description).toContain('required content');
    });

    it('should create rule with custom patterns', () => {
      const patterns = [
        { pattern: 'npm test', description: 'Test command' },
        { pattern: 'npm build', description: 'Build command' }
      ];
      const rule = new ContentRule(patterns);

      expect(rule.id).toBe('content');
      expect(rule.description).toContain('Test command, Build command');
    });
  });

  describe('lint', () => {
    it('should return no violations when all patterns are present', () => {
      const content = `# Project Overview

This is a description.

## Development Commands

\`\`\`bash
npm install
npm test
npm run build
\`\`\`

## Architecture

The system uses TypeScript and follows domain-driven design.`;

      const rule = new ContentRule();
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should return violations for missing required patterns', () => {
      const content = `# Project Overview

This is a description with no commands or technical details.`;

      const rule = new ContentRule();
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations.length).toBeGreaterThan(0);
      
      const messages = violations.map(v => v.message);
      expect(messages.some(msg => msg.includes('npm'))).toBe(true);
      expect(messages.some(msg => msg.includes('TypeScript'))).toBe(true);
    });

    it('should handle custom patterns', () => {
      const patterns = [
        { pattern: 'docker build', description: 'Docker build command' },
        { pattern: 'pytest', description: 'Python test command' }
      ];
      
      const content = `# Project
      
Some content but missing the required patterns.`;

      const rule = new ContentRule(patterns);
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(2);
      expect(violations[0]?.message).toContain('Docker build command');
      expect(violations[1]?.message).toContain('Python test command');
      expect(violations[0]?.severity).toBe(Severity.WARNING);
    });

    it('should be case insensitive for pattern matching', () => {
      const patterns = [
        { pattern: 'TypeScript', description: 'TypeScript usage' }
      ];
      
      const content = `# Project
      
This project uses typescript for development.`;

      const rule = new ContentRule(patterns);
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should handle regex patterns', () => {
      const patterns = [
        { pattern: 'npm (run )?test', description: 'Test command', isRegex: true }
      ];
      
      const content1 = `Commands: npm test`;
      const content2 = `Commands: npm run test`;
      const content3 = `Commands: yarn test`;

      const rule = new ContentRule(patterns);
      const file1 = new ContextFile('/test/CLAUDE.md', content1);
      const file2 = new ContextFile('/test/CLAUDE.md', content2);
      const file3 = new ContextFile('/test/CLAUDE.md', content3);

      expect(rule.lint(file1)).toHaveLength(0);
      expect(rule.lint(file2)).toHaveLength(0);
      expect(rule.lint(file3)).toHaveLength(1);
    });

    it('should handle empty patterns array', () => {
      const rule = new ContentRule([]);
      const file = new ContextFile('/test/CLAUDE.md', 'Any content');

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should report correct line numbers for violations', () => {
      const patterns = [
        { pattern: 'missing-pattern', description: 'Missing pattern' }
      ];
      
      const rule = new ContentRule(patterns);
      const file = new ContextFile('/test/CLAUDE.md', 'Content without pattern');

      const violations = rule.lint(file);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.location.line).toBe(1);
      expect(violations[0]?.location.column).toBe(1);
    });
  });
});