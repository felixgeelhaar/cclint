import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createPack,
  installPack,
  listPacks,
  loadPackConfig,
  resolveInstalledPackConfig,
  sanitizePackDirName,
} from '../../../src/infrastructure/PackLoader.js';
import { ConfigLoader } from '../../../src/infrastructure/ConfigLoader.js';

describe('PackLoader', () => {
  let workDir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-pack-'));
    process.chdir(workDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  it('sanitizes scoped names into a single directory segment', () => {
    expect(sanitizePackDirName('@acme/strict')).toBe('@acme__strict');
    expect(() => sanitizePackDirName('../evil')).toThrow(/unsafe/);
  });

  it('scaffolds a pack directory', () => {
    const root = createPack('my-rules');
    expect(existsSync(join(root, 'pack.json'))).toBe(true);
    expect(existsSync(join(root, 'config.json'))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(root, 'pack.json'), 'utf8'));
    expect(manifest.name).toBe('my-rules');
    expect(loadPackConfig(root).rules?.['file-size']?.enabled).toBe(true);
  });

  it('installs a path pack into .cclint/packs and resolves it', () => {
    const created = createPack('team-rules');
    const dest = installPack(created, workDir);
    expect(dest).toBeTruthy();
    expect(existsSync(join(workDir, '.cclint', 'packs', 'team-rules', 'pack.json'))).toBe(
      true
    );

    const cfg = resolveInstalledPackConfig('team-rules', workDir);
    expect(cfg?.rules?.['file-size']?.severity).toBe('warning');
  });

  it('treats built-in preset install as a no-op', () => {
    expect(installPack('@cclint/strict', workDir)).toBeNull();
  });

  it('lists built-ins and installed packs', () => {
    createPack('local-pack');
    installPack(join(workDir, 'local-pack'), workDir);
    const list = listPacks(workDir);
    expect(list.some(p => p.name === '@cclint/recommended' && p.source === 'builtin')).toBe(
      true
    );
    expect(list.some(p => p.name === 'local-pack' && p.source === 'installed')).toBe(
      true
    );
  });

  it('ConfigLoader extends resolves an installed pack', () => {
    const created = createPack('proj-pack');
    // Tighten file-size to error so we can assert merge.
    writeFileSync(
      join(created, 'config.json'),
      JSON.stringify({
        rules: { 'file-size': { enabled: true, severity: 'error' } },
      })
    );
    installPack(created, workDir);
    writeFileSync(
      join(workDir, '.cclintrc.json'),
      JSON.stringify({ extends: 'proj-pack' })
    );

    const config = ConfigLoader.load(workDir);
    expect(config.rules['file-size']?.severity).toBe('error');
  });

  it('prefers built-in presets over a same-named installed pack', () => {
    mkdirSync(join(workDir, '.cclint', 'packs', '@cclint__strict'), {
      recursive: true,
    });
    writeFileSync(
      join(workDir, '.cclint', 'packs', '@cclint__strict', 'pack.json'),
      JSON.stringify({ name: '@cclint/strict', version: '9.9.9' })
    );
    writeFileSync(
      join(workDir, '.cclint', 'packs', '@cclint__strict', 'config.json'),
      JSON.stringify({
        rules: { 'file-size': { enabled: false, severity: 'info' } },
      })
    );
    writeFileSync(
      join(workDir, '.cclintrc.json'),
      JSON.stringify({ extends: '@cclint/strict' })
    );

    const config = ConfigLoader.load(workDir);
    // Built-in strict keeps file-size as error, not the fake installed pack.
    expect(config.rules['file-size']?.severity).toBe('error');
    expect(config.rules['file-size']?.enabled).toBe(true);
  });
});
