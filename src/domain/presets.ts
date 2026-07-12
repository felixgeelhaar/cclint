import type { CclintConfig } from './Config.js';

/**
 * Built-in configuration presets.
 *
 * @remarks
 * A preset is a named, partial {@link CclintConfig} that teams can pull in via
 * `"extends": "@cclint/recommended"` (or an array) instead of hand-writing rule
 * config. Presets are pure data — they carry no discovery, merge, or filesystem
 * concerns. The {@link ConfigLoader} adapter is responsible for resolving an
 * `extends` list into these partials and layering them between the built-in
 * defaults and the user's own config (defaults ← preset(s) ← user).
 *
 * Only named, built-in presets are supported. There is intentionally no
 * file-path or npm-package resolution, so nested/self/cyclic `extends` cannot
 * occur — a preset never itself extends another.
 */

/** Canonical name of the recommended preset. */
export const RECOMMENDED_PRESET_NAME = '@cclint/recommended';

/** Canonical name of the strict preset. */
export const STRICT_PRESET_NAME = '@cclint/strict';

/** A preset is a reusable, partial configuration layered under user config. */
export type PresetConfig = Partial<CclintConfig>;

/**
 * `@cclint/recommended` — the sensible baseline.
 *
 * @remarks
 * Mirrors cclint's out-of-the-box posture: the historically curated core rules
 * run as warnings (with `format` as an error), while the later opt-out rules
 * keep their own descriptor defaults. Extending this preset is a no-op relative
 * to running with no config at all; its value is being explicit and
 * self-documenting so a team config can start from a named, stable baseline.
 */
const recommended: PresetConfig = {
  rules: {
    'file-size': {
      enabled: true,
      severity: 'warning',
      options: { maxSize: 10000 },
    },
    structure: { enabled: true, severity: 'warning' },
    content: { enabled: true, severity: 'warning' },
    format: { enabled: true, severity: 'error' },
    'code-blocks': { enabled: true, severity: 'warning' },
    'skill-structure': { enabled: true, severity: 'error' },
    'subagent-structure': { enabled: true, severity: 'error' },
    'hook-configuration': { enabled: true, severity: 'warning' },
  },
};

/**
 * `@cclint/strict` — zero-tolerance posture for teams that gate CI on cclint.
 *
 * @remarks
 * Every built-in rule is enabled and every violation is promoted to `error`, so
 * any finding fails the run. The list enumerates all built-in rule ids so newly
 * added rules are surfaced explicitly rather than silently inheriting their
 * per-rule default; a test guards this against drift.
 */
const strict: PresetConfig = {
  rules: {
    'file-size': {
      enabled: true,
      severity: 'error',
      options: { maxSize: 10000 },
    },
    structure: { enabled: true, severity: 'error' },
    'content-organization': { enabled: true, severity: 'error' },
    format: { enabled: true, severity: 'error' },
    'code-blocks': { enabled: true, severity: 'error' },
    'import-syntax': { enabled: true, severity: 'error' },
    'file-location': { enabled: true, severity: 'error' },
    'import-resolution': { enabled: true, severity: 'error' },
    'content-appropriateness': { enabled: true, severity: 'error' },
    'monorepo-hierarchy': { enabled: true, severity: 'error' },
    'command-safety': { enabled: true, severity: 'error' },
    'skill-structure': { enabled: true, severity: 'error' },
    'subagent-structure': { enabled: true, severity: 'error' },
    'hook-configuration': { enabled: true, severity: 'error' },
    karpathy: { enabled: true, severity: 'error' },
    'secret-detection': { enabled: true, severity: 'error' },
  },
};

/** Registry of built-in presets keyed by their canonical name. */
export const PRESETS: Readonly<Record<string, PresetConfig>> = {
  [RECOMMENDED_PRESET_NAME]: recommended,
  [STRICT_PRESET_NAME]: strict,
};

/**
 * Look up a built-in preset by name.
 *
 * @returns The preset partial, or `undefined` if the name is not a built-in
 * preset (callers decide how to surface the unknown-preset case).
 */
export function getPreset(name: string): PresetConfig | undefined {
  return PRESETS[name];
}

/** The set of known built-in preset names. */
export function getPresetNames(): string[] {
  return Object.keys(PRESETS);
}
