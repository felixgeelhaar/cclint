#!/usr/bin/env node

import * as core from '@actions/core';
import * as glob from '@actions/glob';
import { RulesEngine } from '../domain/RulesEngine.js';
import { ContextFile } from '../domain/ContextFile.js';
import { ConfigLoader } from '../infrastructure/ConfigLoader.js';
import { FileSizeRule } from '../rules/FileSizeRule.js';
import { StructureRule } from '../rules/StructureRule.js';
import { ContentRule } from '../rules/ContentRule.js';
import { FormatRule } from '../rules/FormatRule.js';
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
        new FileSizeRule(config.rules['file-size'].options?.maxSize || maxSize)
      );
    }
    if (config.rules['structure']?.enabled) {
      rules.push(new StructureRule());
    }
    if (config.rules['content']?.enabled) {
      rules.push(new ContentRule());
    }
    if (config.rules['format']?.enabled) {
      rules.push(new FormatRule());
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
              const message = `${icon} ${violation.severity}: ${violation.message} at ${violation.location.line}:${violation.location.column} [${violation.ruleId}]`;

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
        const message = `Failed to lint ${filePath}: ${error instanceof Error ? error.message : error}`;
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
      `Action failed: ${error instanceof Error ? error.message : error}`
    );
  }
}

run();
