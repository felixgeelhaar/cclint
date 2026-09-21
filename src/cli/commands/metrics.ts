import { Command } from 'commander';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { RulesEngine } from '../../domain/RulesEngine.js';
import { createRules } from '../../rules/registry/createRules.js';
import { ConfigLoader } from '../../infrastructure/ConfigLoader.js';
import { FileDiscovery } from '../../infrastructure/FileDiscovery.js';
import { FileReader } from '../../infrastructure/FileReader.js';
import { shouldIgnorePath } from '../../infrastructure/ignoreMatch.js';
import { qualityScore } from '../../domain/qualityScore.js';

export interface MetricsSnapshot {
  recordedAt: string;
  path: string;
  files: number;
  errors: number;
  warnings: number;
  infos: number;
  score: number;
}

const STORE = '.cclint/metrics.jsonl';

function storePath(): string {
  return resolve(process.cwd(), STORE);
}

async function snapshot(target: string): Promise<MetricsSnapshot> {
  const config = ConfigLoader.load();
  const engine = new RulesEngine(createRules(config));
  const root = resolve(target);
  const reader = new FileReader();

  const files: string[] = [];
  if (existsSync(root) && statSync(root).isDirectory()) {
    files.push(
      ...new FileDiscovery()
        .discover(root)
        .filter(f => !shouldIgnorePath(f, config.ignore, { projectRoot: root }))
    );
  } else if (existsSync(root) && statSync(root).isFile()) {
    files.push(root);
  } else {
    throw new Error(`path not found: ${target}`);
  }

  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const filePath of files) {
    try {
      const contextFile = await reader.readContextFile(filePath);
      const result = engine.lint(contextFile);
      errors += result.getErrorCount();
      warnings += result.getWarningCount();
      infos += result.getInfoCount();
    } catch {
      // Skip unreadable files, same as directory lint.
    }
  }

  return {
    recordedAt: new Date().toISOString(),
    path: root,
    files: files.length,
    errors,
    warnings,
    infos,
    score: qualityScore(errors, warnings, infos),
  };
}

function readHistory(): MetricsSnapshot[] {
  const path = storePath();
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line) as MetricsSnapshot);
}

function printSnapshot(entry: MetricsSnapshot): void {
  console.log(
    `${entry.recordedAt}  score=${entry.score}  files=${entry.files}  ${entry.errors}e/${entry.warnings}w/${entry.infos}i  ${entry.path}`
  );
}

export const metricsCommand = new Command('metrics')
  .description('Record and export CLAUDE.md quality scores locally');

metricsCommand
  .command('record')
  .description('Lint a path and append a quality snapshot to .cclint/metrics.jsonl')
  .argument('[path]', 'File or directory', '.')
  .action(async (target: string) => {
    try {
      const entry = await snapshot(target);
      const path = storePath();
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${JSON.stringify(entry)}\n`, 'utf8');
      console.log(`Recorded ${path}`);
      printSnapshot(entry);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

metricsCommand
  .command('show')
  .description('Print recorded quality snapshots')
  .action(() => {
    const history = readHistory();
    if (history.length === 0) {
      console.log('No metrics recorded. Run `cclint metrics record`.');
      return;
    }
    for (const entry of history) {
      printSnapshot(entry);
    }
  });

metricsCommand
  .command('export')
  .description('Print recorded snapshots as JSON')
  .action(() => {
    console.log(JSON.stringify(readHistory(), null, 2));
  });
