import type { PropertyValues, TemplateResult } from 'lit';
import { RealTimeElement } from '../real-time-element.js';
export interface StateFilter<TStatus> {
    status: TStatus;
    count: number;
    enabled: boolean;
    label: TemplateResult<1> | string;
    context: string;
}
export declare class FileStateFilterComponent<TStatus extends string> extends RealTimeElement {
    #private;
    filters?: StateFilter<TStatus>[];
    updated(changedProperties: PropertyValues<this>): void;
    render(): TemplateResult<1>;
}
//# sourceMappingURL=state-filter.component.d.ts.map