import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Location } from '../domain/Location.js';
import { Severity } from '../domain/Severity.js';

/**
 * Strict SemVer 2.0.0 pattern (major.minor.patch with optional pre-release and
 * build metadata). Plugin and marketplace manifests declare versions that
 * tooling compares, so a non-semver value is a real defect.
 */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Fields in a plugin manifest whose value points at bundled resources. Each may
 * be a single relative path string or an array of them; `hooks` additionally
 * accepts an inline object, which we skip rather than treat as a path.
 */
const PATH_FIELDS = ['commands', 'agents', 'skills', 'hooks'] as const;

const AT_START = new Location(1, 1);

/**
 * Validates Claude Code plugin manifests: the plugin descriptor
 * (`.claude-plugin/plugin.json`) and the marketplace listing
 * (`marketplace.json`).
 *
 * @remarks
 * A malformed manifest silently breaks plugin discovery/installation, so this
 * rule checks the invariants Claude Code relies on: parseable JSON, a required
 * `name`, a SemVer `version`, well-formed resource path references, and the
 * shape of a marketplace's `plugins` array. It is a pure rule — it reasons only
 * over the already-read {@link ContextFile} content and performs no IO.
 */
export class PluginManifestRule implements Rule {
  public readonly id = 'plugin-manifest';
  public readonly description =
    'Validates Claude Code plugin.json and marketplace.json manifests';

  public appliesTo(file: ContextFile): boolean {
    return file.isPluginManifest();
  }

  public lint(file: ContextFile): Violation[] {
    if (!file.isPluginManifest()) {
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
          'Plugin manifest must be a JSON object.',
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    return this.isMarketplace(file.path)
      ? this.validateMarketplace(root)
      : this.validatePlugin(root);
  }

  private isMarketplace(path: string): boolean {
    return /(^|[\\/])marketplace\.json$/i.test(path);
  }

  private validatePlugin(root: Record<string, unknown>): Violation[] {
    const violations: Violation[] = [];

    violations.push(...this.requireName(root));
    violations.push(...this.validateVersion(root['version']));
    violations.push(...this.validateOptionalString(root, 'description'));

    for (const field of PATH_FIELDS) {
      violations.push(...this.validatePathField(field, root[field]));
    }

    return violations;
  }

  private validateMarketplace(root: Record<string, unknown>): Violation[] {
    const violations: Violation[] = [];

    violations.push(...this.requireName(root));

    const plugins = root['plugins'];
    if (plugins === undefined) {
      violations.push(
        new Violation(
          this.id,
          'Marketplace manifest is missing required "plugins" array.',
          Severity.ERROR,
          AT_START
        )
      );
      return violations;
    }
    if (!Array.isArray(plugins)) {
      violations.push(
        new Violation(
          this.id,
          '"plugins" must be an array of plugin entries.',
          Severity.ERROR,
          AT_START
        )
      );
      return violations;
    }

    plugins.forEach((entry, index) =>
      violations.push(...this.validateMarketplaceEntry(entry, index))
    );

    return violations;
  }

  private validateMarketplaceEntry(entry: unknown, index: number): Violation[] {
    const where = `plugins[${index}]`;
    if (!isRecord(entry)) {
      return [
        new Violation(
          this.id,
          `Marketplace entry "${where}" must be an object.`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }

    const violations: Violation[] = [];

    const name = entry['name'];
    if (typeof name !== 'string' || name.trim() === '') {
      violations.push(
        new Violation(
          this.id,
          `Marketplace entry "${where}" is missing a non-empty "name" string.`,
          Severity.ERROR,
          AT_START
        )
      );
    }

    if (entry['source'] === undefined) {
      violations.push(
        new Violation(
          this.id,
          `Marketplace entry "${where}" is missing a "source" (path, object, or git reference).`,
          Severity.WARNING,
          AT_START
        )
      );
    }

    violations.push(...this.validateVersion(entry['version']));

    return violations;
  }

  private requireName(root: Record<string, unknown>): Violation[] {
    const name = root['name'];
    if (name === undefined) {
      return [
        new Violation(
          this.id,
          'Manifest is missing required "name" field.',
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    if (typeof name !== 'string' || name.trim() === '') {
      return [
        new Violation(
          this.id,
          '"name" must be a non-empty string.',
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    return [];
  }

  private validateVersion(version: unknown): Violation[] {
    if (version === undefined) {
      // Only the plugin descriptor conventionally carries a top-level version;
      // its absence is a recommendation, not a hard error.
      return [];
    }
    if (typeof version !== 'string') {
      return [
        new Violation(
          this.id,
          '"version" must be a SemVer string (e.g. "1.2.3").',
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    if (!SEMVER.test(version.trim())) {
      return [
        new Violation(
          this.id,
          `"version" ("${version}") is not valid SemVer (expected major.minor.patch, e.g. "1.0.0").`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    return [];
  }

  private validateOptionalString(
    root: Record<string, unknown>,
    key: string
  ): Violation[] {
    const value = root[key];
    if (value !== undefined && typeof value !== 'string') {
      return [
        new Violation(
          this.id,
          `"${key}" must be a string.`,
          Severity.ERROR,
          AT_START
        ),
      ];
    }
    return [];
  }

  private validatePathField(field: string, value: unknown): Violation[] {
    if (value === undefined) {
      return [];
    }

    // `hooks` may reference a hooks file (path) or inline the config object.
    if (field === 'hooks' && isRecord(value)) {
      return [];
    }

    if (typeof value === 'string') {
      return this.validatePathString(field, value);
    }

    if (Array.isArray(value)) {
      const violations: Violation[] = [];
      value.forEach((item, index) => {
        if (typeof item !== 'string') {
          violations.push(
            new Violation(
              this.id,
              `"${field}[${index}]" must be a path string.`,
              Severity.ERROR,
              AT_START
            )
          );
          return;
        }
        violations.push(...this.validatePathString(`${field}[${index}]`, item));
      });
      return violations;
    }

    return [
      new Violation(
        this.id,
        `"${field}" must be a path string or an array of path strings.`,
        Severity.ERROR,
        AT_START
      ),
    ];
  }

  private validatePathString(where: string, path: string): Violation[] {
    const violations: Violation[] = [];
    if (path.trim() === '') {
      violations.push(
        new Violation(
          this.id,
          `"${where}" is an empty path.`,
          Severity.ERROR,
          AT_START
        )
      );
      return violations;
    }
    if (path.startsWith('/')) {
      violations.push(
        new Violation(
          this.id,
          `"${where}" ("${path}") is an absolute path; plugin resources should be referenced relative to the plugin root.`,
          Severity.WARNING,
          AT_START
        )
      );
    }
    if (path.includes('\\')) {
      violations.push(
        new Violation(
          this.id,
          `"${where}" ("${path}") uses backslashes; use forward slashes for portable paths.`,
          Severity.WARNING,
          AT_START
        )
      );
    }
    return violations;
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
