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
import { ContentAppropriatenessRule } from '../ContentAppropriatenessRule.js';
import { CommandSafetyRule } from '../CommandSafetyRule.js';
import { SkillStructureRule } from '../SkillStructureRule.js';
import { SubagentStructureRule } from '../SubagentStructureRule.js';
import { HookConfigurationRule } from '../HookConfigurationRule.js';
import { KarpathyRule } from '../KarpathyRule.js';
import { SecretDetectionRule } from '../SecretDetectionRule.js';
import { PluginManifestRule } from '../PluginManifestRule.js';
import { McpConfigRule } from '../McpConfigRule.js';
import { OutputStyleRule } from '../OutputStyleRule.js';
import { ClaudeRulesRule } from '../ClaudeRulesRule.js';
import { ImportContextCostRule } from '../ImportContextCostRule.js';
import { EnforcementHintRule } from '../EnforcementHintRule.js';

/** Local copy of RuleDescriptor to avoid importing the full Node rule graph. */
interface BrowserRuleDescriptor {
  readonly id: string;
  readonly defaultEnabled: boolean;
  readonly metadata: RuleMetadata;
  create(config: CclintConfig): Rule;
  isEnabled?(config: CclintConfig): boolean;
}

function numberOption(
  options: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = options?.[key];
  return typeof value === 'number' ? value : undefined;
}

function isEnabled(
  descriptor: BrowserRuleDescriptor,
  config: CclintConfig
): boolean {
  if (descriptor.isEnabled) {
    return descriptor.isEnabled(config);
  }
  return config.rules[descriptor.id]?.enabled ?? descriptor.defaultEnabled;
}

export const BROWSER_RULE_DESCRIPTORS: readonly BrowserRuleDescriptor[] = [
  {
    id: 'file-size',
    defaultEnabled: false,
    metadata: RULE_METADATA['file-size']!,
    create: config =>
      new FileSizeRule({
        maxSize:
          numberOption(config.rules['file-size']?.options, 'maxSize') ?? 10000,
        maxLines:
          numberOption(config.rules['file-size']?.options, 'maxLines') ?? 200,
      }),
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
    id: 'content-appropriateness',
    defaultEnabled: true,
    metadata: RULE_METADATA['content-appropriateness']!,
    create: config =>
      new ContentAppropriatenessRule(
        config.rules['content-appropriateness']?.options ?? {}
      ),
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
  {
    id: 'secret-detection',
    defaultEnabled: true,
    metadata: RULE_METADATA['secret-detection']!,
    create: () => new SecretDetectionRule(),
  },
  {
    id: 'plugin-manifest',
    defaultEnabled: true,
    metadata: RULE_METADATA['plugin-manifest']!,
    create: () => new PluginManifestRule(),
  },
  {
    id: 'mcp-config',
    defaultEnabled: true,
    metadata: RULE_METADATA['mcp-config']!,
    create: () => new McpConfigRule(),
  },
  {
    id: 'output-style',
    defaultEnabled: true,
    metadata: RULE_METADATA['output-style']!,
    create: () => new OutputStyleRule(),
  },
  {
    id: 'claude-rules',
    defaultEnabled: true,
    metadata: RULE_METADATA['claude-rules']!,
    create: () => new ClaudeRulesRule(),
  },
  {
    id: 'import-context-cost',
    defaultEnabled: true,
    metadata: RULE_METADATA['import-context-cost']!,
    create: config =>
      new ImportContextCostRule({
        softImportCount:
          numberOption(
            config.rules['import-context-cost']?.options,
            'softImportCount'
          ) ?? 5,
      }),
  },
  {
    id: 'enforcement-hint',
    defaultEnabled: true,
    metadata: RULE_METADATA['enforcement-hint']!,
    create: () => new EnforcementHintRule(),
  },
];

/** Construct browser-safe built-in rules for a resolved config. */
export function createBrowserRules(config: CclintConfig): Rule[] {
  return BROWSER_RULE_DESCRIPTORS.filter(descriptor =>
    isEnabled(descriptor, config)
  ).map(descriptor => descriptor.create(config));
}
