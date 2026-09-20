import picomatch from 'picomatch';
import { basename, relative, sep } from 'path';

export interface IgnoreMatchOptions {
  /** Project root used to compute relative paths for glob matching. */
  projectRoot?: string;
}

/**
 * Whether `filePath` should be skipped per the config `ignore` list.
 *
 * @remarks
 * Patterns are matched as globs (via picomatch) against:
 * 1. the absolute path,
 * 2. the path relative to `projectRoot` (when provided), and
 * 3. the basename (so `*.backup.md` works).
 *
 * For backward compatibility, a plain fragment with no glob metacharacters
 * also matches via `path.includes(fragment)` (e.g. `node_modules/`).
 */
export function shouldIgnorePath(
  filePath: string,
  patterns: readonly string[] | undefined,
  options: IgnoreMatchOptions = {}
): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  const normalizedAbs = normalizeSlashes(filePath);
  const base = basename(filePath);
  const rel =
    options.projectRoot !== undefined
      ? normalizeSlashes(relative(options.projectRoot, filePath))
      : undefined;

  return patterns.some(pattern => {
    if (pattern.length === 0) {
      return false;
    }

    if (isGlobPattern(pattern)) {
      const matcher = picomatch(pattern, { dot: true });
      if (matcher(normalizedAbs) || matcher(base)) {
        return true;
      }
      if (rel !== undefined && rel !== '' && !rel.startsWith('..')) {
        if (matcher(rel) || matcher(`./${rel}`)) {
          return true;
        }
      }
      return false;
    }

    // Plain path fragment — historical Action/CLI behaviour.
    return filePath.includes(pattern);
  });
}

function normalizeSlashes(p: string): string {
  return sep === '\\' ? p.replace(/\\/g, '/') : p;
}

/** True when the pattern uses common glob metacharacters. */
function isGlobPattern(pattern: string): boolean {
  return /[*?[\]{}]/.test(pattern);
}
