import { TestStatus } from 'mutation-testing-metrics';
import type { MutantStatus, OpenEndLocation } from 'mutation-testing-report-schema/api';
export declare function getContextClassForStatus(status: MutantStatus): "success" | "caution" | "danger" | "warning" | "secondary";
export declare function getContextClassForTestStatus(status: TestStatus): "success" | "caution" | "warning";
export declare function getEmojiForTestStatus(status: TestStatus): import("lit").TemplateResult<1>;
export declare function getEmojiForStatus(status: MutantStatus): import("lit").TemplateResult<1>;
export declare function escapeHtml(unsafe: string): string;
export declare function toAbsoluteUrl(...fragments: string[]): string;
export declare function plural(items: unknown[]): string;
export declare function describeLocation({ fileName, location }: {
    fileName: string;
    location?: OpenEndLocation | undefined;
}): string;
export declare function scrollToCodeFragmentIfNeeded(el: Element | null): void;
//# sourceMappingURL=html-helpers.d.ts.map