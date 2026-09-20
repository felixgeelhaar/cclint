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

/**
 * Optional AI settings. API keys stay in the environment (`ANTHROPIC_API_KEY`);
 * this section tunes provider/model/tokens and can disable AI features entirely.
 */
export type AiProviderName = 'anthropic' | 'ollama';

export interface AiConfig {
  /**
   * When `false`, all AI CLI features refuse to run even if an API key is set.
   * Default (absent / `true`): AI is allowed when the user opts in via a flag.
   */
  enabled?: boolean;
  /**
   * Backend for AI completions. Default `anthropic`.
   * `ollama` talks to a local Ollama server (no API key).
   */
  provider?: AiProviderName;
  /** Model id (Anthropic default: claude-haiku-4-5; Ollama default: llama3.1). */
  model?: string;
  /** Default max_tokens / num_predict when a command does not override. */
  maxTokens?: number;
  /**
   * Ollama base URL (default `http://127.0.0.1:11434`, or `OLLAMA_HOST`).
   * Ignored for the Anthropic provider.
   */
  endpoint?: string;
}

export interface CclintConfig {
  rules: {
    'file-size'?: RuleConfig & {
      options?: {
        maxSize?: number;
        maxLines?: number;
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
  /**
   * One or more built-in preset names to inherit configuration from, applied
   * left-to-right before the user's own config (defaults ← preset(s) ← user).
   * See {@link file://./presets.ts} for the available presets.
   */
  extends?: string | string[];
  ignore?: string[];
  /** Optional Anthropic tuning for `--ai` / `suggest` / `analyze --ai`. */
  ai?: AiConfig;
}

export const defaultConfig: CclintConfig = {
  rules: {
    'file-size': {
      enabled: true,
      severity: 'warning',
      options: {
        maxSize: 10000,
        maxLines: 200,
      },
    },
    structure: {
      enabled: true,
      severity: 'warning',
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
