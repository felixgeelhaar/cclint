import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, join, resolve } from 'path';
import { execFileSync } from 'child_process';
import { getPreset, getPresetNames, type PresetConfig } from '../domain/presets.js';

export interface PackManifest {
  name: string;
  version: string;
  description?: string;
  /** Relative path to the pack config JSON (default `config.json`). */
  config?: string;
}

export interface PackListEntry {
  name: string;
  version: string;
  source: 'builtin' | 'installed';
  path?: string;
  description?: string;
}

const PACKS_SUBDIR = join('.cclint', 'packs');

/** Directory that holds installed packs under a project root. */
export function packsDir(projectRoot: string = process.cwd()): string {
  return resolve(projectRoot, PACKS_SUBDIR);
}

/**
 * Sanitize a pack name into a single directory segment.
 * Allows `@scope/name` → `@scope__name`; rejects traversal and empty names.
 */
export function sanitizePackDirName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('pack name must not be empty');
  }
  if (trimmed.includes('..') || trimmed.includes('\\')) {
    throw new Error(`unsafe pack name: ${name}`);
  }
  if (!/^[@a-zA-Z0-9._/-]+$/.test(trimmed)) {
    throw new Error(
      `invalid pack name "${name}": use letters, digits, @/_./- only`
    );
  }
  return trimmed.replace(/\//g, '__');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Read and validate a pack.json from a pack directory. */
export function readPackManifest(packRoot: string): PackManifest {
  const manifestPath = join(packRoot, 'pack.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`missing pack.json in ${packRoot}`);
  }
  const manifest = readJsonFile<PackManifest>(manifestPath);
  if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
    throw new Error(`pack.json in ${packRoot} is missing a valid "name"`);
  }
  if (typeof manifest.version !== 'string' || manifest.version.trim() === '') {
    throw new Error(`pack.json in ${packRoot} is missing a valid "version"`);
  }
  return manifest;
}

/** Load the config partial declared by a pack's manifest. */
export function loadPackConfig(packRoot: string): PresetConfig {
  const manifest = readPackManifest(packRoot);
  const configRel = manifest.config ?? 'config.json';
  if (configRel.includes('..') || configRel.startsWith('/') || configRel.startsWith('\\')) {
    throw new Error(`unsafe pack config path: ${configRel}`);
  }
  const configPath = join(packRoot, configRel);
  if (!existsSync(configPath)) {
    throw new Error(`pack config not found: ${configPath}`);
  }
  return readJsonFile<PresetConfig>(configPath);
}

/**
 * Resolve a named pack config from `.cclint/packs/`, walking up from
 * `startDir`. Built-in presets are handled by {@link getPreset} first.
 */
export function resolveInstalledPackConfig(
  name: string,
  startDir: string = process.cwd()
): PresetConfig | undefined {
  let currentDir = resolve(startDir);
  const dirName = ((): string | null => {
    try {
      return sanitizePackDirName(name);
    } catch {
      return null;
    }
  })();
  if (dirName === null) return undefined;

  while (true) {
    const candidate = join(currentDir, PACKS_SUBDIR, dirName);
    if (existsSync(join(candidate, 'pack.json'))) {
      try {
        return loadPackConfig(candidate);
      } catch {
        return undefined;
      }
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return undefined;
}

/** Built-in + installed packs visible from a project root. */
export function listPacks(projectRoot: string = process.cwd()): PackListEntry[] {
  const entries: PackListEntry[] = getPresetNames().map(name => ({
    name,
    version: 'builtin',
    source: 'builtin' as const,
    description: 'Built-in preset (use via extends)',
  }));

  const installedRoot = packsDir(projectRoot);
  if (!existsSync(installedRoot)) {
    return entries;
  }

  for (const entry of readdirSync(installedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packRoot = join(installedRoot, entry.name);
    try {
      const manifest = readPackManifest(packRoot);
      const installed: PackListEntry = {
        name: manifest.name,
        version: manifest.version,
        source: 'installed',
        path: packRoot,
      };
      if (manifest.description !== undefined) {
        installed.description = manifest.description;
      }
      entries.push(installed);
    } catch {
      // Skip malformed pack directories.
    }
  }

  return entries;
}

/**
 * Scaffold a new pack directory with pack.json, config.json, and README.
 * @returns Absolute path to the created pack root.
 */
export function createPack(
  name: string,
  destParent: string = process.cwd()
): string {
  const dirName = sanitizePackDirName(name);
  const packRoot = resolve(destParent, dirName);
  if (existsSync(packRoot)) {
    throw new Error(`destination already exists: ${packRoot}`);
  }

  mkdirSync(packRoot, { recursive: true });
  const manifest: PackManifest = {
    name,
    version: '0.1.0',
    description: `cclint rule pack: ${name}`,
    config: 'config.json',
  };
  writeFileSync(join(packRoot, 'pack.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(
    join(packRoot, 'config.json'),
    `${JSON.stringify(
      {
        rules: {
          'file-size': { enabled: true, severity: 'warning' },
        },
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(packRoot, 'README.md'),
    `# ${name}\n\nLocal cclint pack. Install with:\n\n\`\`\`bash\ncclint pack install ./${dirName}\n\`\`\`\n\nThen extend it from \`.cclintrc.json\`:\n\n\`\`\`json\n{ "extends": "${name}" }\n\`\`\`\n`
  );
  return packRoot;
}

/**
 * Install a pack from a filesystem path or `.tgz` / `.tar.gz` archive into
 * `.cclint/packs/<name>/`.
 * Built-in preset names are already available via `extends` — install is a no-op tip.
 * @returns Destination path (or `null` when the name is a built-in preset).
 */
export function installPack(
  source: string,
  projectRoot: string = process.cwd()
): string | null {
  if (getPreset(source)) {
    return null;
  }

  const sourceRoot = resolve(projectRoot, source);
  if (!existsSync(sourceRoot)) {
    throw new Error(`pack path not found: ${source}`);
  }

  if (statSync(sourceRoot).isFile() && isPackArchive(sourceRoot)) {
    return installPackFromArchive(sourceRoot, projectRoot);
  }

  return installPackDirectory(sourceRoot, projectRoot);
}

function installPackDirectory(
  sourceRoot: string,
  projectRoot: string
): string {
  const manifest = readPackManifest(sourceRoot);
  // Ensure config is loadable before copying.
  loadPackConfig(sourceRoot);

  const destDir = join(packsDir(projectRoot), sanitizePackDirName(manifest.name));
  mkdirSync(dirname(destDir), { recursive: true });
  cpSync(sourceRoot, destDir, { recursive: true, force: true });
  return destDir;
}

/** True when the path looks like a published cclint pack archive. */
export function isPackArchive(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith('.cclint-pack.tgz') ||
    lower.endsWith('.tgz') ||
    lower.endsWith('.tar.gz')
  );
}

function assertSafeTarEntries(archivePath: string): void {
  const listing = execFileSync('tar', ['-tzf', archivePath], {
    encoding: 'utf8',
  });
  for (const entry of listing.split('\n')) {
    const name = entry.trim();
    if (name.length === 0) continue;
    if (name.startsWith('/') || name.includes('..')) {
      throw new Error(`refusing to extract unsafe archive entry: ${name}`);
    }
  }
}

/**
 * Extract a published pack archive and install it into `.cclint/packs/`.
 */
export function installPackFromArchive(
  archivePath: string,
  projectRoot: string = process.cwd()
): string {
  assertSafeTarEntries(archivePath);
  const extractRoot = mkdtempSync(join(tmpdir(), 'cclint-pack-extract-'));
  try {
    execFileSync('tar', ['-xzf', archivePath, '-C', extractRoot], {
      encoding: 'utf8',
    });
    const packRoot = findExtractedPackRoot(extractRoot);
    return installPackDirectory(packRoot, projectRoot);
  } finally {
    rmSync(extractRoot, { recursive: true, force: true });
  }
}

function findExtractedPackRoot(extractRoot: string): string {
  if (existsSync(join(extractRoot, 'pack.json'))) {
    return extractRoot;
  }
  const kids = readdirSync(extractRoot, { withFileTypes: true }).filter(d =>
    d.isDirectory()
  );
  if (kids.length === 1) {
    const candidate = join(extractRoot, kids[0]!.name);
    if (existsSync(join(candidate, 'pack.json'))) {
      return candidate;
    }
  }
  throw new Error(
    `archive does not contain a pack.json at the root (or a single pack directory)`
  );
}

/**
 * Package a pack directory into a portable `.cclint-pack.tgz` archive.
 * @returns Absolute path to the written archive.
 */
export function publishPack(
  source: string,
  options: { projectRoot?: string; outDir?: string } = {}
): string {
  const projectRoot = options.projectRoot ?? process.cwd();
  const sourceRoot = resolve(projectRoot, source);
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new Error(`pack directory not found: ${source}`);
  }

  const manifest = readPackManifest(sourceRoot);
  loadPackConfig(sourceRoot);

  const outDir = resolve(projectRoot, options.outDir ?? '.');
  mkdirSync(outDir, { recursive: true });
  const fileName = `${sanitizePackDirName(manifest.name)}-${manifest.version}.cclint-pack.tgz`;
  const outPath = join(outDir, fileName);

  // Create a single top-level directory in the tarball named after the pack.
  const stageParent = mkdtempSync(join(tmpdir(), 'cclint-pack-publish-'));
  const stageDir = join(stageParent, sanitizePackDirName(manifest.name));
  try {
    cpSync(sourceRoot, stageDir, { recursive: true });
    execFileSync(
      'tar',
      ['-czf', outPath, '-C', stageParent, basename(stageDir)],
      { encoding: 'utf8' }
    );
  } finally {
    rmSync(stageParent, { recursive: true, force: true });
  }

  return outPath;
}

/** Display name helper for installed directory basenames. */
export function packDirBasename(packRoot: string): string {
  return basename(packRoot);
}
