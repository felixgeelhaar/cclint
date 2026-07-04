import { Severity } from './Severity.js';

export interface RuleConfig {
  enabled: boolean;
  severity?: 'error' | 'warning' | 'info';
  options?: Record<string, unknown>;
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

export interface CclintConfig {
  rules: {
    'file-size'?: RuleConfig & {
      options?: {
        maxSize?: number;
      };
    };
    structure?: RuleConfig & {
      options?: {
        requiredSections?: string[];
      };
    };
    content?: RuleConfig & {
      options?: {
        requiredPatterns?: string[];
      };
    };
    format?: RuleConfig;
    'code-blocks'?: RuleConfig & {
      options?: {
        languages?: string[];
        strict?: boolean;
      };
    };
    'skill-structure'?: RuleConfig & {
      options?: {
        requireDescription?: boolean;
        maxDescriptionLength?: number;
      };
    };
    'subagent-structure'?: RuleConfig & {
      options?: {
        allowDangerousTools?: boolean;
      };
    };
    'hook-configuration'?: RuleConfig & {
      options?: {
        dangerousCommands?: string[];
      };
    };
    // Dynamic custom rules
    [key: string]: RuleConfig | undefined;
  };
  plugins?: PluginConfig[];
  extends?: string[];
  ignore?: string[];
}

export const defaultConfig: CclintConfig = {
  rules: {
    'file-size': {
      enabled: true,
      severity: 'warning',
      options: {
        maxSize: 10000,
      },
    },
    structure: {
      enabled: true,
      severity: 'error',
      options: {
        requiredSections: [
          'Project Overview',
          'Development Commands',
          'Architecture',
        ],
      },
    },
    content: {
      enabled: true,
      severity: 'warning',
      options: {
        requiredPatterns: ['npm', 'TypeScript', 'test', 'build'],
      },
    },
    format: {
      enabled: true,
      severity: 'error',
    },
    'code-blocks': {
      enabled: true,
      severity: 'warning',
      options: {
        languages: [
          'javascript',
          'typescript',
          'python',
          'go',
          'bash',
          'sql',
          'yaml',
          'json',
        ],
        strict: true,
      },
    },
    'skill-structure': {
      enabled: true,
      severity: 'error',
    },
    'subagent-structure': {
      enabled: true,
      severity: 'error',
    },
    'hook-configuration': {
      enabled: true,
      severity: 'warning',
    },
  },
  ignore: [],
};

/**
 * Build the per-rule severity overrides the engine applies, from a resolved
 * config. A rule with a configured `severity` has all its violations emitted
 * at that level (the standard linter model). Shared by every entry point so
 * `config.rules.<id>.severity` behaves identically via CLI, MCP, and Action.
 */
export function buildSeverityOverrides(
  config: CclintConfig
): Map<string, Severity> {
  const overrides = new Map<string, Severity>();
  for (const [ruleId, ruleConfig] of Object.entries(config.rules)) {
    const name = ruleConfig?.severity;
    if (name) {
      const severity = Severity.fromName(name);
      if (severity) {
        overrides.set(ruleId, severity);
      }
    }
  }
  return overrides;
}
