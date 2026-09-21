import type { PropertyValues } from 'lit';
import type { MetricsResult, TestFileModel, TestMetrics } from 'mutation-testing-metrics';
import type { DrawerMode } from '../drawer/drawer.component.js';
import { RealTimeElement } from '../real-time-element.js';
export declare class MutationTestReportTestViewComponent extends RealTimeElement {
    #private;
    drawerMode: DrawerMode;
    result: MetricsResult<TestFileModel, TestMetrics>;
    path: string[];
    private selectedTest?;
    constructor();
    updated(changes: PropertyValues<this>): void;
    render(): import("lit").TemplateResult<1>;
}
//# sourceMappingURL=test-view.d.ts.map