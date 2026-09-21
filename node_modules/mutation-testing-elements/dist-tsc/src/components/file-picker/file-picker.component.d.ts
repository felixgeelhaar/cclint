import type { PropertyValues, TemplateResult } from 'lit';
import type { FileUnderTestModel, MutationTestMetricsResult } from 'mutation-testing-metrics';
import { TestFileModel } from 'mutation-testing-metrics';
import { BaseElement } from '../base-element.js';
interface ModelEntry {
    name: string;
    file: FileUnderTestModel | TestFileModel;
}
export declare class MutationTestReportFilePickerComponent extends BaseElement {
    #private;
    rootModel: MutationTestMetricsResult | undefined;
    filteredFiles: (ModelEntry & {
        template?: (string | TemplateResult)[];
    })[];
    fileIndex: number;
    private dialog;
    private filePickerInput;
    private activeLink;
    get isOpen(): boolean;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    willUpdate(changedProperties: PropertyValues<this>): void;
    updated(changedProperties: PropertyValues<this>): void;
    open: () => void;
    close: () => void;
    render(): TemplateResult<1>;
}
export {};
//# sourceMappingURL=file-picker.component.d.ts.map