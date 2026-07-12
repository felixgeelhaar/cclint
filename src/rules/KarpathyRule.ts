import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

/**
 * KarpathyRule — opinionated CLAUDE.md quality advisories.
 *
 * Heuristics inspired by Andrej Karpathy's public commentary on writing for
 * LLMs and "context engineering": you program the model in English, so the
 * context window should be minimal, high signal-to-noise, literal, and
 * example-driven. This is a curated, opinionated ruleset — not an official
 * standard — and every finding is INFO severity (a recommendation, not a
 * failure).
 *
 * Checks:
 *  1. Hedging language ("try to", "where appropriate") that makes an
 *     instruction non-literal — the model follows instructions literally, so
 *     ambiguity invites drift.
 *  2. Filler / politeness ("please", "thank you", "you are a helpful
 *     assistant") that spends context tokens without adding signal.
 *  3. Show, don't tell — guideline sections that list many rules but include
 *     no concrete example (few-shot beats zero-shot).
 *  4. Signal-to-noise — overly long prose paragraphs; prefer tight,
 *     skimmable lines or bullets.
 *
 * Scope: CLAUDE.md files only. Code fences are excluded from prose checks.
 */
export class KarpathyRule implements Rule {
  public readonly id = 'karpathy';
  public readonly description =
    'Opinionated CLAUDE.md recommendations inspired by Karpathy: minimal, ' +
    'high-signal, literal, example-driven context';

  private static readonly HEDGING_PHRASES = [
    'try to',
    'where appropriate',
    'as appropriate',
    'where possible',
    'when possible',
    'if possible',
    'as needed',
    'as necessary',
    'generally',
    'usually',
    'typically',
    'ideally',
    'more or less',
    'and so on',
  ];

  private static readonly FILLER_PHRASES = [
    'please',
    'kindly',
    'thank you',
    'feel free to',
    'it is important to note',
    'it should be noted',
    'as a reminder',
    'needless to say',
    'you are a helpful assistant',
    'as an ai language model',
  ];

  private static readonly GUIDELINE_WORDS = [
    'convention',
    'guideline',
    'rule',
    'standard',
    'style',
    'instruction',
    'workflow',
    'practice',
    'principle',
  ];

  private static readonly MAX_PARAGRAPH_WORDS = 80;
  private static readonly MAX_PARAGRAPH_CHARS = 600;

  public appliesTo(file: ContextFile): boolean {
    return file.isClaudeMarkdown();
  }

  public lint(file: ContextFile): Violation[] {
    if (!KarpathyRule.isClaudeMd(file.path)) {
      return [];
    }

    const lines = file.lines;
    const inCode = KarpathyRule.markCodeFences(lines);

    return [
      ...this.checkPhrases(
        lines,
        inCode,
        KarpathyRule.HEDGING_PHRASES,
        phrase =>
          `Hedging phrase "${phrase}" weakens a literal instruction. ` +
          `State the rule directly so the model follows it deterministically.`
      ),
      ...this.checkPhrases(
        lines,
        inCode,
        KarpathyRule.FILLER_PHRASES,
        phrase =>
          `Filler/politeness "${phrase}" spends context without signal. ` +
          `Drop it — CLAUDE.md is instructions for a model, not prose for a person.`
      ),
      ...this.checkExamples(lines, inCode),
      ...this.checkParagraphs(lines, inCode),
    ];
  }

  private static isClaudeMd(path: string): boolean {
    return /(^|[/\\])CLAUDE\.md$/i.test(path);
  }

  /** Returns a boolean per line: true when the line sits inside a ``` fence. */
  private static markCodeFences(lines: string[]): boolean[] {
    const inCode: boolean[] = lines.map(() => false);
    let open = false;
    for (let i = 0; i < lines.length; i++) {
      const isFence = /^\s*```/.test(lines[i] ?? '');
      if (isFence) {
        // The fence line itself is treated as code so it is never prose.
        inCode[i] = true;
        open = !open;
        continue;
      }
      inCode[i] = open;
    }
    return inCode;
  }

  private checkPhrases(
    lines: string[],
    inCode: boolean[],
    phrases: string[],
    message: (phrase: string) => string
  ): Violation[] {
    const violations: Violation[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      if (inCode[i]) continue;
      const lower = (lines[i] ?? '').toLowerCase();
      for (const phrase of phrases) {
        if (seen.has(phrase)) continue;
        if (KarpathyRule.containsPhrase(lower, phrase)) {
          seen.add(phrase);
          violations.push(
            new Violation(
              this.id,
              message(phrase),
              Severity.INFO,
              new Location(i + 1, 1)
            )
          );
        }
      }
    }
    return violations;
  }

  private static containsPhrase(
    haystackLower: string,
    phrase: string
  ): boolean {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystackLower);
  }

  /**
   * Flag guideline-style sections (Conventions, Guidelines, Rules, …) that
   * enumerate several rules but show no concrete example — show, don't tell.
   */
  private checkExamples(lines: string[], inCode: boolean[]): Violation[] {
    const violations: Violation[] = [];
    const headings = KarpathyRule.collectSections(lines);

    for (const section of headings) {
      const titleLower = section.title.toLowerCase();
      const isGuideline = KarpathyRule.GUIDELINE_WORDS.some(w =>
        new RegExp(`\\b${w}`, 'i').test(titleLower)
      );
      if (!isGuideline) continue;

      let bullets = 0;
      let hasCode = false;
      for (let i = section.bodyStart; i < section.bodyEnd; i++) {
        if (inCode[i]) {
          hasCode = true;
          continue;
        }
        if (/^\s*([-*]|\d+\.)\s+/.test(lines[i] ?? '')) bullets++;
      }

      if (bullets >= 4 && !hasCode) {
        violations.push(
          new Violation(
            this.id,
            `Section "${section.title}" lists ${bullets} rules but shows no ` +
              `example. Add a concrete example (show, don't tell) — few-shot ` +
              `context steers the model better than abstract rules.`,
            Severity.INFO,
            new Location(section.headingLine, 1)
          )
        );
      }
    }
    return violations;
  }

  private static collectSections(lines: string[]): Array<{
    title: string;
    headingLine: number; // 1-based
    bodyStart: number; // 0-based inclusive
    bodyEnd: number; // 0-based exclusive
  }> {
    const sections: Array<{
      title: string;
      headingLine: number;
      bodyStart: number;
      bodyEnd: number;
    }> = [];
    const headingIdx: Array<{ idx: number; title: string }> = [];
    const inCode = KarpathyRule.markCodeFences(lines);

    for (let i = 0; i < lines.length; i++) {
      if (inCode[i]) continue;
      const m = /^#{1,6}\s+(.*)$/.exec(lines[i] ?? '');
      if (m) headingIdx.push({ idx: i, title: (m[1] ?? '').trim() });
    }

    for (let h = 0; h < headingIdx.length; h++) {
      const cur = headingIdx[h];
      if (!cur) continue;
      const next = headingIdx[h + 1];
      const end = next ? next.idx : lines.length;
      sections.push({
        title: cur.title,
        headingLine: cur.idx + 1,
        bodyStart: cur.idx + 1,
        bodyEnd: end,
      });
    }
    return sections;
  }

  /** Flag prose paragraphs that are too long to skim. */
  private checkParagraphs(lines: string[], inCode: boolean[]): Violation[] {
    const violations: Violation[] = [];
    let buffer: string[] = [];
    let startLine = 0;

    const flush = (): void => {
      if (buffer.length === 0) return;
      const text = buffer.join(' ').trim();
      const words = text.split(/\s+/).filter(Boolean).length;
      if (
        words > KarpathyRule.MAX_PARAGRAPH_WORDS ||
        text.length > KarpathyRule.MAX_PARAGRAPH_CHARS
      ) {
        violations.push(
          new Violation(
            this.id,
            `Paragraph is ${words} words. Tighten to high-signal lines or ` +
              `bullets — dense prose buries the instruction.`,
            Severity.INFO,
            new Location(startLine, 1)
          )
        );
      }
      buffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const isProse =
        !inCode[i] &&
        line.trim() !== '' &&
        !/^#{1,6}\s+/.test(line) &&
        !/^\s*([-*]|\d+\.)\s+/.test(line) &&
        !/^\s*>/.test(line) &&
        !/^\s*\|/.test(line);
      if (isProse) {
        if (buffer.length === 0) startLine = i + 1;
        buffer.push(line.trim());
      } else {
        flush();
      }
    }
    flush();
    return violations;
  }
}
