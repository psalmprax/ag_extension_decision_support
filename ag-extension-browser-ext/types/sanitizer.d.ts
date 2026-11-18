/**
 * Minimal typings for the HTML Sanitizer API.
 *
 * TypeScript 5.9's `lib.dom` still does not declare `Element.setHTML()` or the
 * `Sanitizer` interface, and the extension's tsconfig targets ESNext with the
 * stock DOM lib. Declaring them here keeps the toolbar code type-safe without
 * casting through `any`.
 *
 * Runtime support: Chromium 133+ and current Firefox. The content script
 * feature-detects both and degrades to text-only rendering when absent.
 */

interface SanitizerConfig {
  allowElements?: string[];
  blockElements?: string[];
  dropElements?: string[];
  allowAttributes?: Record<string, string[]>;
  dropAttributes?: Record<string, string[]>;
  allowCustomElements?: boolean;
  allowComments?: boolean;
}

declare class Sanitizer {
  constructor(config?: SanitizerConfig);
}

interface Element {
  setHTML(input: string, options?: { sanitizer?: Sanitizer }): void;
}

interface ShadowRoot {
  setHTML(input: string, options?: { sanitizer?: Sanitizer }): void;
}
