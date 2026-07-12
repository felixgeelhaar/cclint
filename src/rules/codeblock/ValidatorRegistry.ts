import type { LanguageValidator } from './LanguageValidator.js';
import { JavaScriptValidator } from './validators/JavaScriptValidator.js';
import { PythonValidator } from './validators/PythonValidator.js';
import { GoValidator } from './validators/GoValidator.js';
import { BashValidator } from './validators/BashValidator.js';
import { SqlValidator } from './validators/SqlValidator.js';
import { JsonValidator } from './validators/JsonValidator.js';
import { YamlValidator } from './validators/YamlValidator.js';

/**
 * Binds one validator to the language identifier(s) it handles.
 *
 * @remarks
 * A single validator can serve several languages — `JavaScriptValidator`
 * handles both `javascript` and `typescript`, which is also the grouping used
 * for cross-block consistency checks.
 */
export interface ValidatorRegistration {
  readonly languages: readonly string[];
  readonly validator: LanguageValidator;
}

/**
 * Maps normalized language identifiers to the {@link LanguageValidator} that
 * handles them.
 *
 * @remarks
 * This is the one place that knows which validator owns which language, so
 * adding a language means adding a validator module and a single registration
 * — `CodeBlockRule` never grows a `switch`.
 */
export class ValidatorRegistry {
  private readonly byLanguage = new Map<string, LanguageValidator>();
  private readonly registeredGroups: readonly ValidatorRegistration[];

  constructor(registrations: readonly ValidatorRegistration[]) {
    this.registeredGroups = registrations;
    for (const { languages, validator } of registrations) {
      for (const language of languages) {
        this.byLanguage.set(language, validator);
      }
    }
  }

  /** The validator for a language, or `undefined` when none is registered. */
  public get(language: string): LanguageValidator | undefined {
    return this.byLanguage.get(language);
  }

  /** All registrations, in declaration order, for cross-block passes. */
  public groups(): readonly ValidatorRegistration[] {
    return this.registeredGroups;
  }
}

/**
 * Build the registry of built-in language validators.
 *
 * @remarks
 * `javascript` and `typescript` deliberately share one validator instance so
 * their blocks are validated identically and grouped together for
 * consistency checks.
 */
export function createDefaultValidatorRegistry(): ValidatorRegistry {
  return new ValidatorRegistry([
    {
      languages: ['javascript', 'typescript'],
      validator: new JavaScriptValidator(),
    },
    { languages: ['python'], validator: new PythonValidator() },
    { languages: ['go'], validator: new GoValidator() },
    { languages: ['bash'], validator: new BashValidator() },
    { languages: ['sql'], validator: new SqlValidator() },
    { languages: ['json'], validator: new JsonValidator() },
    { languages: ['yaml'], validator: new YamlValidator() },
  ]);
}
