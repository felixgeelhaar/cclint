import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'fs';
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

  it('analyze --draft prints a codebase-aware preview without writing', () => {
    writeFileSync(
      join(workDir, 'package.json'),
      JSON.stringify({
        name: 'draft-demo',
        description: 'Demo project',
        devDependencies: { typescript: '^5.0.0', vitest: '^2.0.0' },
      })
    );
    writeFileSync(join(workDir, 'tsconfig.json'), '{}');

    const output = execFileSync(
      'npx',
      ['tsx', 'src/cli/index.ts', 'analyze', workDir, '--draft'],
      { encoding: 'utf-8' }
    );

    expect(output).toContain('Draft CLAUDE.md');
    expect(output).toContain('Template: typescript');
    expect(output).toContain('----- BEGIN DRAFT -----');
    expect(output).toContain('draft-demo');
    expect(output).toContain('Preview only');
    expect(existsSync(join(workDir, 'CLAUDE.md'))).toBe(false);
  });

  it('analyze --draft --write creates CLAUDE.md when missing', () => {
    writeFileSync(
      join(workDir, 'package.json'),
      JSON.stringify({
        name: 'write-demo',
        description: 'Write demo',
        bin: { 'write-demo': './bin.js' },
      })
    );

    const output = execFileSync(
      'npx',
      ['tsx', 'src/cli/index.ts', 'analyze', workDir, '--draft', '--write'],
      { encoding: 'utf-8' }
    );

    const claudePath = join(workDir, 'CLAUDE.md');
    expect(output).toContain(`Wrote ${claudePath}`);
    expect(existsSync(claudePath)).toBe(true);
    expect(readFileSync(claudePath, 'utf-8')).toContain('write-demo');
  });

  it('analyze --draft --write refuses to overwrite existing CLAUDE.md', () => {
    writeFileSync(join(workDir, 'CLAUDE.md'), '# Existing\n');
    writeFileSync(
      join(workDir, 'package.json'),
      JSON.stringify({ name: 'exists-demo' })
    );

    expect(() =>
      execFileSync(
        'npx',
        ['tsx', 'src/cli/index.ts', 'analyze', workDir, '--draft', '--write'],
        { encoding: 'utf-8' }
      )
    ).toThrow(/already exists/);
  });

  it('analyze --write without --draft fails', () => {
    expect(() =>
      execFileSync(
        'npx',
        ['tsx', 'src/cli/index.ts', 'analyze', workDir, '--write'],
        { encoding: 'utf-8' }
      )
    ).toThrow(/--write requires --draft/);
  });

  it('suggest --generate-missing fails without ANTHROPIC_API_KEY', () => {
    const file = join(workDir, 'CLAUDE.md');
    writeFileSync(file, '# Project\n\n## Overview\n\nHi.\n');
    writeFileSync(
      join(workDir, 'package.json'),
      JSON.stringify({ name: 'gen-missing' })
    );

    expect(() =>
      execFileSync(
        'npx',
        [
          'tsx',
          'src/cli/index.ts',
          'suggest',
          file,
          '--generate-missing',
        ],
        {
          encoding: 'utf-8',
          env: { ...process.env, ANTHROPIC_API_KEY: '' },
        }
      )
    ).toThrow();
  });

  it('lint --ai fails without ANTHROPIC_API_KEY when there are violations', () => {
    const file = join(workDir, 'CLAUDE.md');
    // Minimal content that triggers structure/content warnings
    writeFileSync(file, '# Tiny\n\nHello.\n');

    expect(() =>
      execFileSync(
        'npx',
        ['tsx', 'src/cli/index.ts', 'lint', file, '--ai', '--plain'],
        {
          encoding: 'utf-8',
          env: { ...process.env, ANTHROPIC_API_KEY: '' },
        }
      )
    ).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('lint --fix --ai fails without ANTHROPIC_API_KEY for unfixed violations', () => {
    const file = join(workDir, 'CLAUDE.md');
    // Structure/content findings typically lack static auto-fixes
    writeFileSync(file, '# Tiny\n\nHello.\n');

    expect(() =>
      execFileSync(
        'npx',
        ['tsx', 'src/cli/index.ts', 'lint', file, '--fix', '--ai', '--plain'],
        {
          encoding: 'utf-8',
          env: { ...process.env, ANTHROPIC_API_KEY: '' },
        }
      )
    ).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('AI commands refuse when ai.enabled is false', () => {
    writeFileSync(
      join(workDir, '.cclintrc.json'),
      JSON.stringify({ ai: { enabled: false } })
    );
    const file = join(workDir, 'CLAUDE.md');
    writeFileSync(file, '# Project\n\n## Overview\n\nHi.\n');
    const cliEntry = join(process.cwd(), 'src/cli/index.ts');

    expect(() =>
      execFileSync('npx', ['tsx', cliEntry, 'suggest', file], {
        encoding: 'utf-8',
        cwd: workDir,
        env: { ...process.env, ANTHROPIC_API_KEY: 'sk-test' },
      })
    ).toThrow(/ai\.enabled: false/);
  });

  it('suggest --provider ollama does not require ANTHROPIC_API_KEY', () => {
    const file = join(workDir, 'CLAUDE.md');
    writeFileSync(file, '# Project\n\n## Overview\n\nHi.\n');

    let message = '';
    try {
      execFileSync(
        'npx',
        [
          'tsx',
          'src/cli/index.ts',
          'suggest',
          file,
          '--provider',
          'ollama',
        ],
        {
          encoding: 'utf-8',
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: '',
            // Closed port → connection error (not a missing Anthropic key)
            OLLAMA_HOST: 'http://127.0.0.1:9',
          },
        }
      );
      expect.fail('expected suggest --provider ollama to fail');
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }

    expect(message).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(message.length).toBeGreaterThan(0);
  });
});
