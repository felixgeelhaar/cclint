import { BaseElement } from './base-element.js';
export declare abstract class RealTimeElement extends BaseElement {
    #private;
    shouldReactivate(): boolean;
    reactivate(): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
}
//# sourceMappingURL=real-time-element.d.ts.map