/**
 * Whether `filePath` should be skipped per the config `ignore` list.
 *
 * @remarks
 * Matching is a **path-fragment / substring** check (same behaviour the GitHub
 * Action has historically used): each pattern is tested with
 * `filePath.includes(pattern)`. This is intentional and documented — it is not
 * glob matching. Prefer fragments like `node_modules/`, `vendor/`, or
 * `CLAUDE.backup.md` rather than `*.backup.md` / `temp/**`.
 */
export function shouldIgnorePath(
  filePath: string,
  patterns: readonly string[] | undefined
): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some(pattern => pattern.length > 0 && filePath.includes(pattern));
}
