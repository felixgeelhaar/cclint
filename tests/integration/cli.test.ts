import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

describe('cclint CLI Integration', () => {
  const validFixture = join(__dirname, '../fixtures/valid-claude.md');
  const invalidFixture = join(__dirname, '../fixtures/invalid-claude.md');

  it('should exit with code 0 for valid file', () => {
    const result = execSync(`tsx src/cli/index.ts lint "${validFixture}"`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    expect(result).toContain('✅ No issues found');
  });

  it('should exit with code 1 for invalid file', () => {
    expect(() => {
      execSync(`tsx src/cli/index.ts lint "${invalidFixture}"`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    }).toThrow();
  });

  it('should output JSON format when requested', () => {
    const result = execSync(`tsx src/cli/index.ts lint "${validFixture}" --format json`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('file');
    expect(parsed).toHaveProperty('violations');
    expect(parsed).toHaveProperty('summary');
  });

  it('should respect max-size option', () => {
    const result = execSync(`tsx src/cli/index.ts lint "${validFixture}" --max-size 10`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    expect(result).toContain('File size');
    expect(result).toContain('warning');
  });
});