import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

/**
 * A single credential-shape matcher: a human-readable {@link kind} plus a
 * global {@link pattern} whose whole match is the candidate secret token.
 */
interface SecretPattern {
  readonly kind: string;
  readonly pattern: RegExp;
  /**
   * When true, a match is always a finding (e.g. a PRIVATE KEY block header),
   * bypassing the placeholder heuristics that guard high-variety token shapes.
   */
  readonly alwaysReport?: boolean;
}

/**
 * SecretDetectionRule — flags credentials pasted into CLAUDE.md.
 *
 * @remarks
 * Committing a live API key into a context file is one of the most damaging
 * authoring mistakes: CLAUDE.md is routinely shared, versioned, and fed to
 * models, so a leaked key propagates widely. This rule detects the common
 * provider key shapes (OpenAI, Anthropic, GitHub, AWS, Google, Slack), PEM
 * private-key blocks, and a high-entropy heuristic for
 * `KEY=`/`TOKEN=`/`SECRET=`/`PASSWORD=` assignments.
 *
 * Findings are ERROR severity. Messages name the kind of secret and mask the
 * value (first four characters + `…`) so the linter never re-echoes the
 * credential it is warning about.
 *
 * Scope: Markdown files only ({@link appliesTo}). Both prose and fenced code
 * blocks are scanned — a pasted key is equally dangerous in either.
 */
export class SecretDetectionRule implements Rule {
  public readonly id = 'secret-detection';
  public readonly description =
    'Detects likely API keys, tokens, and private keys committed to CLAUDE.md';

  /**
   * Ordered so more specific prefixes win before generic ones (Anthropic
   * `sk-ant-` and OpenAI `sk-proj-` are matched before the classic OpenAI
   * `sk-` shape). Hyphens in the specific prefixes already prevent the classic
   * pattern from matching them, but the ordering keeps the intent explicit.
   */
  private static readonly PATTERNS: readonly SecretPattern[] = [
    {
      kind: 'Anthropic API key',
      pattern: /(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9-]{16,}/g,
    },
    {
      kind: 'OpenAI API key',
      pattern: /(?<![A-Za-z0-9])sk-proj-[A-Za-z0-9_-]{16,}/g,
    },
    {
      kind: 'OpenAI API key',
      pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/g,
    },
    {
      kind: 'GitHub token',
      pattern: /(?<![A-Za-z0-9])gh[opsu]_[A-Za-z0-9]{36,}/g,
    },
    {
      kind: 'GitHub fine-grained token',
      pattern: /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{22,}/g,
    },
    {
      kind: 'AWS access key',
      pattern: /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![0-9A-Z])/g,
    },
    {
      kind: 'Google API key',
      pattern: /(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])/g,
    },
    {
      kind: 'Slack token',
      pattern: /(?<![A-Za-z0-9])xox[baprs]-[A-Za-z0-9-]{10,}/g,
    },
    {
      kind: 'private key',
      pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
      alwaysReport: true,
    },
  ];

  /** Substrings that mark a value as an obvious placeholder, not a secret. */
  private static readonly PLACEHOLDER_TOKENS: readonly string[] = [
    'example',
    'placeholder',
    'redacted',
    'changeme',
    'dummy',
    'sample',
    'your',
    'here',
    'todo',
    'fake',
    'xxxx',
    'xxx',
    'notreal',
    'replaceme',
  ];

  /**
   * Env-style assignment keys that indicate a secret value is being set. The
   * identifier is required to be upper-snake-case (e.g. `API_TOKEN`,
   * `SECRET_KEY`) so ordinary prose like "here is a token: …" is not mistaken
   * for an assignment.
   */
  private static readonly ASSIGNMENT_KEY =
    /(?<![A-Za-z0-9_])([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*[:=]\s*['"]?([^\s'"]+)['"]?/g;

  private static readonly MIN_ENTROPY_LENGTH = 20;
  private static readonly MIN_DISTINCT_CHARS = 8;
  private static readonly MIN_ENTROPY_BITS = 3.5;

  public appliesTo(file: ContextFile): boolean {
    return file.isMarkdown();
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];

    file.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      this.collectPatternMatches(line, lineNumber, violations);
      this.collectEntropyMatches(line, lineNumber, violations);
    });

    return violations;
  }

  /** Match the known credential shapes on a single line. */
  private collectPatternMatches(
    line: string,
    lineNumber: number,
    out: Violation[]
  ): void {
    for (const {
      kind,
      pattern,
      alwaysReport,
    } of SecretDetectionRule.PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const token = match[0];
        if (alwaysReport || !SecretDetectionRule.looksLikePlaceholder(token)) {
          out.push(this.violation(kind, token, lineNumber, match.index + 1));
        }
      }
    }
  }

  /**
   * Heuristic pass: a `KEY=`/`TOKEN=`/`SECRET=`/`PASSWORD=` assignment whose
   * value is long, high-entropy, and mixed is very likely a real secret even
   * when it carries no recognizable provider prefix.
   */
  private collectEntropyMatches(
    line: string,
    lineNumber: number,
    out: Violation[]
  ): void {
    const pattern = SecretDetectionRule.ASSIGNMENT_KEY;
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      const value = match[2];
      if (value === undefined) {
        continue;
      }
      if (SecretDetectionRule.matchesKnownPattern(value)) {
        // Already reported by the prefix pass; avoid a duplicate finding.
        continue;
      }
      if (!SecretDetectionRule.isHighEntropySecret(value)) {
        continue;
      }
      const valueColumn = match.index + match[0].indexOf(value) + 1;
      out.push(
        this.violation('high-entropy secret', value, lineNumber, valueColumn)
      );
    }
  }

  private violation(
    kind: string,
    secret: string,
    line: number,
    column: number
  ): Violation {
    return new Violation(
      this.id,
      `Possible ${kind} ('${SecretDetectionRule.mask(secret)}') committed to ` +
        `a context file at line ${line}. Remove it and rotate the credential.`,
      Severity.ERROR,
      new Location(line, column)
    );
  }

  /** Show only the first four characters, then an ellipsis. */
  private static mask(secret: string): string {
    return `${secret.slice(0, 4)}…`;
  }

  private static looksLikePlaceholder(secret: string): boolean {
    const lower = secret.toLowerCase();
    if (SecretDetectionRule.PLACEHOLDER_TOKENS.some(t => lower.includes(t))) {
      return true;
    }
    if (/[<>{}()$]/.test(secret)) {
      return true;
    }
    // Real credentials are high-variety; a handful of distinct characters
    // means a repeated filler like `sk-xxxx…` or `AKIAAAAA…`.
    return SecretDetectionRule.distinctChars(secret) < 5;
  }

  private static matchesKnownPattern(value: string): boolean {
    return SecretDetectionRule.PATTERNS.some(({ pattern }) => {
      pattern.lastIndex = 0;
      return pattern.test(value);
    });
  }

  private static isHighEntropySecret(value: string): boolean {
    if (value.length < SecretDetectionRule.MIN_ENTROPY_LENGTH) {
      return false;
    }
    // Secret-shaped tokens only: base64/hex-ish charset, no path/URL punctuation.
    if (!/^[A-Za-z0-9+/_=.-]+$/.test(value)) {
      return false;
    }
    // Require a letter/digit mix so prose words and pure numbers don't trip it.
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      return false;
    }
    if (SecretDetectionRule.looksLikePlaceholder(value)) {
      return false;
    }
    if (
      SecretDetectionRule.distinctChars(value) <
      SecretDetectionRule.MIN_DISTINCT_CHARS
    ) {
      return false;
    }
    return (
      SecretDetectionRule.shannonEntropy(value) >=
      SecretDetectionRule.MIN_ENTROPY_BITS
    );
  }

  private static distinctChars(value: string): number {
    return new Set(value).size;
  }

  private static shannonEntropy(value: string): number {
    const frequencies = new Map<string, number>();
    for (const char of value) {
      frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
    }
    let entropy = 0;
    for (const count of frequencies.values()) {
      const probability = count / value.length;
      entropy -= probability * Math.log2(probability);
    }
    return entropy;
  }
}
