import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { metricsCommand } from '../../../../src/cli/commands/metrics.js';

describe('cclint metrics', () => {
  let workDir: string;
  const originalCwd = process.cwd();
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-metrics-'));
    writeFileSync(
      join(workDir, 'CLAUDE.md'),
      '# P\n\n## Project Overview\n\nT.\n\n## Development Commands\n\nnpm test\n\n## Architecture\n\nHex.\n'
    );
    process.chdir(workDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  it('records a snapshot and exports it', async () => {
    await metricsCommand.parseAsync(['record', '.'], { from: 'user' });

    const store = join(workDir, '.cclint', 'metrics.jsonl');
    expect(existsSync(store)).toBe(true);
    const line = JSON.parse(readFileSync(store, 'utf8').trim()) as {
      score: number;
      files: number;
    };
    expect(line.files).toBe(1);
    expect(line.score).toBeGreaterThanOrEqual(0);
    expect(line.score).toBeLessThanOrEqual(100);

    await metricsCommand.parseAsync(['export'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"score"'));
  });
});
