import { Command } from 'commander';
import { startServer } from '../../mcp/server.js';

export const mcpCommand = new Command('mcp')
  .description(
    'Run cclint as a Model Context Protocol (MCP) stdio server for Claude Desktop / Claude Code'
  )
  .action(async () => {
    await startServer();
  });
