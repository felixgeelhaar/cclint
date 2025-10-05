#!/usr/bin/env node

import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { RulesEngine } from '../domain/RulesEngine.js';
import { ContextFile } from '../domain/ContextFile.js';
import { ConfigLoader } from '../infrastructure/ConfigLoader.js';
import { FileSizeRule } from '../rules/FileSizeRule.js';
import { StructureRule } from '../rules/StructureRule.js';
import { ContentOrganizationRule } from '../rules/ContentOrganizationRule.js';
import { FormatRule } from '../rules/FormatRule.js';
import { ImportSyntaxRule } from '../rules/ImportSyntaxRule.js';
import { FileLocationRule } from '../rules/FileLocationRule.js';
import { ImportResolutionRule } from '../rules/ImportResolutionRule.js';
import { ContentAppropriatenessRule } from '../rules/ContentAppropriatenessRule.js';
import { MonorepoHierarchyRule } from '../rules/MonorepoHierarchyRule.js';
import { CommandSafetyRule } from '../rules/CommandSafetyRule.js';
import { Severity } from '../domain/Severity.js';
import { Location } from '../domain/Location.js';

async function run(): Promise<void> {
  try {
    // Get inputs
    const filesPattern = core.getInput('files') || 'CLAUDE.md';
    const format = core.getInput('format') || 'text';
    const maxSize = parseInt(core.getInput('max-size') || '10000', 10);
    const failOnError = core.getInput('fail-on-error') === 'true';
    const configFile = core.getInput('config-file');

    // Load configuration
    const config = configFile
      ? ConfigLoader.load(configFile)
      : ConfigLoader.load();

    // Find files to lint
    const globber = await glob.create(filesPattern);
    const files = await globber.glob();

    if (files.length === 0) {
      core.warning(`No files found matching pattern: ${filesPattern}`);
      return;
    }

    // Set up rules engine
    const rules = [];

    if (config.rules['file-size']?.enabled) {
      rules.push(
        new FileSizeRule(config.rules['file-size'].options?.maxSize ?? maxSize)
      );
    }
    if (config.rules['structure']?.enabled) {
      rules.push(new StructureRule());
    }
    // Support both 'content' (backward compat) and 'content-organization' (new)
    const contentEnabled = config.rules['content']?.enabled ?? false;
    const contentOrgEnabled =
      config.rules['content-organization']?.enabled ?? false;
    if (contentEnabled || contentOrgEnabled) {
      rules.push(new ContentOrganizationRule());
    }
    if (config.rules['format']?.enabled) {
      rules.push(new FormatRule());
    }
    // New rules (v0.5.0+) - enabled by default
    if (config.rules['import-syntax']?.enabled !== false) {
      const importOptions = config.rules['import-syntax']?.options ?? {};
      const maxDepth =
        typeof importOptions['maxDepth'] === 'number'
          ? importOptions['maxDepth']
          : undefined;
      rules.push(new ImportSyntaxRule(maxDepth));
    }
    if (config.rules['file-location']?.enabled !== false) {
      rules.push(new FileLocationRule());
    }
    // New rules (v0.6.0+) - 10/10 Anthropic alignment
    if (config.rules['import-resolution']?.enabled !== false) {
      const importResOptions = config.rules['import-resolution']?.options ?? {};
      const maxDepth =
        typeof importResOptions['maxDepth'] === 'number'
          ? importResOptions['maxDepth']
          : undefined;
      rules.push(new ImportResolutionRule(maxDepth));
    }
    if (config.rules['content-appropriateness']?.enabled !== false) {
      const contentAppOptions =
        config.rules['content-appropriateness']?.options ?? {};
      rules.push(new ContentAppropriatenessRule(contentAppOptions));
    }
    if (config.rules['monorepo-hierarchy']?.enabled !== false) {
      rules.push(new MonorepoHierarchyRule());
    }
    if (config.rules['command-safety']?.enabled !== false) {
      rules.push(new CommandSafetyRule());
    }

    const rulesEngine = new RulesEngine(rules);
    let totalErrors = 0;
    let totalWarnings = 0;
    const allResults: Array<{
      file: string;
      violations: Array<{
        rule: string;
        message: string;
        severity: Severity;
        location: Location;
      }>;
      summary: { errors: number; warnings: number; total: number };
    }> = [];

    // Lint each file
    for (const filePath of files) {
      // Check if file should be ignored
      if (config.ignore?.some(pattern => filePath.includes(pattern))) {
        continue;
      }

      try {
        const contextFile = ContextFile.fromFile(filePath);
        const result = rulesEngine.lint(contextFile);

        const errors = result.violations.filter(
          v => v.severity === Severity.ERROR
        ).length;
        const warnings = result.violations.filter(
          v => v.severity === Severity.WARNING
        ).length;

        totalErrors += errors;
        totalWarnings += warnings;

        if (format === 'json') {
          allResults.push({
            file: filePath,
            violations: result.violations.map(v => ({
              rule: v.ruleId,
              message: v.message,
              severity: v.severity,
              location: v.location,
            })),
            summary: {
              errors,
              warnings,
              total: result.violations.length,
            },
          });
        } else {
          // Text output
          if (result.violations.length > 0) {
            core.info(`📝 Linting results for ${filePath}:`);
            for (const violation of result.violations) {
              const icon =
                violation.severity === Severity.ERROR
                  ? '❌'
                  : violation.severity === Severity.WARNING
                    ? '⚠️'
                    : 'ℹ️';
              const message = `${icon} ${violation.severity.toString()}: ${violation.message} at ${violation.location.line}:${violation.location.column} [${violation.ruleId}]`;

              if (violation.severity === Severity.ERROR) {
                core.error(message);
              } else if (violation.severity === Severity.WARNING) {
                core.warning(message);
              } else {
                core.info(message);
              }
            }
            core.info(`Summary: ${errors} errors, ${warnings} warnings`);
          } else {
            core.info(`✅ ${filePath}: No issues found`);
          }
        }
      } catch (error) {
        const message = `Failed to lint ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
        core.error(message);
        totalErrors++;
      }
    }

    // Set outputs
    if (format === 'json') {
      core.setOutput('results', JSON.stringify(allResults, null, 2));
    }
    core.setOutput('error-count', totalErrors.toString());
    core.setOutput('warning-count', totalWarnings.toString());

    // Summary
    if (totalErrors > 0 || totalWarnings > 0) {
      core.info(
        `\n📊 Total: ${totalErrors} errors, ${totalWarnings} warnings across ${files.length} files`
      );
    } else {
      core.info(`\n✅ All ${files.length} files passed linting`);
    }

    // Fail if errors found and fail-on-error is true
    if (totalErrors > 0 && failOnError) {
      core.setFailed(`Found ${totalErrors} errors`);
    }
  } catch (error) {
    core.setFailed(
      `Action failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

void run();
