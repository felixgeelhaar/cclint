import type { Position } from 'mutation-testing-report-schema/api';
export declare const ProgrammingLanguage: {
    readonly csharp: "cs";
    readonly java: "java";
    readonly javascript: "javascript";
    readonly html: "html";
    readonly php: "php";
    readonly scala: "scala";
    readonly typescript: "typescript";
    readonly vue: "vue";
    readonly gherkin: "gherkin";
    readonly svelte: "svelte";
    readonly rust: "rust";
    readonly python: "python";
};
export type ProgrammingLanguage = (typeof ProgrammingLanguage)[keyof typeof ProgrammingLanguage];
/**
 * Returns the lower case extension without the `.`.
 * @param fileName The file name
 * @returns File extension
 */
export declare function getExtension(fileName: string): string;
/**
 * Determines the programming language based on file extension.
 */
export declare function determineLanguage(fileName: string): ProgrammingLanguage | undefined;
export declare function highlightCode(code: string, fileName: string): string;
export interface PositionWithOffset extends Position {
    offset: number;
}
/**
 * A simple HTML tag representation
 */
export interface HtmlTag {
    id?: string | number;
    elementName: string;
    attributes?: Record<string, string | number>;
    isClosing?: true;
}
/**
 * Takes in a highlighted source and transforms into individual lines.
 *
 * Example:
 * ```js
 * `<span class="token comment">/* some
 * multiline comment
 * * /</span>
 * <span class="token identifier">foo</token>`
 * ```
 *
 * Becomes:
 * ```js
 * [
 *   '<span class="token comment">/* some</span>',
 *   '<span class="token comment">multiline comment</span>',
 *   '<span class="token comment">* /</span>',
 *   '<span class="token identifier">foo</token>'
 * ]
 * ```
 *
 * It also allows callers to add background coloring spans.
 *
 * It does this by using a _very simple_ and _very limited_ html parser that understands text with span elements, just enough for highlighted html.
 *
 * @param source The highlighted source
 * @param visitor The visitor function that is executed for each position in the source code and allows callers to inject a marker css class
 * @returns the highlighted source split into lines
 */
export declare function transformHighlightedLines(source: string, visitor?: (pos: PositionWithOffset) => Iterable<HtmlTag>): string[];
export declare function isWhitespace(char: string): char is "\n" | " " | "\t";
export declare const COLUMN_START_INDEX = 1;
export declare const LINE_START_INDEX = 1;
export declare function findDiffIndices(original: string, mutated: string): number[];
export declare function gte(a: Position, b: Position): boolean;
//# sourceMappingURL=code-helpers.d.ts.map