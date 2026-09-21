import type { PropertyValues } from 'lit';
import type { MetricsResult } from 'mutation-testing-metrics';
import type { Thresholds } from 'mutation-testing-report-schema/api';
import { RealTimeElement } from '../real-time-element.js';
export type TableWidth = 'normal' | 'large';
export type ColumnCategory = 'percentage' | 'number';
export type Numbers<TMetrics> = {
    [Prop in keyof TMetrics as TMetrics[Prop] extends number ? Prop : never]: TMetrics[Prop];
};
export interface Column<TMetric> {
    key: keyof Numbers<TMetric>;
    label: string;
    tooltip?: string;
    width?: TableWidth;
    category: ColumnCategory;
    isBold?: true;
    group?: string;
}
export declare class MutationTestReportTestMetricsTable<TFile, TMetric> extends RealTimeElement {
    #private;
    model?: MetricsResult<TFile, TMetric>;
    currentPath: string[];
    columns: Column<TMetric>[];
    thresholds: Thresholds;
    constructor();
    willUpdate(changedProperties: PropertyValues<this>): void;
    render(): import("lit").TemplateResult<1> | undefined;
}
//# sourceMappingURL=metrics-table.component.d.ts.map