import { describe, it, expect } from 'vitest';
import { McpConfigRule } from '../../../src/rules/McpConfigRule.js';
import { ContextFile } from '../../../src/domain/ContextFile.js';
import { Severity } from '../../../src/domain/Severity.js';

const MCP = '.mcp.json';

function lint(content: string, path = MCP) {
  return new McpConfigRule().lint(new ContextFile(path, content));
}

const messages = (content: string, path = MCP): string[] =>
  lint(content, path).map(v => v.message);

describe('McpConfigRule', () => {
  describe('identity + gating', () => {
    it('has the expected id and description', () => {
      const rule = new McpConfigRule();
      expect(rule.id).toBe('mcp-config');
      expect(rule.description).toContain('MCP');
    });

    it('appliesTo only .mcp.json files', () => {
      const rule = new McpConfigRule();
      expect(rule.appliesTo(new ContextFile('.mcp.json', '{}'))).toBe(true);
      expect(rule.appliesTo(new ContextFile('/r/.mcp.json', '{}'))).toBe(true);
      expect(rule.appliesTo(new ContextFile('package.json', '{}'))).toBe(false);
    });

    it('returns no violations for a non-mcp file', () => {
      expect(lint('{ not json', 'package.json')).toHaveLength(0);
    });
  });

  describe('JSON parsing + shape', () => {
    it('flags invalid JSON', () => {
      const v = lint('{ "mcpServers": ');
      expect(v).toHaveLength(1);
      expect(v[0]?.message).toContain('Invalid JSON');
    });

    it('flags a missing mcpServers object', () => {
      expect(messages(JSON.stringify({}))).toContain(
        '.mcp.json is missing a "mcpServers" object.'
      );
    });

    it('flags a non-object mcpServers', () => {
      expect(messages(JSON.stringify({ mcpServers: [] }))).toContain(
        '"mcpServers" must be an object keyed by server name.'
      );
    });

    it('accepts an empty mcpServers object', () => {
      expect(lint(JSON.stringify({ mcpServers: {} }))).toHaveLength(0);
    });
  });

  describe('stdio servers', () => {
    it('accepts a valid stdio server', () => {
      const content = JSON.stringify({
        mcpServers: {
          fs: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem'],
            env: { ROOT: '/data' },
          },
        },
      });
      expect(lint(content)).toHaveLength(0);
    });

    it('rejects non-array args', () => {
      const v = lint(
        JSON.stringify({ mcpServers: { a: { command: 'x', args: 'nope' } } })
      );
      expect(v.some(x => x.message.includes('"args" must be an array'))).toBe(
        true
      );
    });

    it('rejects non-string args entries', () => {
      const v = lint(
        JSON.stringify({ mcpServers: { a: { command: 'x', args: [1] } } })
      );
      expect(
        v.some(x => x.message.includes('"args" must contain only strings'))
      ).toBe(true);
    });

    it('rejects non-object env', () => {
      const v = lint(
        JSON.stringify({ mcpServers: { a: { command: 'x', env: 'no' } } })
      );
      expect(v.some(x => x.message.includes('"env" must be an object'))).toBe(
        true
      );
    });

    it('rejects non-string env values', () => {
      const v = lint(
        JSON.stringify({ mcpServers: { a: { command: 'x', env: { N: 1 } } } })
      );
      expect(
        v.some(x => x.message.includes('"env" values must all be strings'))
      ).toBe(true);
    });
  });

  describe('remote servers', () => {
    it('accepts a valid remote server', () => {
      const content = JSON.stringify({
        mcpServers: { api: { url: 'https://mcp.example.com', type: 'sse' } },
      });
      expect(lint(content)).toHaveLength(0);
    });

    it('warns when type is missing', () => {
      const v = lint(
        JSON.stringify({ mcpServers: { api: { url: 'https://x' } } })
      );
      const warn = v.find(x => x.message.includes('missing a "type"'));
      expect(warn?.severity).toBe(Severity.WARNING);
    });

    it('rejects an invalid type', () => {
      const v = lint(
        JSON.stringify({
          mcpServers: { api: { url: 'https://x', type: 'ws' } },
        })
      );
      expect(v.some(x => x.message.includes('invalid "type"'))).toBe(true);
    });
  });

  describe('stdio/remote exclusivity', () => {
    it('rejects a server that is both stdio and remote', () => {
      const v = lint(
        JSON.stringify({
          mcpServers: { a: { command: 'x', url: 'https://y' } },
        })
      );
      expect(v.some(x => x.message.includes('both'))).toBe(true);
    });

    it('rejects a server that is neither', () => {
      const v = lint(JSON.stringify({ mcpServers: { a: { foo: 'bar' } } }));
      expect(
        v.some(
          x =>
            x.message.includes('either "command"') &&
            x.message.includes('or "url"')
        )
      ).toBe(true);
    });

    it('rejects a non-object server', () => {
      expect(messages(JSON.stringify({ mcpServers: { a: 5 } }))).toContain(
        'Server "a" must be an object.'
      );
    });
  });

  describe('environment placeholders', () => {
    it('accepts well-formed ${VAR} placeholders', () => {
      const content = JSON.stringify({
        mcpServers: {
          a: { command: 'x', env: { TOKEN: '${GITHUB_TOKEN}' } },
        },
      });
      expect(lint(content)).toHaveLength(0);
    });

    it('flags an unterminated placeholder', () => {
      const content = JSON.stringify({
        mcpServers: { a: { command: 'x', env: { T: '${OPEN' } } },
      });
      expect(
        lint(content).some(v => v.message.includes('malformed environment'))
      ).toBe(true);
    });

    it('flags an empty placeholder name', () => {
      const content = JSON.stringify({
        mcpServers: { a: { command: 'x', env: { T: 'pre-${}' } } },
      });
      expect(
        lint(content).some(v => v.message.includes('malformed environment'))
      ).toBe(true);
    });
  });

  describe('duplicate server names', () => {
    it('flags a server declared twice', () => {
      // Raw text with a duplicate key; JSON.parse would keep only the last.
      const content =
        '{\n  "mcpServers": {\n    "a": { "command": "x" },\n    "a": { "url": "https://y", "type": "http" }\n  }\n}';
      const v = lint(content);
      expect(
        v.some(
          x => x.message.includes('"a"') && x.message.includes('more than once')
        )
      ).toBe(true);
    });

    it('does not flag distinct servers that reuse inner keys', () => {
      const content = JSON.stringify({
        mcpServers: {
          a: { command: 'x', env: { KEY: '1' } },
          b: { command: 'y', env: { KEY: '2' } },
        },
      });
      expect(
        lint(content).some(v => v.message.includes('more than once'))
      ).toBe(false);
    });
  });
});
