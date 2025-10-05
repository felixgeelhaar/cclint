# ADR 006: Anthropic Official Guidance Alignment (v0.5.0)

## Status

Accepted

## Context

Anthropic has published official documentation for CLAUDE.md files with specific best practices and new features:

1. **Import Syntax** (New Feature): `@path/to/file` syntax for importing files (max 5 hops)
2. **Memory Hierarchy**: Enterprise → User → Project → Local (deprecated)
3. **Best Practices**:
   - Be specific: "Use 2-space indentation" vs "Format properly"
   - Use structure: Bullet points, markdown headings
   - Add emphasis: IMPORTANT, YOU MUST for critical instructions
   - Avoid vague language
4. **Known Issues**: Missing language tags on code blocks, inconsistent spacing
5. **File Locations**:
   - Project: `./CLAUDE.md` or `./.claude/CLAUDE.md`
   - User: `~/.claude/CLAUDE.md`
   - Local: `CLAUDE.local.md` (DEPRECATED - use imports instead)

The original ContentRule was too opinionated with hardcoded technology checks (npm, TypeScript, test, build) that don't align with Anthropic's flexible, project-agnostic approach.

## Decision

Implement three new rules to achieve near-perfect alignment with Anthropic's official guidance:

### 1. ImportSyntaxRule

Validates the new `@path/to/file` import syntax:

- Detects imports outside code blocks/spans (per Anthropic spec)
- Validates path formats (relative, absolute, home directory)
- Warns about duplicate imports
- Checks for max depth violations (5 hops limit)
- Provides helpful error messages for common mistakes

### 2. ContentOrganizationRule

Replaces ContentRule with content quality validation:

- **Heading hierarchy**: Checks proper h1 → h2 → h3 progression
- **Bullet points**: Suggests bullets for sections with 3+ lines
- **Vague language detection**: Flags terms like "properly", "correctly", "good"
- **Emphasis checking**: Suggests IMPORTANT/YOU MUST for critical items
- **Specificity validation**: Ensures format instructions have measurements/tools

### 3. FileLocationRule

Validates file placement and naming:

- **Deprecation warnings**: CLAUDE.local.md → import syntax migration
- **Naming validation**: Only applies to CLAUDE.md/CLAUDE.local.md files
- **Location guidance**: Provides recommendations based on content
- **Git awareness**: Suggests .gitignore for personal content

### 4. ContentRule Deprecation

- Mark as `@deprecated` with migration guidance
- Keep for backward compatibility
- Document replacement: Use ContentOrganizationRule instead

## Implementation Details

### Rule Configuration

New rules are enabled by default:

```typescript
if (config.rules['import-syntax']?.enabled !== false) {
  rules.push(new ImportSyntaxRule(maxDepth));
}
if (config.rules['file-location']?.enabled !== false) {
  rules.push(new FileLocationRule());
}
```

### Backward Compatibility

Support both old and new rule names:

```typescript
// Support 'content' (old) or 'content-organization' (new)
if (
  config.rules['content']?.enabled ||
  config.rules['content-organization']?.enabled
) {
  rules.push(new ContentOrganizationRule());
}
```

### Type Safety

Proper bracket notation for index signatures:

```typescript
const maxDepth =
  typeof importOptions['maxDepth'] === 'number'
    ? importOptions['maxDepth']
    : undefined;
```

## Consequences

### Positive

- **9.5/10 alignment** with Anthropic's official guidance (up from 8.5/10)
- **Import syntax support**: Ready for Anthropic's new feature
- **Better content quality**: Specific, actionable violations instead of generic tech checks
- **Migration path**: Clear deprecation warnings guide users to new patterns
- **Flexible validation**: No technology-specific assumptions

### Negative

- **Breaking change potential**: ContentOrganizationRule has different validation logic than ContentRule
- **More INFO violations**: Content quality checks generate more informational messages
- **Learning curve**: Users need to understand new rules and import syntax

### Mitigation

1. **Backward compatibility**: Keep ContentRule with deprecation notice
2. **Clear documentation**: Provide migration examples and reasoning
3. **Graduated severity**: Most new checks are INFO/WARNING, not ERROR
4. **Selective application**: FileLocationRule only validates CLAUDE.md files

## References

- [Anthropic CLAUDE.md Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Memory Documentation](https://docs.claude.com/en/docs/claude-code/memory)
- [Import Syntax Specification](https://docs.claude.com/en/docs/claude-code/memory#claude-md-imports)
- ADR 001: Vitest over Jest
- ADR 002: ESM-only Architecture
- ADR 003: Hexagonal Architecture
