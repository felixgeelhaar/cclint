import type { TemplateResult } from 'lit';
import type { MutantModel } from 'mutation-testing-metrics';
import type { DrawerMode } from '../drawer/drawer.component.js';
import { RealTimeElement } from '../real-time-element.js';
export declare class MutationTestReportDrawerMutant extends RealTimeElement {
    #private;
    mutant?: MutantModel;
    mode: DrawerMode;
    constructor();
    render(): TemplateResult<1>;
}
//# sourceMappingURL=drawer-mutant.component.d.ts.map