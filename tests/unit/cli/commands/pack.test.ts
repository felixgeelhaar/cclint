import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { packCommand } from '../../../../src/cli/commands/pack.js';

describe('cclint pack CLI', () => {
  let workDir: string;
  const originalCwd = process.cwd();
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-pack-cli-'));
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
    await packCommand.parseAsync(args, { from: 'user' });
  }

  it('create scaffolds a pack and install wires it under .cclint/packs', async () => {
    await run('create', 'demo-pack');
    expect(existsSync(join(workDir, 'demo-pack', 'pack.json'))).toBe(true);

    await run('install', './demo-pack');
    expect(
      existsSync(join(workDir, '.cclint', 'packs', 'demo-pack', 'pack.json'))
    ).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Add to .cclintrc.json')
    );
  });

  it('install of a built-in preset prints guidance', async () => {
    await run('install', '@cclint/minimal');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('built-in preset')
    );
  });

  it('list includes builtins', async () => {
    await run('list');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('@cclint/recommended@builtin')
    );
  });

  it('create fails on unsafe names', async () => {
    await expect(run('create', '../evil')).rejects.toThrow('process.exit:1');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('unsafe'));
  });
});
