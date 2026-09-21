# Configuration

cclint supports flexible configuration through configuration files, allowing you to customize rules, severity levels, and behavior for your project.

## Configuration Files

cclint will automatically look for configuration in the following files (in order of precedence):

1. `.cclintrc.json`
2. `.cclintrc.js` (not yet supported)
3. `cclint.config.js` (not yet supported)
4. `package.json` (in the `cclint` property)

The search starts from the current directory and walks up the directory tree until a configuration file is found or the root directory is reached.

## Configuration Format

### Basic Structure

```json
{
  "rules": {
    "rule-name": {
      "enabled": true,
      "severity": "error",
      "options": {}
    }
  },
  "extends": ["@cclint/recommended"],
  "ignore": ["pattern"],
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-haiku-4-5",
    "maxTokens": 800
  }
}
```

### AI settings (`ai`)

Optional tuning for `cclint why --ai`, `lint --ai`, `suggest`, and `analyze --ai`.
API keys are **never** read from config — set `ANTHROPIC_API_KEY` in the
environment.

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` (when absent) | Set `false` to refuse all AI features even if a key is present |
| `provider` | `anthropic` | `anthropic`, `openai`, or `ollama` |
| `model` | `claude-haiku-4-5` / `gpt-4o-mini` / `llama3.1` | Model id for the selected provider |
| `maxTokens` | `800` | Default max tokens (commands may override, e.g. `suggest --max-tokens`) |
| `endpoint` | `http://127.0.0.1:11434` | Ollama base URL (or set `OLLAMA_HOST`); ignored for Anthropic/OpenAI |

CLI override: `--provider anthropic|openai|ollama` on `why`, `suggest`, `analyze`, and `lint`.
Keys: `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` (Ollama needs none).

### Presets (`extends`)

Instead of hand-writing rule config, a project can inherit a built-in preset via
`extends`. This gives teams a sane, shared baseline with one line:

```json
{
  "extends": "@cclint/recommended"
}
```

`extends` also accepts an **array**, applied left-to-right (later presets and
your own `rules` win over earlier ones):

```json
{
  "extends": ["@cclint/recommended", "@cclint/strict"],
  "rules": {
    "file-size": { "severity": "warning" }
  }
}
```

**Resolution order.** Configuration is layered so the most specific wins:
defaults ← `extends` entries (left to right) ← your config. Each `extends` name
is resolved as (1) a built-in preset, then (2) an installed pack under
`.cclint/packs/` (directory walk from the config file). Unknown names warn and
are skipped.

### Local packs (`cclint pack`)

Share reusable config slices without a registry:

```bash
cclint pack create my-rules          # scaffolds ./my-rules
cclint pack install ./my-rules       # copies into .cclint/packs/my-rules
cclint pack list                     # builtins + installed
```

Then extend the pack by name:

```json
{
  "extends": "my-rules"
}
```

A pack directory contains `pack.json` (name/version) and `config.json` (a
partial cclint config). Built-in preset names (`@cclint/typescript`, etc.) need
no install — they already resolve via `extends`.

#### Available Presets

Your own `rules` always beat the preset, and `rules` are deep-merged per rule
(you can override a single `severity` or `option` without redefining the rest).

| Preset                 | Posture                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `@cclint/recommended`  | The sensible, out-of-the-box baseline — the core rules run as warnings, `format` as an error. Equivalent to running with no config, but explicit and stable. |
| `@cclint/strict`       | Zero-tolerance: **every** built-in rule is enabled and **every** violation is promoted to `error`, so any finding fails the run. Ideal for gating CI.        |
| `@cclint/minimal`      | Core only: `file-size`, `structure`, and `format`. Content and monorepo checks off. |
| `@cclint/typescript`   | Recommended baseline with the content rule kept on. |
| `@cclint/python` / `@cclint/go` | Recommended, but the JS/TS content cues are off. |
| `@cclint/monorepo`     | Recommended, with `monorepo-hierarchy` as an error. |
| `@cclint/library`      | Recommended, plus a required **Publishing** section. |
| `@cclint/api`          | Recommended, plus a required **API** section. |
| `@cclint/cli`          | Recommended, plus a required **CLI** section. |

You can layer your own overrides on top of either preset:

```json
{
  "extends": "@cclint/strict",
  "rules": {
    "file-size": { "options": { "maxSize": 20000 } }
  }
}
```

Presets work identically in `package.json` under the `cclint` key:

```json
{
  "cclint": {
    "extends": "@cclint/recommended"
  }
}
```

> **Unknown preset names** (e.g. a typo) are reported with a warning and
> ignored, so linting still runs with the remaining valid configuration. Only
> the built-in named presets above are supported — `extends` does not resolve
> file paths or npm packages, so there are no nested or cyclic `extends` to
> worry about.

### Rules Configuration

Each rule can be configured with:

- `enabled` (boolean): Whether the rule is active
- `severity` (string): `"error"`, `"warning"`, or `"info"`
- `options` (object): Rule-specific configuration

#### Available Rules

##### `file-size`
Controls maximum file size limits.

```json
{
  "file-size": {
    "enabled": true,
    "severity": "warning",
    "options": {
      "maxSize": 15000
    }
  }
}
```

**Options:**
- `maxSize` (number): Maximum file size in characters (default: 10000)

##### `structure`
Validates required sections in CLAUDE.md files.

```json
{
  "structure": {
    "enabled": true,
    "severity": "error",
    "options": {
      "requiredSections": [
        "Project Overview",
        "Development Commands",
        "Architecture"
      ]
    }
  }
}
```

**Options:**
- `requiredSections` (string[]): Array of required section headers

##### `content`
Checks for essential content patterns.

```json
{
  "content": {
    "enabled": true,
    "severity": "warning",
    "options": {
      "requiredPatterns": [
        "npm",
        "TypeScript",
        "test",
        "build"
      ]
    }
  }
}
```

**Options:**
- `requiredPatterns` (string[]): Array of required content patterns

##### `format`
Validates Markdown formatting and syntax.

```json
{
  "format": {
    "enabled": true,
    "severity": "error"
  }
}
```

**Options:** None

### Ignore Patterns

Use the `ignore` array to skip files. Patterns support **globs** (via picomatch)
matched against the absolute path, the path relative to the project root, and
the basename. Plain fragments without glob metacharacters still use substring
matching for backward compatibility:

```json
{
  "ignore": [
    "node_modules/",
    "dist/",
    "*.backup.md",
    "temp/**",
    "packages/legacy/**"
  ]
}
```

## Configuration Examples

### Minimal Configuration

```json
{
  "rules": {
    "file-size": {
      "enabled": true,
      "options": {
        "maxSize": 8000
      }
    },
    "format": {
      "enabled": true
    }
  }
}
```

### Team Configuration

```json
{
  "rules": {
    "file-size": {
      "enabled": true,
      "severity": "error",
      "options": {
        "maxSize": 12000
      }
    },
    "structure": {
      "enabled": true,
      "severity": "error",
      "options": {
        "requiredSections": [
          "Project Overview",
          "Development Setup",
          "Architecture",
          "API Documentation",
          "Deployment"
        ]
      }
    },
    "content": {
      "enabled": true,
      "severity": "warning",
      "options": {
        "requiredPatterns": [
          "npm",
          "TypeScript",
          "Docker",
          "test",
          "build",
          "deploy"
        ]
      }
    },
    "format": {
      "enabled": true,
      "severity": "error"
    }
  },
  "ignore": [
    "node_modules/",
    "dist/",
    "coverage/",
    "*.tmp.md"
  ]
}
```

### Package.json Configuration

You can also configure cclint in your `package.json`:

```json
{
  "name": "my-project",
  "scripts": {
    "lint:claude": "cclint lint CLAUDE.md"
  },
  "cclint": {
    "rules": {
      "file-size": {
        "enabled": true,
        "options": {
          "maxSize": 15000
        }
      },
      "structure": {
        "enabled": false
      }
    }
  }
}
```

## Plugins (`--allow-plugins`)

A project's configuration may declare custom rule plugins:

```json
{
  "plugins": [{ "name": "./my-plugin.js", "enabled": true }]
}
```

A config-declared plugin runs **arbitrary code in-process**. To avoid executing
untrusted code simply by linting a repository, cclint does **not** load these
plugins by default. They are only loaded when you explicitly opt in:

```bash
# Load the plugins declared in this project's config
cclint lint CLAUDE.md --allow-plugins

# Same, via environment variable
CCLINT_ALLOW_PLUGINS=1 cclint lint .
```

Without `--allow-plugins` (or `CCLINT_ALLOW_PLUGINS=1`) the declared plugins are
skipped — never imported — and cclint prints how many were skipped and how to
enable them. This trust gate is set out-of-band by the operator; the linted
repository itself cannot flip it.

## CLI Override

Configuration file settings can be overridden via CLI options:

```bash
# Override max-size from config
cclint lint CLAUDE.md --max-size 8000

# Use specific config file
cclint lint CLAUDE.md --config ./custom-config.json

# Enable auto-fix regardless of config
cclint lint CLAUDE.md --fix

# Trust and load config-declared plugins (opt-in)
cclint lint CLAUDE.md --allow-plugins
```

## Validation

cclint validates your configuration file and will warn you about:

- Unknown rule names
- Invalid severity levels
- Malformed rule options
- Syntax errors in JSON files

Example warning:
```
Warning: Unknown rule 'unknown-rule' in configuration
Warning: Invalid severity 'critical' for rule 'file-size'. Expected: error, warning, info
```