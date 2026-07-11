import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, isAbsolute, join, relative } from 'path';
import { LintingResult } from '../../domain/LintingResult.js';
import { Severity } from '../../domain/Severity.js';
import { getRuleMetadata } from '../../infrastructure/RuleMetadata.js';

/**
 * Canonical SARIF 2.1.0 schema URL. GitHub code scanning validates uploads
 * against this schema, so keep it stable.
 */
const SARIF_SCHEMA =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';

const SARIF_VERSION = '2.1.0';

const FALLBACK_INFORMATION_URI = 'https://github.com/felixgeelhaar/cclint';

/** SARIF result severity levels we emit. */
type SarifLevel = 'error' | 'warning' | 'note';

export interface SarifFormatOptions {
  /** Tool driver version. Defaults to the version in package.json. */
  toolVersion?: string | undefined;
  /** Tool driver informationUri. Defaults to the package.json homepage. */
  informationUri?: string | undefined;
}

interface SarifReportingDescriptor {
  id: string;
  name: string;
  shortDescription: { text: string };
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number; startColumn: number };
    };
  }>;
}

interface SarifLog {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        informationUri: string;
        version: string;
        rules: SarifReportingDescriptor[];
      };
    };
    results: SarifResult[];
  }>;
}

/**
 * Convert a cclint {@link LintingResult} into a SARIF 2.1.0 document.
 *
 * Output is deterministic: rules are sorted by id and results preserve the
 * (already deterministic) violation order, so snapshot tests are reliable.
 */
export function formatSarifResult(
  result: LintingResult,
  options: SarifFormatOptions = {}
): string {
  const pkg = readPackageMetadata();
  const version = options.toolVersion ?? pkg.version;
  const informationUri = options.informationUri ?? pkg.informationUri;

  const uri = toSarifUri(result.file.path);

  const results: SarifResult[] = result.violations.map(violation => ({
    ruleId: violation.ruleId,
    level: toSarifLevel(violation.severity),
    message: { text: violation.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri },
          region: {
            startLine: violation.location.line,
            // SARIF columns are 1-based; a 0 column means "whole line".
            startColumn: Math.max(1, violation.location.column),
          },
        },
      },
    ],
  }));

  const rules = buildRules(result);

  const log: SarifLog = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: 'cclint',
            informationUri,
            version,
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(log, null, 2);
}

/**
 * Map a domain severity to a SARIF level. `error`/`warning` map directly;
 * anything else (info, suggestion) becomes `note`.
 */
function toSarifLevel(severity: Severity): SarifLevel {
  if (severity === Severity.ERROR) return 'error';
  if (severity === Severity.WARNING) return 'warning';
  return 'note';
}

/**
 * Build the deduplicated, alphabetically-sorted rule descriptors for every
 * rule id that produced a result, each with a helpful shortDescription.
 */
function buildRules(result: LintingResult): SarifReportingDescriptor[] {
  const ids = new Set<string>();
  for (const violation of result.violations) {
    ids.add(violation.ruleId);
  }

  return [...ids].sort().map(id => {
    const metadata = getRuleMetadata(id);
    return {
      id,
      name: metadata?.name ?? id,
      shortDescription: {
        text: metadata?.description ?? `Violations reported by rule "${id}"`,
      },
    };
  });
}

/**
 * Normalize a file path into a SARIF artifact URI: relative to the current
 * working directory (when absolute) and using forward slashes.
 */
function toSarifUri(filePath: string): string {
  const relativePath = isAbsolute(filePath)
    ? relative(process.cwd(), filePath)
    : filePath;
  return relativePath.split('\\').join('/');
}

let cachedPackageMetadata: { version: string; informationUri: string } | null =
  null;

/**
 * Read the tool version and homepage from package.json. Resolves relative to
 * this module so it works from both `src` (tsx) and the compiled `dist` tree.
 */
function readPackageMetadata(): { version: string; informationUri: string } {
  if (cachedPackageMetadata) {
    return cachedPackageMetadata;
  }

  let version = '0.0.0';
  let informationUri = FALLBACK_INFORMATION_URI;

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // src/cli/formatters -> repo root, and dist/cli/formatters -> repo root.
    const pkgPath = join(here, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
      version?: string;
      homepage?: string;
    };
    if (typeof pkg.version === 'string') version = pkg.version;
    if (typeof pkg.homepage === 'string') informationUri = pkg.homepage;
  } catch {
    // Fall back to defaults when package.json cannot be read.
  }

  cachedPackageMetadata = { version, informationUri };
  return cachedPackageMetadata;
}
