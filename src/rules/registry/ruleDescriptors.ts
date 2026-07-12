import type { Rule } from '../../domain/Rule.js';
import type { CclintConfig } from '../../domain/Config.js';
import { RULE_METADATA, type RuleMetadata } from './ruleMetadata.js';

import { FileSizeRule } from '../FileSizeRule.js';
import { StructureRule } from '../StructureRule.js';
import { ContentOrganizationRule } from '../ContentOrganizationRule.js';
import { FormatRule } from '../FormatRule.js';
import { CodeBlockRule } from '../CodeBlockRule.js';
import { ImportSyntaxRule } from '../ImportSyntaxRule.js';
import { FileLocationRule } from '../FileLocationRule.js';
import { ImportResolutionRule } from '../ImportResolutionRule.js';
import { ContentAppropriatenessRule } from '../ContentAppropriatenessRule.js';
import { MonorepoHierarchyRule } from '../MonorepoHierarchyRule.js';
import { CommandSafetyRule } from '../CommandSafetyRule.js';
import { SkillStructureRule } from '../SkillStructureRule.js';
import { SubagentStructureRule } from '../SubagentStructureRule.js';
import { HookConfigurationRule } from '../HookConfigurationRule.js';
import { KarpathyRule } from '../KarpathyRule.js';

/**
 * The single canonical description of a built-in rule.
 *
 * @remarks
 * Before this existed, adding a rule meant editing ~7 unrelated places:
 * every construction site (CLI `lint`, `watch`, `why`, the MCP server, the
 * GitHub Action), the `defaultConfig` enabled flags, the per-id metadata
 * table, and a hardcoded class-name allow-list in the registry. A descriptor
 * co-locates all of that so a new rule is added in exactly one place and every
 * entry point stays in lock-step (see {@link createRules}).
 */
export interface RuleDescriptor {
  /** Stable rule id, matching `Rule.id` and the metadata key. */
  readonly id: string;
  /**
   * Whether the rule runs when a config does not mention it at all.
   *
   * @remarks
   * Encodes the historical per-rule default: core rules present in
   * `defaultConfig` (file-size, structure, format, …) were gated on an
   * explicit `enabled` flag (default off when the key is absent), whereas the
   * later opt-out rules ran unless explicitly disabled (default on).
   */
  readonly defaultEnabled: boolean;
  /** Documentation/tooling metadata for `explain`, `why`, and SARIF output. */
  readonly metadata: RuleMetadata;
  /** Construct the rule, wiring per-rule options out of the resolved config. */
  create(config: CclintConfig): Rule;
  /**
   * Optional bespoke enabled-resolution for rules that cannot be expressed by
   * the standard `config.rules[id].enabled ?? defaultEnabled` rule — e.g. a
   * backward-compatible config alias.
   */
  isEnabled?(config: CclintConfig): boolean;
}

/** Read a numeric option in a type-safe way, falling back when absent. */
function numberOption(
  options: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = options?.[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * All built-in rule descriptors, in execution order.
 *
 * @remarks
 * The order here is the order violations are produced by every entry point, so
 * keep it stable. This array is the one place to touch when adding, removing,
 * or reconfiguring a built-in rule.
 */
export const RULE_DESCRIPTORS: readonly RuleDescriptor[] = [
  {
    id: 'file-size',
    defaultEnabled: false,
    metadata: RULE_METADATA['file-size']!,
    create: config =>
      new FileSizeRule(config.rules['file-size']?.options?.maxSize ?? 10000),
  },
  {
    id: 'structure',
    defaultEnabled: false,
    metadata: RULE_METADATA['structure']!,
    create: config =>
      new StructureRule(config.rules['structure']?.options?.requiredSections),
  },
  {
    id: 'content-organization',
    defaultEnabled: false,
    metadata: RULE_METADATA['content-organization']!,
    // Backward compat: the legacy `content` key and the current
    // `content-organization` key both drive the same rule.
    isEnabled: config =>
      (config.rules['content']?.enabled ?? false) ||
      (config.rules['content-organization']?.enabled ?? false),
    create: () => new ContentOrganizationRule(),
  },
  {
    id: 'format',
    defaultEnabled: false,
    metadata: RULE_METADATA['format']!,
    create: () => new FormatRule(),
  },
  {
    id: 'code-blocks',
    defaultEnabled: true,
    metadata: RULE_METADATA['code-blocks']!,
    create: config =>
      new CodeBlockRule(config.rules['code-blocks']?.options ?? {}),
  },
  {
    id: 'import-syntax',
    defaultEnabled: true,
    metadata: RULE_METADATA['import-syntax']!,
    create: config =>
      new ImportSyntaxRule(
        numberOption(config.rules['import-syntax']?.options, 'maxDepth')
      ),
  },
  {
    id: 'file-location',
    defaultEnabled: true,
    metadata: RULE_METADATA['file-location']!,
    create: () => new FileLocationRule(),
  },
  {
    id: 'import-resolution',
    defaultEnabled: true,
    metadata: RULE_METADATA['import-resolution']!,
    create: config =>
      new ImportResolutionRule(
        numberOption(config.rules['import-resolution']?.options, 'maxDepth')
      ),
  },
  {
    id: 'content-appropriateness',
    defaultEnabled: true,
    metadata: RULE_METADATA['content-appropriateness']!,
    create: config =>
      new ContentAppropriatenessRule(
        config.rules['content-appropriateness']?.options ?? {}
      ),
  },
  {
    id: 'monorepo-hierarchy',
    defaultEnabled: true,
    metadata: RULE_METADATA['monorepo-hierarchy']!,
    create: () => new MonorepoHierarchyRule(),
  },
  {
    id: 'command-safety',
    defaultEnabled: true,
    metadata: RULE_METADATA['command-safety']!,
    create: () => new CommandSafetyRule(),
  },
  {
    id: 'skill-structure',
    defaultEnabled: true,
    metadata: RULE_METADATA['skill-structure']!,
    create: config =>
      new SkillStructureRule(config.rules['skill-structure']?.options ?? {}),
  },
  {
    id: 'subagent-structure',
    defaultEnabled: true,
    metadata: RULE_METADATA['subagent-structure']!,
    create: config =>
      new SubagentStructureRule(
        config.rules['subagent-structure']?.options ?? {}
      ),
  },
  {
    id: 'hook-configuration',
    defaultEnabled: true,
    metadata: RULE_METADATA['hook-configuration']!,
    create: config =>
      new HookConfigurationRule(
        config.rules['hook-configuration']?.options ?? {}
      ),
  },
  {
    id: 'karpathy',
    defaultEnabled: true,
    metadata: RULE_METADATA['karpathy']!,
    create: () => new KarpathyRule(),
  },
];

/** Resolve whether a descriptor's rule is enabled under the given config. */
export function isRuleEnabled(
  descriptor: RuleDescriptor,
  config: CclintConfig
): boolean {
  if (descriptor.isEnabled) {
    return descriptor.isEnabled(config);
  }
  return config.rules[descriptor.id]?.enabled ?? descriptor.defaultEnabled;
}

/** The set of built-in rule ids, derived from the descriptor list. */
export function getBuiltinRuleIds(): Set<string> {
  return new Set(RULE_DESCRIPTORS.map(descriptor => descriptor.id));
}
