import { describe, it, expect } from 'vitest';
import { StructureRule } from '../../../src/rules/StructureRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

describe('StructureRule', () => {
  describe('constructor', () => {
    it('should create rule with default required sections', () => {
      const rule = new StructureRule();

      expect(rule.id).toBe('structure');
      expect(rule.description).toContain('required sections');
    });

    it('should create rule with custom required sections', () => {
      const rule = new StructureRule(['Custom Section']);

      expect(rule.id).toBe('structure');
    });
  });

  describe('lint', () => {
    it('should return no violations when all required sections are present', () => {
      const content = `# Project Overview

This is a description.

## Development Commands

npm install
npm test

## Architecture

The system is built with...`;

      const rule = new StructureRule();
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });

    it('should return violations for missing required sections', () => {
      const content = `# Project Overview

This is a description.

## Development Commands

npm install
npm test`;

      const rule = new StructureRule();
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.ruleId).toBe('structure');
      expect(violations[0]?.severity).toBe(Severity.ERROR);
      expect(violations[0]?.message).toContain('Architecture');
      expect(violations[0]?.location.line).toBe(1);
    });

    it('should handle multiple missing sections', () => {
      const content = `# Some Random Title

Content here.`;

      const rule = new StructureRule();
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(3);
      
      const missingTitles = violations.map(v => v.message);
      expect(missingTitles.some(msg => msg.includes('Project Overview'))).toBe(true);
      expect(missingTitles.some(msg => msg.includes('Development Commands'))).toBe(true);
      expect(missingTitles.some(msg => msg.includes('Architecture'))).toBe(true);
    });

    it('should be case sensitive for section titles', () => {
      const content = `# project overview
## development commands
## architecture`;

      const rule = new StructureRule();
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(3);
    });

    it('should work with custom required sections', () => {
      const content = `# Custom Section
## Another Section`;

      const rule = new StructureRule(['Custom Section', 'Missing Section']);
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain('Missing Section');
    });

    it('should handle files with no sections', () => {
      const content = 'Just plain text with no headers.';

      const rule = new StructureRule(['Required Section']);
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.message).toContain('Required Section');
    });

    it('should handle empty required sections array', () => {
      const content = 'Any content';
      
      const rule = new StructureRule([]);
      const file = new ContextFile('/test/CLAUDE.md', content);

      const violations = rule.lint(file);

      expect(violations).toHaveLength(0);
    });
  });
});