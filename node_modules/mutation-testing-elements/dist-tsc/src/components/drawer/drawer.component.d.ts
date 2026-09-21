import { nothing } from 'lit';
import { BaseElement } from '../base-element.js';
export type DrawerMode = 'open' | 'half' | 'closed';
export declare const DRAWER_HALF_OPEN_SIZE = 120;
export declare class MutationTestReportDrawer extends BaseElement {
    #private;
    static styles: import("lit").CSSResult[];
    mode: DrawerMode;
    hasDetail: boolean;
    get toggleMoreLabel(): typeof nothing | import("lit").TemplateResult<1>;
    private header;
    constructor();
    toggleReadMore: (event: MouseEvent) => void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    render(): import("lit").TemplateResult<1>;
}
//# sourceMappingURL=drawer.component.d.ts.map