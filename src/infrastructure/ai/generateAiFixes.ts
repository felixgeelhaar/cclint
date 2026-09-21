import { Location } from '../../domain/Location.js';
import type { Fix } from '../../domain/AutoFix.js';
import type { Violation } from '../../domain/Violation.js';
import {
  completeAiText,
  type ResolvedAiOptions,
} from './anthropicClient.js';

export interface AiFixRequestOptions {
  ai: ResolvedAiOptions;
  file: string;
  content: string;
  violation: Violation;
  rationale?: string;
}

interface ParsedAiFix {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
  description: string;
}

/**
 * Ask the configured AI provider for a structured single-edit fix and validate
 * it against the file. Returns null when the response is unusable or out of range.
 */
export async function generateAiFixForViolation(
  options: AiFixRequestOptions
): Promise<Fix | null> {
  const lines = options.content.split('\n');
  const lineNo = options.violation.location.line;
  const offendingLine = lines[lineNo - 1] ?? '';
  const contextStart = Math.max(1, lineNo - 2);
  const contextEnd = Math.min(lines.length, lineNo + 2);
  const context = lines
    .slice(contextStart - 1, contextEnd)
    .map((l, i) => `${contextStart + i}|${l}`)
    .join('\n');

  const raw = await completeAiText({
    ...options.ai,
    prompt: `You are applying a precise edit to fix a CLAUDE.md linter violation.

Rule: ${options.violation.ruleId}
Rationale: ${options.rationale ?? ''}
Violation: ${options.violation.message}
File: ${options.file}
Offending line ${lineNo}: ${offendingLine}

Nearby lines (line|text):
${context}

Respond with ONLY a JSON object (no markdown fences, no commentary) of this shape:
{"startLine":<1-based>,"startColumn":<1-based>,"endLine":<1-based>,"endColumn":<1-based exclusive or past last char>,"text":"<replacement>","description":"<short>"}

The range replaces characters from start (inclusive) through end (exclusive of endColumn on endLine). Prefer replacing a single whole line when reasonable. Keep the edit minimal.`,
  });

  const parsed = parseAiFixJson(raw);
  if (!parsed) {
    return null;
  }

  return validateAndBuildFix(parsed, lines);
}

/**
 * Generate AI fixes for violations that have no static auto-fix yet.
 */
export async function generateAiFixesForUnfixed(options: {
  ai: ResolvedAiOptions;
  file: string;
  content: string;
  unfixed: Violation[];
  rationaleFor: (ruleId: string) => string | undefined;
  limit?: number;
}): Promise<Fix[]> {
  const limit = options.limit ?? 5;
  const selected = options.unfixed.slice(0, limit);
  const fixes: Fix[] = [];

  for (const violation of selected) {
    try {
      const req: AiFixRequestOptions = {
        ai: options.ai,
        file: options.file,
        content: options.content,
        violation,
      };
      const rationale = options.rationaleFor(violation.ruleId);
      if (rationale !== undefined) req.rationale = rationale;

      const fix = await generateAiFixForViolation(req);
      if (fix) {
        fixes.push(fix);
      }
    } catch {
      // Skip failed AI fix attempts; static path / remaining violations stay.
    }
  }

  return fixes;
}

/** Exported for unit tests. */
export function parseAiFixJson(raw: string): ParsedAiFix | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    text = fence[1].trim();
  }

  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const startLine = num(obj['startLine']);
    const startColumn = num(obj['startColumn']);
    const endLine = num(obj['endLine']);
    const endColumn = num(obj['endColumn']);
    const replacement = obj['text'];
    const description = obj['description'];

    if (
      startLine === null ||
      startColumn === null ||
      endLine === null ||
      endColumn === null ||
      typeof replacement !== 'string' ||
      typeof description !== 'string' ||
      description.trim() === ''
    ) {
      return null;
    }

    return {
      startLine,
      startColumn,
      endLine,
      endColumn,
      text: replacement,
      description: description.trim(),
    };
  } catch {
    return null;
  }
}

/** Exported for unit tests. */
export function validateAndBuildFix(
  parsed: ParsedAiFix,
  lines: string[]
): Fix | null {
  const { startLine, startColumn, endLine, endColumn, text, description } =
    parsed;

  if (
    startLine < 1 ||
    endLine < 1 ||
    startLine > lines.length ||
    endLine > lines.length ||
    startColumn < 1 ||
    endColumn < 1 ||
    endLine < startLine
  ) {
    return null;
  }

  if (startLine === endLine && endColumn < startColumn) {
    return null;
  }

  const startLineText = lines[startLine - 1] ?? '';
  const endLineText = lines[endLine - 1] ?? '';
  // Allow endColumn to be length+1 (past last character) for whole-line replace.
  if (startColumn > startLineText.length + 1) {
    return null;
  }
  if (endColumn > endLineText.length + 1) {
    return null;
  }

  return {
    range: {
      start: new Location(startLine, startColumn),
      end: new Location(endLine, endColumn),
    },
    text,
    description: `[ai] ${description}`,
  };
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}
