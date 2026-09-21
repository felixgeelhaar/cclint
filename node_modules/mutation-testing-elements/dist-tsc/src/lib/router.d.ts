/**
 * Observable for location changes on the hash part of the url
 * As soon as you subscribe you'll get a first event for the current location
 * @example
 * window.location.url === 'http://localhost:8080#foo/bar/baz.js' => ['foo', 'bar', 'baz.js ']
 */
export declare const locationChange$: import("rxjs").Observable<string[]>;
export declare const View: {
    readonly mutant: "mutant";
    readonly test: "test";
};
export type View = (typeof View)[keyof typeof View];
//# sourceMappingURL=router.d.ts.map