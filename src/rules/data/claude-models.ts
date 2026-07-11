/**
 * Single source of truth for Claude model knowledge used by lint rules.
 *
 * @remarks
 * Model knowledge drifts as Anthropic ships new versions. Rather than pin an
 * exhaustive, quickly-stale allow-list of exact ids, this module prefers
 * *shape validation* (does the id look like a real Claude model?) plus a soft
 * advisory that asks the user to verify against the current model list. That
 * way a brand-new version (e.g. a future `claude-opus-4-9`) is accepted
 * without a code change, while obviously-wrong ids are still flagged.
 *
 * When re-verifying, check Anthropic's model docs and bump {@link LAST_VERIFIED}:
 * https://docs.anthropic.com/en/docs/about-claude/models/overview
 *
 * @category Rules
 */

/**
 * Date this model knowledge was last checked against Anthropic's model list.
 *
 * @remarks
 * A freshness test asserts this exists so future maintainers are prompted to
 * re-verify the families/aliases below rather than trusting them indefinitely.
 */
export const LAST_VERIFIED = '2026-07-11';

/** Current Claude model families (as of {@link LAST_VERIFIED}). */
export const MODEL_FAMILIES = ['opus', 'sonnet', 'haiku', 'fable'] as const;

export type ModelFamily = (typeof MODEL_FAMILIES)[number];

/**
 * Bare aliases accepted in subagent frontmatter `model:` fields.
 *
 * @remarks
 * Every family doubles as a bare alias, plus `inherit` (use the parent
 * session's model).
 */
export const MODEL_ALIASES = [...MODEL_FAMILIES, 'inherit'] as const;

/**
 * Shape validation for fully-qualified model ids, e.g. `claude-opus-4-8`,
 * `claude-sonnet-5`. Intentionally shape-based rather than an exhaustive list
 * so new versions drift in gracefully.
 */
export const MODEL_SHAPE_PATTERN =
  /^claude-(opus|sonnet|haiku|fable)-\d+(-\d+)?$/;

/**
 * Extended shape that also tolerates an optional publish-date suffix
 * (`-20251001`) and a `-latest` alias suffix, both of which appear in
 * Anthropic's public model ids.
 */
export const MODEL_SHAPE_PATTERN_EXTENDED =
  /^claude-(opus|sonnet|haiku|fable)-\d+(-\d+)?(-\d{8})?(-latest)?$/;

/**
 * Legacy Claude 3.x ids — still valid identifiers but deprecated by Anthropic.
 */
export const LEGACY_MODEL_PATTERN = /^claude-3(-\d)?-(sonnet|haiku|opus)/;

/**
 * A small set of currently-recommended model ids, used only for advisory
 * messages. This is NOT an allow-list — keep it short and current.
 */
export const RECOMMENDED_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-haiku-4-5',
] as const;

/** Human-readable list of {@link RECOMMENDED_MODELS} for advisory strings. */
export const RECOMMENDED_MODELS_TEXT = RECOMMENDED_MODELS.join(', ');

/** True if `model` is a recognized bare alias (case-insensitive). */
export function isModelAlias(model: string): boolean {
  return (MODEL_ALIASES as readonly string[]).includes(model.toLowerCase());
}

/**
 * True if `model` looks like a valid fully-qualified Claude model id,
 * including optional date/`-latest` suffixes.
 */
export function isKnownModelShape(model: string): boolean {
  return MODEL_SHAPE_PATTERN_EXTENDED.test(model.toLowerCase());
}

/** True if `model` is a deprecated Claude 3.x identifier. */
export function isLegacyModel(model: string): boolean {
  return LEGACY_MODEL_PATTERN.test(model.toLowerCase());
}
