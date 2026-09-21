import type { PropertyValues } from 'lit';
import type { FileUnderTestModel, MutantModel } from 'mutation-testing-metrics';
import type { MutantStatus } from 'mutation-testing-report-schema/api';
import { RealTimeElement } from '../real-time-element.js';
import type { StateFilter } from '../state-filter/state-filter.component.js';
export declare class FileComponent extends RealTimeElement {
    #private;
    static styles: import("lit").CSSResult[];
    filters: StateFilter<MutantStatus>[];
    model: FileUnderTestModel;
    selectedMutantStates: MutantStatus[];
    private selectedMutant?;
    private lines;
    mutants: MutantModel[];
    private code;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    render(): import("lit").TemplateResult<1>;
    reactivate(): void;
    update(changes: PropertyValues<this>): void;
}
//# sourceMappingURL=file.component.d.ts.map