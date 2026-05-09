#!/usr/bin/env node
/**
 * cclint MCP server entry point.
 *
 * Run as a stdio MCP server so any MCP-compatible client (Claude
 * Desktop, Claude Code, etc.) can call cclint without installing
 * the CLI globally.
 *
 * Wire it up in your MCP client config, e.g. for Claude Desktop:
 *
 *   {
 *     "mcpServers": {
 *       "cclint": {
 *         "command": "npx",
 *         "args": ["@felixgeelhaar/cclint", "mcp"]
 *       }
 *     }
 *   }
 */
import { startServer } from './server.js';

void startServer();
