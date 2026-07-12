import type { Rule } from '../../domain/Rule.js';
import type { CclintConfig } from '../../domain/Config.js';
import { RULE_DESCRIPTORS, isRuleEnabled } from './ruleDescriptors.js';

/**
 * Build the list of built-in rules for a resolved config.
 *
 * @remarks
 * This is the one place every entry point (CLI `lint`/`watch`/`why`, the MCP
 * server, and the GitHub Action) turns configuration into rule instances, so
 * they can never drift into running different rule sets. Each descriptor
 * decides whether it is enabled ({@link isRuleEnabled}) and wires its own
 * per-rule options ({@link RULE_DESCRIPTORS}).
 *
 * Per-rule severity is applied separately by the engine via
 * `buildSeverityOverrides`, since severity is a reporting concern rather than a
 * construction concern.
 *
 * Custom/plugin rules are intentionally not included here; callers that support
 * plugins append them after the built-ins.
 */
export function createRules(config: CclintConfig): Rule[] {
  return RULE_DESCRIPTORS.filter(descriptor =>
    isRuleEnabled(descriptor, config)
  ).map(descriptor => descriptor.create(config));
}
