import type { CodeBlock } from '../../domain/CodeBlock.js';
import type { Violation } from '../../domain/Violation.js';

/**
 * Ambient information a {@link LanguageValidator} needs from the owning rule to
 * produce violations, without depending on the rule itself.
 *
 * @remarks
 * Keeping validators free of a back-reference to `CodeBlockRule` makes each one
 * a pure, independently testable strategy. Everything a validator needs about
 * the surrounding rule invocation travels through this context.
 */
export interface ValidationContext {
  /** The owning rule's id, stamped onto every emitted {@link Violation}. */
  readonly ruleId: string;
  /**
   * Whether strict-mode checks are enabled. Currently only tightens a couple of
   * JavaScript/TypeScript checks (e.g. `var` becomes an error, missing
   * semicolons are reported).
   */
  readonly strict: boolean;
}

/**
 * A strategy that validates code blocks of a single family of languages.
 *
 * @remarks
 * Each language's rules live in their own module implementing this interface,
 * so `CodeBlockRule` stays a thin orchestrator: it extracts code blocks, looks
 * up the validator for a block's language, and delegates. Validators are pure
 * and stateless — configuration arrives via {@link ValidationContext}.
 */
export interface LanguageValidator {
  /** Validate a single code block, returning any violations it contains. */
  validate(block: CodeBlock, context: ValidationContext): Violation[];

  /**
   * Optional cross-block validation over every block of this validator's
   * language(s) in a file — used for checks that only make sense in aggregate,
   * such as consistent style across all JavaScript/TypeScript blocks.
   */
  validateConsistency?(
    blocks: CodeBlock[],
    context: ValidationContext
  ): Violation[];
}
