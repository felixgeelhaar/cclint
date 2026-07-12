import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * Directory names that discovery never descends into.
 *
 * @remarks
 * These hold generated output, VCS metadata, or tooling scratch space — none of
 * which contain first-party Claude Code config worth linting, and some of which
 * (e.g. `node_modules`) are large enough to make an unfiltered walk slow.
 */
export const IGNORED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.stryker-tmp',
]);

/** Path split into segments relative to the discovery root, e.g. `['.claude', 'agents', 'x.md']`. */
type PathSegments = readonly string[];

/**
 * One recognisable Claude Code config-file shape. Kept as an explicit,
 * self-describing list so the set of files cclint understands is easy to read
 * and extend in one place.
 */
interface ConfigFilePattern {
  /** Human-readable pattern, mirroring the glob it stands in for. */
  readonly label: string;
  /** Whether a file (given its root-relative segments) matches this pattern. */
  matches(segments: PathSegments): boolean;
}

const isMarkdown = (name: string): boolean => /\.md$/i.test(name);

const basenameOf = (segments: PathSegments): string =>
  segments[segments.length - 1] ?? '';

const parentDirOf = (segments: PathSegments): string | undefined =>
  segments[segments.length - 2];

/**
 * True when `first` then `second` appear as consecutive *ancestor* directories
 * of the file — the runtime equivalent of a `first/second/**` glob prefix.
 */
function hasAncestorDirPair(
  segments: PathSegments,
  first: string,
  second: string
): boolean {
  // Require at least [first, second, filename]; the pair must sit above the
  // file, so stop before the last (filename) segment.
  for (let i = 0; i + 2 < segments.length; i++) {
    if (segments[i] === first && segments[i + 1] === second) {
      return true;
    }
  }
  return false;
}

/**
 * The config files cclint understands, expressed against root-relative path
 * segments. Order is presentational only; a file matches if ANY pattern does.
 */
export const CONFIG_FILE_PATTERNS: readonly ConfigFilePattern[] = [
  {
    label: 'CLAUDE.md (including nested)',
    matches: s => basenameOf(s) === 'CLAUDE.md',
  },
  {
    label: '.claude/skills/**/*.md',
    matches: s =>
      isMarkdown(basenameOf(s)) && hasAncestorDirPair(s, '.claude', 'skills'),
  },
  {
    label: '.claude/agents/**/*.md',
    matches: s =>
      isMarkdown(basenameOf(s)) && hasAncestorDirPair(s, '.claude', 'agents'),
  },
  {
    label: '.claude/output-styles/**/*.md',
    matches: s =>
      isMarkdown(basenameOf(s)) &&
      hasAncestorDirPair(s, '.claude', 'output-styles'),
  },
  {
    label: '.claude/settings.json',
    matches: s =>
      parentDirOf(s) === '.claude' && basenameOf(s) === 'settings.json',
  },
  {
    label: '.claude/settings.local.json',
    matches: s =>
      parentDirOf(s) === '.claude' && basenameOf(s) === 'settings.local.json',
  },
  {
    label: '.mcp.json (including nested)',
    matches: s => basenameOf(s) === '.mcp.json',
  },
  {
    label: '.claude-plugin/plugin.json',
    matches: s =>
      parentDirOf(s) === '.claude-plugin' && basenameOf(s) === 'plugin.json',
  },
  {
    label: 'marketplace.json (including nested)',
    matches: s => basenameOf(s) === 'marketplace.json',
  },
];

/** Whether a file (by its root-relative segments) is a config file cclint lints. */
export function isConfigFile(segments: PathSegments): boolean {
  return CONFIG_FILE_PATTERNS.some(pattern => pattern.matches(segments));
}

/**
 * Walks a project directory and returns the Claude Code config files cclint
 * understands.
 *
 * @remarks
 * Infrastructure-layer adapter: it is the only place directory traversal (`fs`)
 * happens for project-wide linting, keeping the domain and CLI free of I/O
 * concerns. It resolves *what* to lint; reading and linting stay with the
 * existing `FileReader` / `RulesEngine` pipeline.
 */
export class FileDiscovery {
  /**
   * Discover config files under `rootDir`.
   *
   * @param rootDir - Absolute or relative path to the project directory.
   * @returns Absolute file paths, sorted for deterministic output.
   */
  public discover(rootDir: string): string[] {
    const matched: string[] = [];
    this.walk(rootDir, [], matched);
    return matched.sort();
  }

  private walk(
    dir: string,
    relativeSegments: string[],
    matched: string[]
  ): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // An unreadable directory (permissions, race) must not abort the whole
      // walk — skip it and continue discovering the rest of the tree.
      return;
    }

    for (const entry of entries) {
      const childSegments = [...relativeSegments, entry.name];
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        this.walk(fullPath, childSegments, matched);
      } else if (entry.isFile() && isConfigFile(childSegments)) {
        matched.push(fullPath);
      }
      // Symlinks (neither isDirectory nor isFile) are intentionally skipped to
      // avoid traversal loops and to keep discovery to real files.
    }
  }
}
