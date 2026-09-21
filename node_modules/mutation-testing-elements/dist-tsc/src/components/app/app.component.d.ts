import type { PropertyValues } from 'lit';
import type { FileUnderTestModel, Metrics, MetricsResult, MutationTestMetricsResult, TestFileModel, TestMetrics } from 'mutation-testing-metrics';
import type { MutationTestResult } from 'mutation-testing-report-schema/api';
import type { MteCustomEvent } from '../../lib/custom-events.js';
import { View } from '../../lib/router.js';
import type { Theme } from '../../lib/theme.js';
import { RealTimeElement } from '../real-time-element.js';
interface BaseContext {
    view: View;
    path: string[];
}
interface MutantContext extends BaseContext {
    view: 'mutant';
    result?: MetricsResult<FileUnderTestModel, Metrics>;
}
interface TestContext extends BaseContext {
    view: 'test';
    result?: MetricsResult<TestFileModel, TestMetrics>;
}
type Context = MutantContext | TestContext;
export declare class MutationTestReportAppComponent extends RealTimeElement {
    #private;
    report: MutationTestResult | undefined;
    rootModel: MutationTestMetricsResult | undefined;
    src: string | undefined;
    sse: string | undefined;
    errorMessage: string | undefined;
    context: Context;
    path: readonly string[];
    titlePostfix: string | undefined;
    theme?: Theme;
    get themeBackgroundColor(): string;
    private filePicker;
    get title(): string;
    constructor();
    firstUpdated(): void;
    willUpdate(changedProperties: PropertyValues<this>): void;
    updated(changedProperties: PropertyValues<this>): void;
    themeSwitch: (event: MteCustomEvent<"theme-switch">) => void;
    static styles: import("lit").CSSResult[];
    connectedCallback(): void;
    disconnectedCallback(): void;
    render(): import("lit").TemplateResult<1> | undefined;
}
declare global {
    interface HTMLElementTagNameMap {
        'mutation-test-report-app': MutationTestReportAppComponent;
    }
}
export {};
//# sourceMappingURL=app.component.d.ts.map