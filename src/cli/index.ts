#!/usr/bin/env node

import { Command } from 'commander';
import { lintEnhancedCommand } from './commands/lintEnhanced.js';
import { watchCommand } from './commands/watch.js';
import { initCommand } from './commands/init.js';
import { installHookCommand, uninstallHookCommand } from './commands/hook.js';
import { explainCommand } from './commands/explain.js';
import { mcpCommand } from './commands/mcp.js';
import { whyCommand } from './commands/why.js';

const program = new Command();

program
  .name('cclint')
  .description('A linter for CLAUDE.md context files')
  .version('0.16.0');

program.addCommand(lintEnhancedCommand);
program.addCommand(watchCommand);
program.addCommand(initCommand);
program.addCommand(installHookCommand);
program.addCommand(uninstallHookCommand);
program.addCommand(explainCommand);
program.addCommand(mcpCommand);
program.addCommand(whyCommand);

program.parse();
