#!/usr/bin/env node

import { Command } from 'commander';
import { lintEnhancedCommand } from './commands/lintEnhanced.js';
import { watchCommand } from './commands/watch.js';
import { initCommand } from './commands/init.js';
import { installHookCommand, uninstallHookCommand } from './commands/hook.js';
import { explainCommand } from './commands/explain.js';
import { mcpCommand } from './commands/mcp.js';
import { whyCommand } from './commands/why.js';
import { suggestCommand } from './commands/suggest.js';
import { analyzeCommand } from './commands/analyze.js';
import { metricsCommand } from './commands/metrics.js';
import { packCommand } from './commands/pack.js';

const program = new Command();

program
  .name('cclint')
  .description('A linter for CLAUDE.md / AGENTS.md context files')
  .version('0.24.0');

program.addCommand(lintEnhancedCommand);
program.addCommand(watchCommand);
program.addCommand(initCommand);
program.addCommand(installHookCommand);
program.addCommand(uninstallHookCommand);
program.addCommand(explainCommand);
program.addCommand(mcpCommand);
program.addCommand(whyCommand);
program.addCommand(suggestCommand);
program.addCommand(analyzeCommand);
program.addCommand(metricsCommand);
program.addCommand(packCommand);

program.parse();
