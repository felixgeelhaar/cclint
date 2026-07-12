/**
 * Domain policy for context-file content limits.
 *
 * These caps are a domain invariant: no matter which adapter supplies the
 * content (CLI, the GitHub Action, and the MCP server all read through the
 * `FileReader` adapter), a `ContextFile` may never hold pathologically large
 * content.
 * Enforcing them here — on already-provided in-memory content — keeps every
 * entrypoint protected without pulling file-reading concerns into the domain.
 */

/** Maximum allowed content length in characters (~10 MB). */
export const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;

/**
 * Maximum allowed length of a single line. Very long lines are a common
 * ReDoS / resource-exhaustion vector for the rule engine's regexes.
 */
export const MAX_LINE_LENGTH = 10000;

/**
 * Enforce the content-size and line-length invariants.
 *
 * @param content The full file content
 * @param path A label for error messages (logical or on-disk path)
 * @param lines Optional pre-split lines to avoid re-splitting the content
 * @throws Error if the content exceeds {@link MAX_CONTENT_LENGTH} or any line
 *   exceeds {@link MAX_LINE_LENGTH}
 */
export function assertWithinContentLimits(
  content: string,
  path: string,
  lines?: readonly string[]
): void {
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(
      `File ${path} exceeds maximum size of ${MAX_CONTENT_LENGTH} characters`
    );
  }

  const effectiveLines = lines ?? content.split('\n');
  for (let i = 0; i < effectiveLines.length; i++) {
    if (effectiveLines[i]!.length > MAX_LINE_LENGTH) {
      throw new Error(
        `File ${path} has line ${i + 1} exceeding ${MAX_LINE_LENGTH} characters`
      );
    }
  }
}
