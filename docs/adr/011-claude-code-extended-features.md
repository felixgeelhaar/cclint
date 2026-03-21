# ADR 011 - Claude Code Extended Features Alignment (v0.11.0)

**Status**: Accepted

**Date**: 2026-03-21

**Authors**: Claude Code Agent

## Context

Anthropic has expanded Claude Code with several new features that complement CLAUDE.md:

1. **Skills** (`.claude/skills/*.md`): Domain knowledge and reusable workflows
2. **Subagents** (`.claude/agents/*.md`): Specialized assistants with isolated contexts
3. **Hooks** (`.claude/settings.json`): Deterministic actions at workflow points
4. **Plugins**: Bundled skills, hooks, and MCP servers

Current cclint coverage (from ADR 006):

- ✅ Import syntax validation
- ✅ Content organization rules
- ✅ File location validation
- ✅ Vague language detection
- ❌ Skills structure validation
- ❌ Subagent configuration validation
- ❌ Hook configuration validation
- ❌ Plugin manifest validation

These new features are becoming standard patterns in well-configured Claude Code projects. The linter should help users create valid configurations and avoid common mistakes.

## Decision

Implement three new rules to achieve comprehensive Anthropic alignment:

### 1. SkillStructureRule

Validates `.claude/skills/*.md` files:

```typescript
interface SkillFrontmatter {
  name: string; // Required, kebab-case
  description: string; // Required, concise
  disable_model_invocation?: boolean;
}

// Validation checks:
// - Frontmatter presence and validity
// - Name format (kebab-case)
// - Description length (10-200 chars)
// - Proper SKILL.md structure
// - File naming matches frontmatter name
```

**Violations:**

- Missing or invalid frontmatter
- Invalid name format (spaces, uppercase, special chars)
- Description too short/long
- Missing required sections
- Circular skill references

### 2. SubagentStructureRule

Validates `.claude/agents/*.md` files:

```typescript
interface AgentFrontmatter {
  name: string; // Required
  description: string; // Required
  tools?: string[]; // Allowed tools list
  model?: string; // claude-3-5-sonnet, opus, etc.
}

// Validation checks:
// - Frontmatter presence
// - Name uniqueness across agents
// - Tool whitelist validation
// - Model identifier validity
// - Prompt structure requirements
```

**Violations:**

- Missing required frontmatter fields
- Duplicate agent names
- Invalid tool names
- Unknown model identifiers
- Missing prompt content

### 3. HookConfigurationRule

Validates `.claude/settings.json` for hook configurations:

```typescript
interface HookDefinition {
  matcher: string; // File pattern (e.g., "*.ts")
  command: string[]; // Commands to run
  cwd?: string; // Working directory
}

// Validation checks:
// - Valid JSON structure
// - Hook matcher patterns
// - Command safety (no dangerous commands)
```

**Violations:**

- Invalid JSON syntax
- Dangerous command detection (rm -rf, curl | sh, etc.)
- Invalid matcher patterns
- Missing required fields

## Implementation Details

### Rule Registration

New rules in `RulesEngine`:

```typescript
// Default enabled with config options
if (config.rules['skill-structure']?.enabled !== false) {
  rules.push(new SkillStructureRule());
}
if (config.rules['subagent-structure']?.enabled !== false) {
  rules.push(new SubagentStructureRule());
}
if (config.rules['hook-configuration']?.enabled !== false) {
  rules.push(new HookConfigurationRule());
}
```

### Configuration Schema

```json
{
  "rules": {
    "skill-structure": {
      "enabled": true,
      "options": {
        "requireDescription": true,
        "maxDescriptionLength": 200
      }
    },
    "subagent-structure": {
      "enabled": true,
      "options": {
        "allowDangerousTools": false
      }
    },
    "hook-configuration": {
      "enabled": true,
      "options": {
        "dangerousCommands": ["rm -rf", "curl | sh"]
      }
    }
  }
}
```

### File Detection

Rules apply to files matching patterns:

- `**/.claude/skills/**/*.md`
- `**/.claude/agents/**/*.md`
- `**/.claude/settings.json`

## Alternatives Considered

### Alternative 1: Single "ClaudeConfigRule"

Combine all extended features into one rule with sub-checks.

**Rejected**: Violates single responsibility. Different features have different validation requirements. Combining them makes configuration and debugging harder.

### Alternative 2: Only Lint CLAUDE.md References

Only validate skills/agents mentioned in CLAUDE.md files.

**Rejected**: Validating actual skill/agent files ensures they work when invoked directly via `/skill-name` or subagent delegation.

## Consequences

### Positive Consequences

- **11/10 Anthropic alignment** (up from 9.5/10)
- **Early error detection** before invoking skills/agents
- **Configuration quality improvement** across the ecosystem
- **Consistent patterns** for team collaboration

### Negative Consequences

- **Increased rule count** may overwhelm new users
- **File system access required** for full validation
- **Schema coupling** to Anthropic's evolving formats

### Neutral Consequences

- Rules are opt-in for specific file paths
- Does not affect existing CLAUDE.md linting

## Follow-up Actions

- [x] Create SkillStructureRule with frontmatter and structure validation
- [x] Create SubagentStructureRule with frontmatter and prompt validation
- [x] Create HookConfigurationRule with JSON parsing and command safety
- [x] Add configuration schema for new rules
- [x] Write unit tests for each rule
- [x] Add integration tests with fixture files
- [x] Update documentation for new rules

## References

- [Anthropic Skills Documentation](https://docs.anthropic.com/en/docs/claude-code/skills)
- [Anthropic Subagents Documentation](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [Anthropic Hooks Guide](https://docs.anthropic.com/en/docs/claude-code/hooks-guide)
- [Anthropic Plugins](https://docs.anthropic.com/en/docs/claude-code/plugins)
- ADR 006: Anthropic Alignment (v0.5.0)
- ADR 003: Hexagonal Architecture
