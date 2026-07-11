import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

describe('cclint CLI Integration', () => {
  const validFixture = join(__dirname, '../fixtures/valid-claude.md');
  const invalidFixture = join(__dirname, '../fixtures/invalid-claude.md');

  it('should exit with code 0 for valid file', () => {
    const result = execSync(`tsx src/cli/index.ts lint "${validFixture}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    expect(result).toContain('No issues found');
  });

  it('should exit with code 1 for invalid file', () => {
    expect(() => {
      execSync(`tsx src/cli/index.ts lint "${invalidFixture}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('should output JSON format when requested', () => {
    const result = execSync(
      `tsx src/cli/index.ts lint "${validFixture}" --format json`,
      {
        encoding: 'utf-8',
        stdio: 'pipe',
      }
    );

    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('file');
    expect(parsed).toHaveProperty('violations');
    expect(parsed).toHaveProperty('summary');
  });

  it('should output SARIF 2.1.0 format when requested', () => {
    const result = execSync(
      `tsx src/cli/index.ts lint "${validFixture}" --format sarif`,
      {
        encoding: 'utf-8',
        stdio: 'pipe',
      }
    );

    const sarif = JSON.parse(result);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif).toHaveProperty('$schema');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe('cclint');
    expect(Array.isArray(sarif.runs[0].results)).toBe(true);
  });

  it('should emit SARIF results and keep the non-zero exit code for invalid files', () => {
    let stdout = '';
    let exitCode = 0;
    try {
      execSync(`tsx src/cli/index.ts lint "${invalidFixture}" --format sarif`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      const execError = error as { status?: number; stdout?: string };
      exitCode = execError.status ?? 0;
      stdout = execError.stdout ?? '';
    }

    expect(exitCode).toBe(1);
    const sarif = JSON.parse(stdout);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results.length).toBeGreaterThan(0);
    expect(sarif.runs[0].tool.driver.rules.length).toBeGreaterThan(0);
    const first = sarif.runs[0].results[0];
    expect(first.ruleId).toBeTruthy();
    expect(['error', 'warning', 'note']).toContain(first.level);
    expect(
      first.locations[0].physicalLocation.region.startLine
    ).toBeGreaterThan(0);
  });

  it('should respect max-size option', () => {
    const result = execSync(
      `tsx src/cli/index.ts lint "${validFixture}" --max-size 10`,
      {
        encoding: 'utf-8',
        stdio: 'pipe',
      }
    );

    expect(result).toContain('File size');
    expect(result).toContain('warning');
  });
});
