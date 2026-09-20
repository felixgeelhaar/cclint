import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('cclint suggest / analyze (integration)', () => {
  let workDir: string;
  const originalEnv = process.env['ANTHROPIC_API_KEY'];

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-ai-'));
    delete process.env['ANTHROPIC_API_KEY'];
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    if (originalEnv === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = originalEnv;
  });

  it('suggest fails without ANTHROPIC_API_KEY', () => {
    const file = join(workDir, 'CLAUDE.md');
    writeFileSync(file, '# Project\n\n## Overview\n\nHi.\n');

    expect(() =>
      execFileSync('npx', ['tsx', 'src/cli/index.ts', 'suggest', file], {
        encoding: 'utf-8',
        env: { ...process.env, ANTHROPIC_API_KEY: '' },
      })
    ).toThrow();
  });

  it('analyze prints health summary without AI', () => {
    const file = join(workDir, 'CLAUDE.md');
    writeFileSync(
      file,
      '# Project\n\n## Project Overview\n\nT.\n\n## Development Commands\n\nnpm test\n\n## Architecture\n\nHex.\n'
    );

    const output = execFileSync(
      'npx',
      ['tsx', 'src/cli/index.ts', 'analyze', workDir],
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Instruction health');
    expect(output).toContain('Files:');
    expect(output).toContain('CLAUDE.md:');
  });

  it('analyze --ai fails without ANTHROPIC_API_KEY', () => {
    expect(() =>
      execFileSync(
        'npx',
        ['tsx', 'src/cli/index.ts', 'analyze', workDir, '--ai'],
        {
          encoding: 'utf-8',
          env: { ...process.env, ANTHROPIC_API_KEY: '' },
        }
      )
    ).toThrow();
  });
});
