import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { get as httpGet } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  metricsCommand,
  startMetricsDashboard,
} from '../../../../src/cli/commands/metrics.js';

describe('metrics command actions (in-process)', () => {
  let workDir: string;
  const originalCwd = process.cwd();
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-metrics-cmd-'));
    writeFileSync(
      join(workDir, 'CLAUDE.md'),
      '# P\n\n## Project Overview\n\nT.\n\n## Development Commands\n\nnpm test\n\n## Architecture\n\nHex.\n'
    );
    process.chdir(workDir);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  async function run(...args: string[]): Promise<void> {
    await metricsCommand.parseAsync(args, { from: 'user' });
  }

  function seedHistory(score = 88): void {
    mkdirSync(join(workDir, '.cclint'), { recursive: true });
    writeFileSync(
      join(workDir, '.cclint', 'metrics.jsonl'),
      `${JSON.stringify({
        recordedAt: '2026-09-21T00:00:00.000Z',
        path: workDir,
        files: 1,
        errors: 0,
        warnings: 0,
        infos: 0,
        score,
      })}\n`
    );
  }

  it('show prints empty-state guidance when nothing is recorded', async () => {
    await run('show');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No metrics recorded')
    );
  });

  it('show prints recorded snapshots', async () => {
    seedHistory(91);
    await run('show');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/score=91.*files=1/)
    );
  });

  it('badge prints shields markdown for the latest score', async () => {
    seedHistory(95);
    await run('badge');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://img.shields.io/badge/cclint-95-brightgreen'
      )
    );
  });

  it('badge exits when history is empty', async () => {
    await expect(run('badge')).rejects.toThrow('process.exit:1');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no metrics recorded')
    );
  });

  it('record rejects a missing path', async () => {
    await expect(run('record', 'missing-path-xyz')).rejects.toThrow(
      'process.exit:1'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('path not found')
    );
  });

  it('record accepts a single file path', async () => {
    await run('record', join(workDir, 'CLAUDE.md'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Recorded'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/score=\d+/));
  });

  it('serve rejects a negative port', async () => {
    await expect(run('serve', '--port', '-1')).rejects.toThrow('process.exit:1');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--port must be a non-negative number')
    );
  });

  it('startMetricsDashboard serves the latest score as HTML', async () => {
    seedHistory(77);
    const server = await startMetricsDashboard(0);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      server.close();
      throw new Error('expected TCP address');
    }

    const html = await new Promise<string>((resolve, reject) => {
      httpGet(`http://127.0.0.1:${address.port}/`, res => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }).on('error', reject);
    });

    expect(html).toContain('Latest score: 77');
    expect(html).toContain('cclint metrics');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`http://127.0.0.1:${address.port}`)
    );

    await new Promise<void>((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  });
});
