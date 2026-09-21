import type { TemplateResult } from 'lit';
import { nothing } from 'lit';
export declare function renderDots(dots: typeof nothing | TemplateResult, finalDots: typeof nothing | TemplateResult): typeof nothing | TemplateResult<1>;
export declare function renderLine(line: string, dots: TemplateResult | typeof nothing): TemplateResult<1>;
export declare const triangle: TemplateResult<2>;
export declare const circle: TemplateResult<2>;
/**
 * Animate a svg element that has a path.animate child
 */
export declare function beginElementAnimation(root: ParentNode | undefined, prop: string, value: string): void;
//# sourceMappingURL=util.d.ts.map