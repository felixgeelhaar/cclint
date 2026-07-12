import type { Rule } from '../domain/Rule.js';
import { ContextFile } from '../domain/ContextFile.js';
import { Violation } from '../domain/Violation.js';
import { Severity } from '../domain/Severity.js';
import { CodeBlockExtractor } from '../infrastructure/CodeBlockExtractor.js';
import type { ValidationContext } from './codeblock/LanguageValidator.js';
import {
  ValidatorRegistry,
  createDefaultValidatorRegistry,
} from './codeblock/ValidatorRegistry.js';

/**
 * Rule that validates code blocks within CLAUDE.md files.
 *
 * @remarks
 * This is a thin orchestrator: it extracts code blocks, applies the
 * language-agnostic checks (untyped fences, incompleteness, unmarked
 * anti-patterns), and delegates language-specific validation to per-language
 * {@link LanguageValidator} strategies resolved through a
 * {@link ValidatorRegistry}.
 */
export class CodeBlockRule implements Rule {
  public readonly id = 'code-blocks';
  public readonly description =
    'Validates code blocks for syntax and best practices';

  private extractor: CodeBlockExtractor;
  private enabledLanguages: Set<string>;
  private strictMode: boolean;
  private registry: ValidatorRegistry;

  constructor(options?: CodeBlockRuleOptions) {
    this.extractor = new CodeBlockExtractor();
    this.enabledLanguages = new Set(
      options?.languages ?? [
        'javascript',
        'typescript',
        'python',
        'go',
        'bash',
        'sql',
        'yaml',
        'json',
      ]
    );
    this.strictMode = options?.strict ?? true;
    this.registry = createDefaultValidatorRegistry();
  }

  public appliesTo(file: ContextFile): boolean {
    return file.isMarkdown();
  }

  public lint(file: ContextFile): Violation[] {
    const violations: Violation[] = [];
    const codeBlocks = this.extractor.extractCodeBlocks(file);
    const context: ValidationContext = {
      ruleId: this.id,
      strict: this.strictMode,
    };

    // Check for code blocks without language specification
    for (const block of codeBlocks) {
      if (block.language === 'text' || block.language === '') {
        violations.push(
          new Violation(
            this.id,
            `Code block at line ${block.location.line} should specify a language`,
            Severity.WARNING,
            block.location
          )
        );
      }
    }

    // Validate each code block based on its language
    for (const block of codeBlocks) {
      if (!this.enabledLanguages.has(block.language)) {
        continue;
      }

      // Check for incomplete code blocks
      if (!block.isComplete) {
        violations.push(
          new Violation(
            this.id,
            `Incomplete ${block.getLanguageDisplayName()} code block at line ${block.location.line} contains placeholder content`,
            Severity.WARNING,
            block.location
          )
        );
      }

      // Language-specific validation, delegated to the registered validator
      const validator = this.registry.get(block.language);
      if (validator) {
        violations.push(...validator.validate(block, context));
      }

      // Check for anti-patterns marked as examples
      if (
        block.metadata.isAntiPattern &&
        !block.context.toLowerCase().includes('bad') &&
        !block.context.toLowerCase().includes('wrong') &&
        !block.context.toLowerCase().includes('anti-pattern')
      ) {
        violations.push(
          new Violation(
            this.id,
            `Code block at line ${block.location.line} appears to be an anti-pattern but is not clearly marked as such`,
            Severity.WARNING,
            block.location
          )
        );
      }
    }

    // Cross-block checks (e.g. consistent JavaScript/TypeScript style)
    for (const group of this.registry.groups()) {
      const { validator, languages } = group;
      if (typeof validator.validateConsistency !== 'function') {
        continue;
      }
      const groupBlocks = codeBlocks.filter(b =>
        languages.includes(b.language)
      );
      if (groupBlocks.length > 1) {
        violations.push(...validator.validateConsistency(groupBlocks, context));
      }
    }

    return violations;
  }
}

export interface CodeBlockRuleOptions {
  /** Languages to validate */
  languages?: string[];
  /** Enable strict mode checks */
  strict?: boolean;
}
