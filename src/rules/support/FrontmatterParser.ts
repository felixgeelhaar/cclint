/**
 * Shared YAML-frontmatter parser for Markdown-based Claude Code config files
 * (skills, subagents, …).
 *
 * @remarks
 * This is a deliberately small, dependency-free parser that understands the
 * subset of YAML frontmatter that Claude Code config files use in practice:
 * a `---`…`---` fenced block containing `key: value` scalars, dash lists, and
 * inline `[a, b]` arrays. It is a pure domain module — it takes the already
 * split `lines` of a file and returns a typed {@link Frontmatter} view. It
 * performs no file or network IO.
 *
 * It intentionally handles the edge cases that the previous per-rule
 * hand-rolled parsers disagreed on: quoted values that contain colons, `#`
 * comments (full-line and trailing), multiline dash arrays, inline bracket
 * arrays, and CRLF line endings.
 */

/** A parsed frontmatter value: either a scalar string or a list of strings. */
type FrontmatterEntry = string | readonly string[];

/**
 * Immutable, typed view over a parsed frontmatter block.
 *
 * Accessor methods interpret the stored raw values so callers never touch
 * quoting, bracket, or comment syntax directly.
 */
export class Frontmatter {
  private readonly fields: ReadonlyMap<string, FrontmatterEntry>;

  /** Whether the document contained at least one `---` fence line. */
  public readonly hasFence: boolean;

  public constructor(
    fields: ReadonlyMap<string, FrontmatterEntry>,
    hasFence: boolean
  ) {
    this.fields = fields;
    this.hasFence = hasFence;
  }

  /** Whether a key was present in the frontmatter (even with an empty value). */
  public has(key: string): boolean {
    return this.fields.has(key);
  }

  /**
   * The scalar value for `key`, with surrounding quotes stripped.
   *
   * Returns `undefined` if the key is absent or was parsed as an array.
   * An empty value (`key:` with nothing after it) returns an empty string.
   */
  public getString(key: string): string | undefined {
    const value = this.fields.get(key);
    if (typeof value !== 'string') {
      return undefined;
    }
    return stripQuotes(value);
  }

  /**
   * The value for `key` interpreted as a list of strings.
   *
   * Handles all three array shapes:
   * - a multiline dash list (`- item`),
   * - an inline bracket array (`[a, b, c]`),
   * - a bare comma-separated scalar (`a, b`).
   *
   * Returns `undefined` if the key is absent. Quotes are stripped and empty
   * items are dropped.
   */
  public getStringArray(key: string): string[] | undefined {
    const value = this.fields.get(key);
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== 'string') {
      return value
        .map(item => stripQuotes(item))
        .filter(item => item.length > 0);
    }

    const scalar = value.trim().replace(/^\[|\]$/g, '');
    return scalar
      .split(',')
      .map(item => stripQuotes(item.trim()))
      .filter(item => item.length > 0);
  }

  /**
   * The value for `key` interpreted as a boolean.
   *
   * Only the literal string `true` is truthy; anything else (including an
   * absent key) is `false`.
   */
  public getBoolean(key: string): boolean {
    return this.getString(key) === 'true';
  }
}

/**
 * Parse the frontmatter block out of a file's already split lines.
 *
 * @param lines - File content split on `\n` (as produced by `ContextFile`).
 * @returns A typed {@link Frontmatter} view; `hasFence` is `false` when no
 *   `---` delimiter is present.
 */
export class FrontmatterParser {
  public static parse(lines: string[]): Frontmatter {
    const fields = new Map<string, FrontmatterEntry>();
    let hasFence = false;
    let inFrontmatter = false;

    // Accumulators for the key currently being built.
    let currentKey: string | null = null;
    let currentScalar = '';
    let currentArray: string[] | null = null;

    const flush = (): void => {
      if (currentKey === null) {
        return;
      }
      fields.set(currentKey, currentArray ?? currentScalar);
      currentKey = null;
      currentScalar = '';
      currentArray = null;
    };

    for (const line of lines) {
      // `trim` also removes a trailing `\r`, so CRLF files parse correctly.
      const trimmed = line.trim();

      if (trimmed === '---') {
        hasFence = true;
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        }
        // Closing fence: finalize the last key and stop.
        flush();
        break;
      }

      if (!inFrontmatter) {
        continue;
      }

      // Full-line comment.
      if (trimmed.startsWith('#')) {
        continue;
      }

      // Blank line: not a continuation, just skip it.
      if (trimmed === '') {
        continue;
      }

      // Dash list item (belongs to the current key).
      if (trimmed.startsWith('-')) {
        if (currentKey !== null) {
          const item = stripInlineComment(trimmed.slice(1)).trim();
          currentArray ??= [];
          if (item.length > 0) {
            currentArray.push(item);
          }
        }
        continue;
      }

      // A new `key: value` line. The key must start at column 0 (no leading
      // whitespace) — indented lines are handled as items/continuations above.
      // No `$` anchor: `.` does not match `\r`, so anchoring to end-of-string
      // would fail on CRLF lines. The unmatched trailing `\r` is trimmed off
      // the captured value below.
      const keyMatch = /^(\w+):\s*(.*)/.exec(line);
      if (keyMatch) {
        flush();
        currentKey = keyMatch[1] ?? '';
        const valuePart = stripInlineComment(keyMatch[2] ?? '').trim();

        if (valuePart.startsWith('-')) {
          // Inline first array item: `key: - item`.
          currentArray = [];
          const item = valuePart.slice(1).trim();
          if (item.length > 0) {
            currentArray.push(item);
          }
        } else {
          currentScalar = valuePart;
        }
        continue;
      }

      // Continuation of a scalar value wrapped onto an indented line.
      if (currentKey !== null && currentArray === null) {
        const continuation = stripInlineComment(line).trim();
        if (continuation.length > 0) {
          currentScalar =
            currentScalar.length > 0
              ? `${currentScalar} ${continuation}`
              : continuation;
        }
      }
    }

    return new Frontmatter(fields, hasFence);
  }
}

/**
 * Remove a trailing `#` comment from a value, honoring quotes.
 *
 * A `#` starts a comment only when it is at the start of the string or
 * preceded by whitespace and is not inside a quoted span — matching YAML's
 * comment rule and avoiding false positives like `color#1` or `16:9#tag`.
 */
function stripInlineComment(value: string): string {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      const prev = value[i - 1];
      if (i === 0 || (prev !== undefined && /\s/.test(prev))) {
        return value.slice(0, i);
      }
    }
  }

  return value;
}

/**
 * Strip a single matching pair of surrounding quotes from a scalar.
 *
 * Only outer quotes are removed, so colons and other characters inside a
 * quoted value are preserved.
 */
function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}
