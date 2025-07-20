#!/usr/bin/env node

import { Command } from 'commander';
import { lintCommand } from './commands/lint.js';

const program = new Command();

program
  .name('cclint')
  .description('A linter for CLAUDE.md context files')
  .version('0.1.0');

program.addCommand(lintCommand);

program.parse();
