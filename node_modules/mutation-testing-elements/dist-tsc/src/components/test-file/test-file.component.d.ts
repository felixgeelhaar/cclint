import '../../style/prism-plugins.js';
import type { PropertyValues } from 'lit';
import type { TestFileModel } from 'mutation-testing-metrics';
import { TestStatus } from 'mutation-testing-metrics';
import { RealTimeElement } from '../real-time-element.js';
export declare class TestFileComponent extends RealTimeElement {
    #private;
    static styles: import("lit").CSSResult[];
    model: TestFileModel | undefined;
    private filters;
    private lines;
    enabledStates: TestStatus[];
    private selectedTest;
    private tests;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    render(): import("lit").TemplateResult<1>;
    reactivate(): void;
    willUpdate(changes: PropertyValues<this>): void;
}
//# sourceMappingURL=test-file.component.d.ts.map