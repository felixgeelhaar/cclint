/**
 * Detailed metadata about a linting rule
 */
export interface RuleMetadata {
  /** Rule identifier (e.g., 'format', 'structure') */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Brief description of what the rule checks */
  description: string;
  /** Detailed explanation of the rule */
  rationale: string;
  /** Whether the rule can auto-fix violations */
  fixable: boolean;
  /** Default severity level */
  defaultSeverity: 'error' | 'warning' | 'info';
  /** Example of code that violates the rule */
  badExamples: Array<{
    code: string;
    explanation: string;
  }>;
  /** Example of code that follows the rule */
  goodExamples: Array<{
    code: string;
    explanation: string;
  }>;
  /** Configuration options for the rule */
  options?: Array<{
    name: string;
    type: string;
    default: string | number | boolean;
    description: string;
  }>;
  /** Related rules */
  related?: string[];
  /** Links to documentation */
  references?: string[];
}

/**
 * Registry of all rule metadata
 */
export const RULE_METADATA: Record<string, RuleMetadata> = {
  'file-size': {
    id: 'file-size',
    name: 'File Size',
    description: 'Enforces maximum file size for CLAUDE.md files',
    rationale:
      'Large CLAUDE.md files can exceed context window limits and become difficult to maintain. ' +
      'Keeping files concise ensures they remain effective as AI context.',
    fixable: false,
    defaultSeverity: 'error',
    badExamples: [
      {
        code: '# Project (10,000+ characters of content...)',
        explanation:
          'Files exceeding the maximum size limit may be truncated or cause performance issues.',
      },
    ],
    goodExamples: [
      {
        code: '# Project\\n\\nConcise, focused documentation...',
        explanation:
          'Keep CLAUDE.md files focused on essential context that fits within limits.',
      },
    ],
    options: [
      {
        name: 'maxSize',
        type: 'number',
        default: 10000,
        description: 'Maximum file size in characters',
      },
    ],
    related: ['structure', 'content-organization'],
  },

  structure: {
    id: 'structure',
    name: 'Document Structure',
    description: 'Validates required sections and document organization',
    rationale:
      'A well-structured CLAUDE.md file helps AI assistants quickly understand project context. ' +
      'Required sections ensure essential information is always present.',
    fixable: false,
    defaultSeverity: 'error',
    badExamples: [
      {
        code: 'Just some random text without headers...',
        explanation:
          'Missing required sections like title and project overview.',
      },
      {
        code: '## Subsection\\n\\nContent without main title',
        explanation: 'Document should start with a main title (# header).',
      },
    ],
    goodExamples: [
      {
        code: '# Project Name\\n\\n## Overview\\n\\nProject description...',
        explanation: 'Clear structure with title and organized sections.',
      },
    ],
    related: ['content-organization', 'format'],
  },

  format: {
    id: 'format',
    name: 'Markdown Format',
    description: 'Validates markdown syntax and formatting conventions',
    rationale:
      'Consistent markdown formatting improves readability and ensures proper parsing. ' +
      'Well-formatted documents are easier for both humans and AI to process.',
    fixable: true,
    defaultSeverity: 'warning',
    badExamples: [
      {
        code: '##Missing space',
        explanation: 'Headers require a space after the # symbols.',
      },
      {
        code: '# Title   ',
        explanation: 'Lines should not have trailing whitespace.',
      },
      {
        code: '```unknownlang\\ncode\\n```',
        explanation: 'Use recognized language identifiers for code blocks.',
      },
    ],
    goodExamples: [
      {
        code: '## Properly Spaced Header',
        explanation: 'Headers have proper spacing after #.',
      },
      {
        code: '```javascript\\nconst x = 1;\\n```',
        explanation: 'Code blocks use recognized language identifiers.',
      },
    ],
    related: ['code-blocks', 'structure'],
  },

  'code-blocks': {
    id: 'code-blocks',
    name: 'Code Blocks',
    description: 'Validates code block syntax and language specifications',
    rationale:
      'Properly formatted code blocks with language specifications enable syntax highlighting ' +
      'and help AI understand the context of code examples.',
    fixable: true,
    defaultSeverity: 'warning',
    badExamples: [
      {
        code: '```\\ncode without language\\n```',
        explanation:
          'Code blocks should specify a language for syntax highlighting.',
      },
      {
        code: '```javascript\\nconst x = 1;\\n// missing closing',
        explanation: 'Code blocks must be properly closed.',
      },
    ],
    goodExamples: [
      {
        code: '```typescript\\nconst greeting: string = "hello";\\n```',
        explanation: 'Code block with proper language identifier and closing.',
      },
    ],
    options: [
      {
        name: 'requireLanguage',
        type: 'boolean',
        default: true,
        description: 'Require language specification for code blocks',
      },
      {
        name: 'allowedLanguages',
        type: 'string[]',
        default: '[]',
        description: 'Restrict to specific languages (empty = all allowed)',
      },
    ],
    related: ['format'],
  },

  'import-syntax': {
    id: 'import-syntax',
    name: 'Import Syntax',
    description: 'Validates @import directive syntax for including other files',
    rationale:
      'The @import directive allows modular CLAUDE.md organization. Proper syntax ensures ' +
      'imports are correctly resolved and processed.',
    fixable: false,
    defaultSeverity: 'error',
    badExamples: [
      {
        code: '@import missing/quotes',
        explanation: 'Import paths must be quoted.',
      },
      {
        code: '@import "../../../deeply/nested/file.md"',
        explanation:
          'Excessive directory traversal may indicate import issues.',
      },
    ],
    goodExamples: [
      {
        code: '@import "./common/rules.md"',
        explanation: 'Properly quoted relative import path.',
      },
      {
        code: '@import "../shared/conventions.md"',
        explanation: 'Parent directory imports within reasonable depth.',
      },
    ],
    options: [
      {
        name: 'maxDepth',
        type: 'number',
        default: 3,
        description: 'Maximum allowed directory traversal depth',
      },
    ],
    related: ['import-resolution', 'file-location'],
  },

  'import-resolution': {
    id: 'import-resolution',
    name: 'Import Resolution',
    description: 'Validates that @import paths resolve to existing files',
    rationale:
      'Import paths must point to actual files for the modular system to work. ' +
      'This rule catches broken imports before they cause runtime errors.',
    fixable: false,
    defaultSeverity: 'error',
    badExamples: [
      {
        code: '@import "./nonexistent.md"',
        explanation: 'Import points to a file that does not exist.',
      },
    ],
    goodExamples: [
      {
        code: '@import "./README.md"  # existing file',
        explanation: 'Import points to an existing file in the project.',
      },
    ],
    related: ['import-syntax', 'file-location'],
  },

  'file-location': {
    id: 'file-location',
    name: 'File Location',
    description: 'Validates CLAUDE.md is in appropriate locations',
    rationale:
      'CLAUDE.md files should be placed in root directories or recognized subdirectories ' +
      'to ensure they are discovered and processed correctly.',
    fixable: false,
    defaultSeverity: 'warning',
    badExamples: [
      {
        code: 'src/utils/helpers/CLAUDE.md',
        explanation:
          'CLAUDE.md in a deeply nested utility folder may not be discovered.',
      },
    ],
    goodExamples: [
      {
        code: 'CLAUDE.md  # in project root',
        explanation: 'Root-level CLAUDE.md is always discovered.',
      },
      {
        code: 'packages/api/CLAUDE.md  # in monorepo package',
        explanation: 'Package-level CLAUDE.md in monorepo structure.',
      },
    ],
    related: ['monorepo-hierarchy'],
  },

  'content-appropriateness': {
    id: 'content-appropriateness',
    name: 'Content Appropriateness',
    description: 'Validates content is appropriate for AI context files',
    rationale:
      'CLAUDE.md files should contain project context, not secrets, credentials, or ' +
      'inappropriate content that could be exposed or misused.',
    fixable: false,
    defaultSeverity: 'error',
    badExamples: [
      {
        code: 'API_KEY=sk-1234567890abcdef',
        explanation: 'Secrets and credentials should never be in CLAUDE.md.',
      },
      {
        code: 'password: admin123',
        explanation: 'Passwords and sensitive data should be excluded.',
      },
    ],
    goodExamples: [
      {
        code: 'API_KEY: Use environment variable $API_KEY',
        explanation:
          'Reference environment variables instead of actual values.',
      },
      {
        code: 'See .env.example for required configuration',
        explanation: 'Point to template files for configuration examples.',
      },
    ],
    related: ['command-safety'],
  },

  'monorepo-hierarchy': {
    id: 'monorepo-hierarchy',
    name: 'Monorepo Hierarchy',
    description: 'Validates CLAUDE.md hierarchy in monorepo structures',
    rationale:
      'In monorepos, CLAUDE.md files should form a proper hierarchy with root context ' +
      'and package-specific context that complements rather than duplicates.',
    fixable: false,
    defaultSeverity: 'warning',
    badExamples: [
      {
        code: '# packages/api/CLAUDE.md duplicates root info',
        explanation:
          'Package CLAUDE.md should add specific context, not duplicate root.',
      },
    ],
    goodExamples: [
      {
        code: '# API Package\\n\\n@import "../../CLAUDE.md"\\n\\n## API-Specific Context',
        explanation:
          'Package imports root context and adds specific information.',
      },
    ],
    related: ['file-location', 'import-resolution'],
  },

  'command-safety': {
    id: 'command-safety',
    name: 'Command Safety',
    description: 'Validates that documented commands are safe to execute',
    rationale:
      'Commands in CLAUDE.md may be executed by AI assistants. This rule flags potentially ' +
      'dangerous commands that could harm the system or data.',
    fixable: false,
    defaultSeverity: 'warning',
    badExamples: [
      {
        code: '```bash\\nrm -rf /\\n```',
        explanation: 'Destructive commands that could delete system files.',
      },
      {
        code: '```bash\\nsudo chmod 777 /etc\\n```',
        explanation: 'Overly permissive permission changes.',
      },
    ],
    goodExamples: [
      {
        code: '```bash\\nnpm test\\n```',
        explanation: 'Safe development commands with clear purpose.',
      },
      {
        code: '```bash\\n# Clean build artifacts\\nrm -rf dist/\\n```',
        explanation: 'Scoped deletion with clear intent documented.',
      },
    ],
    related: ['content-appropriateness'],
  },

  'content-organization': {
    id: 'content-organization',
    name: 'Content Organization',
    description: 'Validates logical organization and flow of content',
    rationale:
      'Well-organized content with clear sections and logical flow helps AI understand ' +
      'the project context more effectively.',
    fixable: false,
    defaultSeverity: 'warning',
    badExamples: [
      {
        code: 'Random info\\n# Title\\nMore random info',
        explanation: 'Content before the main title disrupts document flow.',
      },
    ],
    goodExamples: [
      {
        code: '# Title\\n\\n## Section 1\\n\\nContent...\\n\\n## Section 2\\n\\nMore content...',
        explanation:
          'Logical progression from title through organized sections.',
      },
    ],
    related: ['structure', 'format'],
  },
};

/**
 * Get metadata for a specific rule
 */
export function getRuleMetadata(ruleId: string): RuleMetadata | undefined {
  return RULE_METADATA[ruleId];
}

/**
 * Get all available rule IDs
 */
export function getAllRuleIds(): string[] {
  return Object.keys(RULE_METADATA);
}

/**
 * Check if a rule exists
 */
export function isValidRule(ruleId: string): boolean {
  return ruleId in RULE_METADATA;
}
