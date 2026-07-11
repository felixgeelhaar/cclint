import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createServer } from '../../../src/mcp/server.js';

describe('MCP server', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cclint-mcp-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('should construct without throwing', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  // Lightweight smoke test: invoke the registered handler directly via the
  // SDK's internal map. We verify the server registered the expected tools
  // by inspecting its server property.
  it('should expose the four expected tools', () => {
    const server = createServer();
    // McpServer keeps a private _registeredTools map. Read via any-cast
    // because the SDK does not expose it; the assertion is intentionally
    // structural — the test fails loudly if the private contract changes.
    const internal = server as unknown as {
      _registeredTools?: Record<string, unknown>;
    };
    const tools = internal._registeredTools;
    expect(tools).toBeDefined();
    if (!tools) return;
    expect(Object.keys(tools)).toContain('lint_file');
    expect(Object.keys(tools)).toContain('lint_string');
    expect(Object.keys(tools)).toContain('list_rules');
    expect(Object.keys(tools)).toContain('explain_rule');
  });

  it('should be able to lint inline content via lint_string', async () => {
    const server = createServer();
    const internal = server as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (
            args: unknown,
            extra?: unknown
          ) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
        }
      >;
    };
    const tool = internal._registeredTools['lint_string'];
    expect(tool).toBeDefined();
    if (!tool) return;
    const out = await tool.handler({
      path: '/tmp/CLAUDE.md',
      content: '# Title\n',
    });
    expect(out.isError).not.toBe(true);
    const text = out.content[0]?.text ?? '';
    const parsed = JSON.parse(text) as {
      file: string;
      violations: unknown[];
      summary: { errors: number };
    };
    expect(parsed.file).toBe('/tmp/CLAUDE.md');
    expect(Array.isArray(parsed.violations)).toBe(true);
  });

  it('should lint a file from disk via lint_file', async () => {
    const path = join(workDir, 'CLAUDE.md');
    writeFileSync(path, '# Project\n', 'utf-8');

    const server = createServer();
    const internal = server as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (
            args: unknown,
            extra?: unknown
          ) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
        }
      >;
    };
    const tool = internal._registeredTools['lint_file'];
    expect(tool).toBeDefined();
    if (!tool) return;
    const out = await tool.handler({ path });
    expect(out.isError).not.toBe(true);
    const parsed = JSON.parse(out.content[0]?.text ?? '{}') as {
      file: string;
    };
    expect(parsed.file).toBe(path);
  });

  it('should return isError when lint_file is given a missing path', async () => {
    const server = createServer();
    const internal = server as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (
            args: unknown,
            extra?: unknown
          ) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
        }
      >;
    };
    const tool = internal._registeredTools['lint_file'];
    expect(tool).toBeDefined();
    if (!tool) return;
    const out = await tool.handler({ path: '/no/such/file/anywhere.md' });
    expect(out.isError).toBe(true);
  });

  it('should reject a non-markdown file via lint_file (extension allow-list)', async () => {
    // A file that exists but has a disallowed extension must be rejected by the
    // FileReader adapter rather than read inline.
    const path = join(workDir, 'payload.sh');
    writeFileSync(path, '#!/bin/sh\nrm -rf /\n', 'utf-8');

    const server = createServer();
    const internal = server as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (
            args: unknown,
            extra?: unknown
          ) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
        }
      >;
    };
    const tool = internal._registeredTools['lint_file'];
    expect(tool).toBeDefined();
    if (!tool) return;
    const out = await tool.handler({ path });
    expect(out.isError).toBe(true);
    expect(out.content[0]?.text ?? '').toMatch(/not allowed|Markdown/i);
  });

  it('should reject a directory-traversal path via lint_file', async () => {
    const server = createServer();
    const internal = server as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (
            args: unknown,
            extra?: unknown
          ) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
        }
      >;
    };
    const tool = internal._registeredTools['lint_file'];
    expect(tool).toBeDefined();
    if (!tool) return;
    const out = await tool.handler({ path: '../../../../etc/passwd' });
    expect(out.isError).toBe(true);
  });

  it('should list every registered rule via list_rules', async () => {
    const server = createServer();
    const internal = server as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (
            args: unknown,
            extra?: unknown
          ) => Promise<{ content: Array<{ text: string }> }>;
        }
      >;
    };
    const tool = internal._registeredTools['list_rules'];
    expect(tool).toBeDefined();
    if (!tool) return;
    const out = await tool.handler({});
    const rules = JSON.parse(out.content[0]?.text ?? '[]') as Array<{
      id: string;
    }>;
    expect(rules.length).toBeGreaterThanOrEqual(14);
    expect(rules.some(r => r.id === 'subagent-structure')).toBe(true);
    expect(rules.some(r => r.id === 'command-safety')).toBe(true);
  });

  it('should explain a known rule and reject unknown rules', async () => {
    const server = createServer();
    const internal = server as unknown as {
      _registeredTools: Record<
        string,
        {
          handler: (
            args: unknown,
            extra?: unknown
          ) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
        }
      >;
    };
    const tool = internal._registeredTools['explain_rule'];
    expect(tool).toBeDefined();
    if (!tool) return;
    const ok = await tool.handler({ ruleId: 'file-size' });
    expect(ok.isError).not.toBe(true);
    const meta = JSON.parse(ok.content[0]?.text ?? '{}') as { id: string };
    expect(meta.id).toBe('file-size');

    const bad = await tool.handler({ ruleId: 'no-such-rule' });
    expect(bad.isError).toBe(true);
  });
});
