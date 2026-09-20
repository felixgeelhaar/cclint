import type { Violation } from '../../domain/Violation.js';
import {
  completeAiText,
  type ResolvedAiOptions,
} from './anthropicClient.js';

export interface SuggestViolationFixOptions {
  ai: ResolvedAiOptions;
  file: string;
  content: string;
  violation: Violation;
  rationale?: string;
}

/**
 * Ask the configured AI provider for a short, actionable fix for one violation.
 */
export async function suggestViolationFix(
  options: SuggestViolationFixOptions
): Promise<string> {
  const offendingLine =
    options.content.split('\n')[options.violation.location.line - 1] ?? '';

  return completeAiText({
    ...options.ai,
    prompt: `You are helping a developer fix a CLAUDE.md linter violation.

Rule: ${options.violation.ruleId}
Rationale: ${options.rationale ?? ''}
Violation message: ${options.violation.message}
File: ${options.file}
Offending line ${options.violation.location.line}: ${offendingLine}

Give a concise (3-6 lines) actionable suggestion. Show a concrete rewrite or fix. Do not restate the rule.`,
  });
}

/**
 * Batch AI suggestions for lint --ai (print-only). Caps cost with a max count.
 */
export async function suggestViolationsForLint(options: {
  ai: ResolvedAiOptions;
  file: string;
  content: string;
  violations: Violation[];
  rationaleFor: (ruleId: string) => string | undefined;
  /** Max violations to explain (default 5). */
  limit?: number;
}): Promise<Array<{ violation: Violation; suggestion: string }>> {
  const limit = options.limit ?? 5;
  const selected = options.violations.slice(0, limit);
  const out: Array<{ violation: Violation; suggestion: string }> = [];

  for (const violation of selected) {
    try {
      const fixOpts: SuggestViolationFixOptions = {
        ai: options.ai,
        file: options.file,
        content: options.content,
        violation,
      };
      const rationale = options.rationaleFor(violation.ruleId);
      if (rationale !== undefined) fixOpts.rationale = rationale;

      const suggestion = await suggestViolationFix(fixOpts);
      out.push({ violation, suggestion });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      out.push({
        violation,
        suggestion: `(unavailable: ${msg})`,
      });
    }
  }

  return out;
}
