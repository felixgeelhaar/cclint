/**
 * Backward-compatible re-export.
 *
 * @remarks
 * Rule metadata now lives with the rules it documents in
 * {@link ../rules/registry/ruleMetadata.ts} so the rule set has a single
 * home (see {@link ../rules/registry/ruleDescriptors.ts}). This barrel keeps
 * the historical `infrastructure/RuleMetadata` import path working for the CLI
 * (`explain`, `why`), the SARIF formatter, and the MCP server.
 */
export {
  RULE_METADATA,
  getRuleMetadata,
  getAllRuleIds,
  isValidRule,
} from '../rules/registry/ruleMetadata.js';
export type { RuleMetadata } from '../rules/registry/ruleMetadata.js';
