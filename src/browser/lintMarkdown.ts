import { ContextFile } from '../domain/ContextFile.js';
import { RulesEngine } from '../domain/RulesEngine.js';
import {
  buildSeverityOverrides,
  defaultConfig,
  type CclintConfig,
} from '../domain/Config.js';
import { createBrowserRules } from '../rules/registry/browserRuleDescriptors.js';

/** Plain violation shape safe to serialize across the playground UI. */
export interface BrowserViolation {
  ruleId: string;
  message: string;
  severity: string;
  line: number;
  column: number;
}

export interface LintMarkdownResult {
  violations: BrowserViolation[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

/**
 * Lint markdown content in-memory with the browser-safe rule set.
 *
 * @remarks
 * Uses {@link defaultConfig} (or an optional override). Filesystem-dependent
 * rules (`import-resolution`, `monorepo-hierarchy`, `agents-md`) are omitted.
 */
export function lintMarkdown(
  content: string,
  options: { path?: string; config?: CclintConfig } = {}
): LintMarkdownResult {
  const path = options.path ?? 'CLAUDE.md';
  const config = options.config ?? defaultConfig;
  const file = new ContextFile(path, content);
  const engine = new RulesEngine(
    createBrowserRules(config),
    buildSeverityOverrides(config)
  );
  const result = engine.lint(file);
  const violations: BrowserViolation[] = result.violations.map(v => ({
    ruleId: v.ruleId,
    message: v.message,
    severity: v.severity.name,
    line: v.location.line,
    column: v.location.column,
  }));

  return {
    violations,
    errorCount: result.getErrorCount(),
    warningCount: result.getWarningCount(),
    infoCount: result.getInfoCount(),
  };
}
