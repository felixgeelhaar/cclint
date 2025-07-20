import { ContextFile } from './ContextFile.js';
import { Violation } from './Violation.js';

export interface Rule {
  readonly id: string;
  readonly description: string;

  lint(file: ContextFile): Violation[];
}
