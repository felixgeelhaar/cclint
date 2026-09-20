import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

const AT_START = new Location(1, 1);

/**
 * Phrases that read as hard enforcement in CLAUDE.md / AGENTS.md.
 * Claude Code treats memory as context, not a policy engine — hard blocks
 * belong in PreToolUse hooks / permissions.
 */
const ENFORCEMENT_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\byou must\b/i, label: 'YOU MUST' },
  { re: /\bmust never\b/i, label: 'must never' },
  { re: /\bnever\s+(?:run|execute|delete|commit|push|write|edit)\b/i, label: 'never <action>' },
  { re: /\balways\s+(?:run|execute|use|prefer)\b/i, label: 'always <action>' },
  { re: /\bdo not\s+(?:ever\s+)?(?:run|execute|delete|commit|push)\b/i, label: 'do not <action>' },
  { re: /\bIMPORTANT:?\b/, label: 'IMPORTANT' },
];

/**
 * Suggests hooks/permissions when instruction files use hard-enforcement language.
 *
 * @remarks
 * Anthropic: CLAUDE.md is context, not enforced configuration. To block an
 * action regardless of what Claude decides, use a PreToolUse hook (or
 * permissions.deny). This rule is advisory (INFO).
 */
export class EnforcementHintRule implements Rule {
  public readonly id = 'enforcement-hint';
  public readonly description =
    'Suggests hooks/permissions when instructions use hard-enforcement language';

  public appliesTo(file: ContextFile): boolean {
    return file.isProjectInstructionFile();
  }

  public lint(file: ContextFile): Violation[] {
    if (!this.appliesTo(file)) {
      return [];
    }

    const hits = new Set<string>();
    let inFence = false;

    for (const line of file.lines) {
      if (/^```/.test(line.trimStart())) {
        inFence = !inFence;
        continue;
      }
      if (inFence) {
        continue;
      }
      for (const { re, label } of ENFORCEMENT_PATTERNS) {
        if (re.test(line)) {
          hits.add(label);
        }
      }
    }

    if (hits.size === 0) {
      return [];
    }

    const listed = [...hits].slice(0, 4).join(', ');
    return [
      new Violation(
        this.id,
        `Hard-enforcement language detected (${listed}). CLAUDE.md / AGENTS.md are context, not a policy engine — for actions that must never happen, add a PreToolUse hook or permissions.deny in .claude/settings.json.`,
        Severity.INFO,
        AT_START
      ),
    ];
  }
}
