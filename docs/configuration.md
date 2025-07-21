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
  "ignore": ["pattern"]
}
```

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

Use the `ignore` array to skip files or directories:

```json
{
  "ignore": [
    "node_modules/",
    "dist/",
    "*.backup.md",
    "temp/**"
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

## CLI Override

Configuration file settings can be overridden via CLI options:

```bash
# Override max-size from config
cclint lint CLAUDE.md --max-size 8000

# Use specific config file
cclint lint CLAUDE.md --config ./custom-config.json

# Enable auto-fix regardless of config
cclint lint CLAUDE.md --fix
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