import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('cclint metrics', () => {
  let workDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-metrics-'));
    writeFileSync(
      join(workDir, 'CLAUDE.md'),
      '# P\n\n## Project Overview\n\nT.\n\n## Development Commands\n\nnpm test\n\n## Architecture\n\nHex.\n'
    );
    process.chdir(workDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  it('records a snapshot and exports it', () => {
    const cli = join(originalCwd, 'src/cli/index.ts');
    execFileSync('npx', ['tsx', cli, 'metrics', 'record', '.'], {
      encoding: 'utf-8',
      cwd: workDir,
    });

    const store = join(workDir, '.cclint', 'metrics.jsonl');
    expect(existsSync(store)).toBe(true);
    const line = JSON.parse(readFileSync(store, 'utf8').trim()) as {
      score: number;
      files: number;
    };
    expect(line.files).toBe(1);
    expect(line.score).toBeGreaterThanOrEqual(0);
    expect(line.score).toBeLessThanOrEqual(100);

    const exported = execFileSync('npx', ['tsx', cli, 'metrics', 'export'], {
      encoding: 'utf-8',
      cwd: workDir,
    });
    expect(exported).toContain('"score"');
  });
});
