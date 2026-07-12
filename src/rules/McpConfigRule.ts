import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

const AT_START = new Location(1, 1);

/** Transport `type` values accepted for a remote MCP server. */
const REMOTE_TYPES = new Set(['sse', 'http']);

/**
 * Validates a Model Context Protocol configuration file (`.mcp.json`).
 *
 * @remarks
 * Claude Code loads MCP servers from `.mcp.json`; a malformed entry silently
 * drops the server. This rule enforces the shape Claude Code expects: a
 * top-level `mcpServers` object whose every entry is *either* a stdio server
 * (`command`, optional `args`/`env`) *or* a remote server (`url` + a `type` of
 * `sse`/`http`) — never both or neither. It also checks that `${VAR}`
 * environment placeholders are well-formed and that no server name is declared
 * twice (JSON silently keeps only the last duplicate key). It is a pure rule
 * and performs no IO.
 */
export class McpConfigRule implements Rule {
  public readonly id = 'mcp-config';
  public readonly description =
    'Validates Claude Code MCP server configuration (.mcp.json)';

  public appliesTo(file: ContextFile): boolean {
    return file.isMcpConfig();
  }

  public lint(file: ContextFile): Violation[] {
    if (!file.isMcpConfig()) {
      return [];
    }

    const parsed = parseJson(file.content);
    if (!parsed.ok) {
      return [
        new Violation(
          this.id,
          `Invalid JSON: ${parsed.error}`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    const root = parsed.value;
    if (!isRecord(root)) {
      return [
        new Violation(
          this.id,
          '.mcp.json must be a JSON object.',
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    const servers = root['mcpServers'];
    if (servers === undefined) {
      return [
        new Violation(
          this.id,
          '.mcp.json is missing a "mcpServers" object.',
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    if (!isRecord(servers)) {
      return [
        new Violation(
          this.id,
          '"mcpServers" must be an object keyed by server name.',
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    const violations: Violation[] = [];
    violations.push(...this.reportDuplicateServerNames(file.content));

    for (const [name, server] of Object.entries(servers)) {
      violations.push(...this.validateServer(name, server));
    }

    return violations;
  }

  private validateServer(name: string, server: unknown): Violation[] {
    if (!isRecord(server)) {
      return [
        new Violation(
          this.id,
          `Server "${name}" must be an object.`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    const hasCommand = server['command'] !== undefined;
    const hasUrl = server['url'] !== undefined;

    if (hasCommand && hasUrl) {
      return [
        new Violation(
          this.id,
          `Server "${name}" declares both "command" (stdio) and "url" (remote); it must be exactly one.`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    if (!hasCommand && !hasUrl) {
      return [
        new Violation(
          this.id,
          `Server "${name}" must declare either "command" (stdio) or "url" (remote).`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    return hasCommand
      ? this.validateStdioServer(name, server)
      : this.validateRemoteServer(name, server);
  }

  private validateStdioServer(
    name: string,
    server: Record<string, unknown>
  ): Violation[] {
    const violations: Violation[] = [];

    const command = server['command'];
    if (typeof command !== 'string' || command.trim() === '') {
      violations.push(
        new Violation(
          this.id,
          `Server "${name}" has a non-empty "command" requirement.`,
          Severity.ERROR,
          AT_START
        )
      );
    }

    const args = server['args'];
    if (args !== undefined) {
      if (!Array.isArray(args)) {
        violations.push(
          new Violation(
            this.id,
            `Server "${name}" "args" must be an array of strings.`,
            Severity.ERROR,
            AT_START
          )
        );
      } else if (!args.every(item => typeof item === 'string')) {
        violations.push(
          new Violation(
            this.id,
            `Server "${name}" "args" must contain only strings.`,
            Severity.ERROR,
            AT_START
          )
        );
      }
    }

    violations.push(...this.validateEnv(name, server['env']));
    violations.push(...this.collectPlaceholders(name, server));

    return violations;
  }

  private validateRemoteServer(
    name: string,
    server: Record<string, unknown>
  ): Violation[] {
    const violations: Violation[] = [];

    const url = server['url'];
    if (typeof url !== 'string' || url.trim() === '') {
      violations.push(
        new Violation(
          this.id,
          `Server "${name}" has a non-empty "url" requirement.`,
          Severity.ERROR,
          AT_START
        )
      );
    }

    const type = server['type'];
    if (type === undefined) {
      violations.push(
        new Violation(
          this.id,
          `Remote server "${name}" is missing a "type" ("sse" or "http").`,
          Severity.WARNING,
          AT_START
        )
      );
    } else if (typeof type !== 'string' || !REMOTE_TYPES.has(type)) {
      violations.push(
        new Violation(
          this.id,
          `Remote server "${name}" has an invalid "type" (${JSON.stringify(type)}); expected "sse" or "http".`,
          Severity.ERROR,
          AT_START
        )
      );
    }

    violations.push(...this.validateEnv(name, server['env']));
    violations.push(...this.collectPlaceholders(name, server));

    return violations;
  }

  private validateEnv(name: string, env: unknown): Violation[] {
    if (env === undefined) {
      return [];
    }
    if (!isRecord(env)) {
      return [
        new Violation(
          this.id,
          `Server "${name}" "env" must be an object of string values.`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    if (!Object.values(env).every(value => typeof value === 'string')) {
      return [
        new Violation(
          this.id,
          `Server "${name}" "env" values must all be strings.`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    return [];
  }

  /** Flag malformed `${VAR}` placeholders in any string value of a server. */
  private collectPlaceholders(
    name: string,
    server: Record<string, unknown>
  ): Violation[] {
    const violations: Violation[] = [];
    for (const raw of collectStrings(server)) {
      for (const bad of findMalformedPlaceholders(raw)) {
        violations.push(
          new Violation(
            this.id,
            `Server "${name}" has a malformed environment placeholder "${bad}"; use "\${VAR_NAME}".`,
            Severity.WARNING,
            AT_START
          )
        );
      }
    }
    return violations;
  }

  /**
   * Detect server names declared more than once. JSON.parse keeps only the last
   * value for a duplicate key, so the parsed object cannot reveal the collision;
   * this scans the raw text with a string-aware brace walk.
   */
  private reportDuplicateServerNames(content: string): Violation[] {
    const duplicates = findDuplicateMcpServerKeys(content);
    return duplicates.map(
      name =>
        new Violation(
          this.id,
          `Server "${name}" is declared more than once; duplicate keys silently overwrite each other.`,
          Severity.ERROR,
          AT_START
        )
    );
  }
}

type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

function parseJson(content: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(content) as unknown };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown JSON error',
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively collect every string value nested under an object/array. */
function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

/**
 * Return every malformed `${...}` placeholder in a string. A well-formed
 * placeholder is `${NAME}` where NAME matches a shell identifier
 * (`[A-Za-z_][A-Za-z0-9_]*`). An unterminated `${` or an invalid name is
 * reported.
 */
function findMalformedPlaceholders(input: string): string[] {
  const bad: string[] = [];
  const valid = /^[A-Za-z_][A-Za-z0-9_]*$/;

  for (let i = input.indexOf('${'); i !== -1; i = input.indexOf('${', i + 2)) {
    const close = input.indexOf('}', i);
    if (close === -1) {
      bad.push(input.slice(i));
      break;
    }
    const nameToken = input.slice(i + 2, close);
    if (!valid.test(nameToken)) {
      bad.push(input.slice(i, close + 1));
    }
  }

  return bad;
}

/**
 * Find keys declared more than once as *direct children* of the `mcpServers`
 * object, using a string-aware single pass so braces inside string values
 * (including `${VAR}`) never skew the depth tracking.
 */
function findDuplicateMcpServerKeys(content: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  let depth = 0;
  let inString = false;
  let escaped = false;
  let buffer = '';
  let lastString: string | null = null;
  let serversDepth = -1;
  let pendingServers = false;

  for (const ch of content) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        lastString = buffer;
      } else {
        buffer += ch;
      }
      continue;
    }

    switch (ch) {
      case '"':
        inString = true;
        buffer = '';
        break;
      case ':':
        if (lastString !== null) {
          if (lastString === 'mcpServers') {
            pendingServers = true;
          } else if (depth === serversDepth) {
            if (seen.has(lastString)) {
              duplicates.add(lastString);
            } else {
              seen.add(lastString);
            }
          }
        }
        lastString = null;
        break;
      case '{':
        depth++;
        if (pendingServers) {
          serversDepth = depth;
          pendingServers = false;
        }
        lastString = null;
        break;
      case '}':
        if (depth === serversDepth) {
          serversDepth = -1;
        }
        depth--;
        lastString = null;
        break;
      case ',':
        lastString = null;
        break;
      default:
        break;
    }
  }

  return [...duplicates];
}
