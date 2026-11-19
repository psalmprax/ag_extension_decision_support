/**
 * Sanitized markup rendering for the toolbar content script.
 *
 * The toolbar templates are static (built-in SVG + text), but a sanitizer — not
 * trust — is the enforcement point: anything dynamic that ever flows into a
 * template must not be able to smuggle event handlers or scripting URLs into a
 * page that runs with the extension's privileges.
 *
 * Configuration shape: shipped engines read `elements` / `attributes`. The
 * newer `allowElements` / `allowAttributes` spelling is silently ignored by
 * current Chrome (verified on 155: it produced an empty `removeElements` list
 * and let `<img>` and `<p style>` through), so it must not be used here — an
 * ignored allowlist looks strict while allowing everything. SVG elements also
 * need explicit `{ name, namespace }` entries; bare tag strings only match the
 * HTML namespace, so icons would be dropped entirely.
 */

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ALLOWED_HTML_TAGS = [
  'div', 'span', 'p', 'strong', 'em', 'b', 'i', 'u', 'br', 'small', 'sub', 'sup', 'code', 'pre',
];

const ALLOWED_SVG_TAGS = [
  'svg', 'circle', 'path', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'title',
];

/**
 * Attributes the templates actually use: the inline `style` blocks and the SVG
 * presentation attributes. Omitting `attributes` would disable attribute
 * filtering altogether, so it is always supplied. Event handlers and
 * `javascript:` URLs are also removed by `setHTML()` regardless of this list.
 */
const ALLOWED_ATTRIBUTES = [
  'style', 'class', 'id', 'title', 'role',
  'width', 'height', 'viewBox', 'xmlns', 'preserveAspectRatio',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'd', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'opacity',
];

export const TOOLBAR_SANITIZER_CONFIG: SanitizerConfig = {
  elements: [
    ...ALLOWED_HTML_TAGS,
    ...ALLOWED_SVG_TAGS.map((name) => ({ name, namespace: SVG_NAMESPACE })),
  ],
  attributes: ALLOWED_ATTRIBUTES,
};

export const isToolbarSanitizerSupported = (): boolean => typeof Sanitizer === 'function';

/**
 * Construct the shared sanitizer once per content-script load. Chrome 105-118
 * shipped `setHTML()` under a different specification, so construction can
 * reject a configuration the current spec accepts; that must not take the whole
 * toolbar down at import time.
 */
const createToolbarSanitizer = (): Sanitizer | null => {
  if (!isToolbarSanitizerSupported()) return null;
  try {
    return new Sanitizer(TOOLBAR_SANITIZER_CONFIG);
  } catch (error) {
    console.warn('[ag-toolbar] Sanitizer rejected the toolbar config — rendering templates as text', error);
    return null;
  }
};

const toolbarSanitizer = createToolbarSanitizer();

/** The parts of an element `safeSetHTML` uses; every HTMLElement satisfies it. */
export interface ToolbarRenderTarget {
  textContent: string | null;
  setHTML?: (input: string, options?: { sanitizer?: Sanitizer }) => void;
}

/**
 * Replace an element's content with sanitized markup.
 *
 * Parsing goes through the native Sanitizer API (`Element.setHTML`), so the
 * platform filters the markup instead of this module assigning `innerHTML`.
 * Replacing rather than appending is what the callers intend: the sync and GPS
 * buttons swap their icon in place, and appending used to stack a new SVG on
 * every state change.
 *
 * When the API is unavailable, or rejects the input, the element shows
 * `fallbackLabel` as plain text. The templates are icon-only SVG, so reducing the
 * markup to its text would leave a blank button; nothing here parses HTML as a
 * fallback.
 */
export const safeSetHTML = (el: ToolbarRenderTarget, html: string, fallbackLabel: string): void => {
  if (toolbarSanitizer && typeof el.setHTML === 'function') {
    try {
      el.setHTML(html.trim(), { sanitizer: toolbarSanitizer });
      return;
    } catch (error) {
      console.warn('[ag-toolbar] setHTML failed — rendering template as text', error);
    }
  } else {
    console.warn('[ag-toolbar] Sanitizer API unavailable — rendering template as text');
  }
  el.textContent = fallbackLabel;
};
