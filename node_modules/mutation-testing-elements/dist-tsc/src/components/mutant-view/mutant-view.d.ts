import type { PropertyValues } from 'lit';
import type { FileUnderTestModel, Metrics, MetricsResult } from 'mutation-testing-metrics';
import type { Thresholds } from 'mutation-testing-report-schema/api';
import type { DrawerMode } from '../drawer/drawer.component.js';
import { RealTimeElement } from '../real-time-element.js';
export declare class MutationTestReportMutantViewComponent extends RealTimeElement {
    #private;
    drawerMode: DrawerMode;
    private selectedMutant?;
    result: MetricsResult<FileUnderTestModel, Metrics>;
    thresholds: Thresholds;
    path: string[];
    constructor();
    updated(changes: PropertyValues<this>): void;
    render(): import("lit").TemplateResult<1>;
}
//# sourceMappingURL=mutant-view.d.ts.map