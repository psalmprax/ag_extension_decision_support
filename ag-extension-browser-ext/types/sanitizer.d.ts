/**
 * Minimal typings for the HTML Sanitizer API.
 *
 * TypeScript 5.9's `lib.dom` still does not declare `Element.setHTML()` or the
 * `Sanitizer` interface, and the extension targets ESNext with the stock DOM
 * lib. Declaring them here keeps the toolbar code type-safe without casting
 * through `any`.
 *
 * Only the members actually used are declared. The config uses `elements` /
 * `attributes` because that is the shape shipped engines read: Chrome 155
 * silently ignores `allowElements` / `allowAttributes` (it reports an empty
 * `removeElements` list), and `attributes` must be an array — an object map
 * throws a TypeError.
 */

interface SanitizerElementNamespace {
  name: string;
  namespace?: string | null;
}

interface SanitizerAttributeNamespace {
  name: string;
  namespace?: string | null;
  elements?: string[];
}

interface SanitizerConfig {
  elements?: Array<string | SanitizerElementNamespace>;
  attributes?: Array<string | SanitizerAttributeNamespace>;
  comments?: boolean;
  dataAttributes?: boolean;
}

declare class Sanitizer {
  constructor(config?: SanitizerConfig);
  get(): SanitizerConfig;
}

interface Element {
  setHTML(input: string, options?: { sanitizer?: Sanitizer }): void;
}

interface ShadowRoot {
  setHTML(input: string, options?: { sanitizer?: Sanitizer }): void;
}
