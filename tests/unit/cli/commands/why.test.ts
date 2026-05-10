import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('cclint why command (integration)', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-why-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('should print rule rationale + good example for a violation', () => {
    const file = join(workDir, 'CLAUDE.md');
    // Trigger code-blocks rule (untyped fence).
    writeFileSync(
      file,
      '# Test\n\n## Project Overview\n\nT.\n\n## Development Commands\n\nT.\n\n## Architecture\n\nT.\n\n```\nplain\n```\n',
      'utf-8'
    );

    const output = execSync(
      `tsx src/cli/index.ts why "${file}" --rule code-blocks`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    expect(output).toContain('code-blocks');
    expect(output).toContain('Why this rule exists');
    expect(output).toContain('Good example');
  });

  it('should print "No matching violations" when filter has no hits', () => {
    const file = join(workDir, 'CLAUDE.md');
    writeFileSync(
      file,
      '# Test\n\n## Project Overview\n\nA.\n\n## Development Commands\n\nB.\n\n## Architecture\n\nC.\n',
      'utf-8'
    );

    const output = execSync(
      `tsx src/cli/index.ts why "${file}" --rule nonexistent-rule`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    expect(output).toContain('No matching violations');
  });

  it('should fail clearly when --ai is used without ANTHROPIC_API_KEY', () => {
    const file = join(workDir, 'CLAUDE.md');
    writeFileSync(file, '# Test\n\n```\nplain\n```\n', 'utf-8');

    expect(() => {
      execSync(`tsx src/cli/index.ts why "${file}" --ai`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, ANTHROPIC_API_KEY: '' },
      });
    }).toThrow();
  });
});
