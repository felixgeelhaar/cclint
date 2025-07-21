#!/usr/bin/env node

import { Command } from 'commander';
import { lintEnhancedCommand } from './commands/lintEnhanced.js';

const program = new Command();

program
  .name('cclint')
  .description('A linter for CLAUDE.md context files')
  .version('0.2.1');

program.addCommand(lintEnhancedCommand);

program.parse();
