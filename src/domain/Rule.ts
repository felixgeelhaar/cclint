import { ContextFile } from './ContextFile.js';
import { Violation } from './Violation.js';

export interface Rule {
  readonly id: string;
  readonly description: string;

  lint(file: ContextFile): Violation[];

  /**
   * Whether this rule applies to the given file.
   *
   * @remarks
   * Optional. When omitted, the rule applies to every linted file (the default,
   * backward-compatible behavior). Rules that only make sense for a specific
   * file kind (e.g. Markdown-document structure rules, or settings-file rules)
   * implement this so the {@link RulesEngine} skips them for other files —
   * preventing false positives such as "missing section" warnings on a
   * `settings.json`.
   */
  appliesTo?(file: ContextFile): boolean;
}
