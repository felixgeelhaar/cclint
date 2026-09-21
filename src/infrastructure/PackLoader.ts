import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join, resolve } from 'path';
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
 * Install a pack from a filesystem path into `.cclint/packs/<name>/`.
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

  const manifest = readPackManifest(sourceRoot);
  // Ensure config is loadable before copying.
  loadPackConfig(sourceRoot);

  const destDir = join(packsDir(projectRoot), sanitizePackDirName(manifest.name));
  mkdirSync(dirname(destDir), { recursive: true });
  if (existsSync(destDir)) {
    // Replace existing install of the same pack name.
    cpSync(sourceRoot, destDir, { recursive: true, force: true });
  } else {
    cpSync(sourceRoot, destDir, { recursive: true });
  }
  return destDir;
}

/** Display name helper for installed directory basenames. */
export function packDirBasename(packRoot: string): string {
  return basename(packRoot);
}
