import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolbarRenderTarget } from './sanitize';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

class FakeSanitizer {
  constructor(readonly config: SanitizerConfig) {}
}

type SetHTML = (input: string, options?: { sanitizer?: Sanitizer }) => void;

/** A structurally checked render target: no casts, so a signature drift fails to compile. */
const target = (setHTML?: SetHTML): ToolbarRenderTarget & { setHTML?: SetHTML } => ({ textContent: '', setHTML });

/** Reload the module so the sanitizer is built against the current globals. */
const importFresh = async () => {
  vi.resetModules();
  return import('./sanitize');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('safeSetHTML', () => {
  it('renders through Element.setHTML with the shared toolbar sanitizer', async () => {
    vi.stubGlobal('Sanitizer', FakeSanitizer);
    const { safeSetHTML } = await importFresh();
    const setHTML = vi.fn<SetHTML>();
    const el = target(setHTML);

    safeSetHTML(el, '  <svg viewBox="0 0 1 1"><path d="M0 0"/></svg>  ', 'Sync now');

    expect(setHTML).toHaveBeenCalledTimes(1);
    const [html, options] = setHTML.mock.calls[0];
    expect(html).toBe('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
    expect(options?.sanitizer).toBeInstanceOf(FakeSanitizer);
    expect(el.textContent).toBe('');
  });

  it('replaces instead of appending, so repeated icon swaps cannot stack', async () => {
    vi.stubGlobal('Sanitizer', FakeSanitizer);
    const { safeSetHTML } = await importFresh();
    const setHTML = vi.fn<SetHTML>();
    const appendChild = vi.fn<(node: Node) => Node>();
    const el = { ...target(setHTML), appendChild };

    safeSetHTML(el, '<span>one</span>', 'One');
    safeSetHTML(el, '<span>two</span>', 'Two');

    expect(appendChild).not.toHaveBeenCalled();
    expect(setHTML).toHaveBeenCalledTimes(2);
  });

  it('shows the fallback label when the Sanitizer API is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { safeSetHTML, isToolbarSanitizerSupported } = await importFresh();
    expect(isToolbarSanitizerSupported()).toBe(false);

    const setHTML = vi.fn<SetHTML>();
    const el = target(setHTML);

    // An icon-only template has no text: reducing it to text would leave a blank button.
    safeSetHTML(el, '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>', 'Capture location');

    expect(setHTML).not.toHaveBeenCalled();
    expect(el.textContent).toBe('Capture location');
  });

  it('falls back when the target element has no setHTML', async () => {
    vi.stubGlobal('Sanitizer', FakeSanitizer);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { safeSetHTML } = await importFresh();
    const el = target();

    safeSetHTML(el, '<p>plain</p>', 'Log visit');

    expect(el.textContent).toBe('Log visit');
  });

  it('never assigns innerHTML, even when setHTML rejects the input', async () => {
    vi.stubGlobal('Sanitizer', FakeSanitizer);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { safeSetHTML } = await importFresh();
    const el = {
      ...target(() => {
        throw new TypeError('bad markup');
      }),
      set innerHTML(_value: string) {
        throw new Error('innerHTML must not be used');
      },
    };

    expect(() => safeSetHTML(el, '<b>safe</b>', 'Sync failed')).not.toThrow();
    expect(el.textContent).toBe('Sync failed');
  });
});

describe('TOOLBAR_SANITIZER_CONFIG', () => {
  it('uses the element/attribute form engines read, never the ignored allowElements', async () => {
    const { TOOLBAR_SANITIZER_CONFIG } = await importFresh();

    expect(TOOLBAR_SANITIZER_CONFIG.elements?.length).toBeGreaterThan(0);
    expect(TOOLBAR_SANITIZER_CONFIG.attributes?.length).toBeGreaterThan(0);
    expect(TOOLBAR_SANITIZER_CONFIG).not.toHaveProperty('allowElements');
    expect(TOOLBAR_SANITIZER_CONFIG).not.toHaveProperty('allowAttributes');
  });

  it('namespaces the SVG elements so the icons survive sanitization', async () => {
    const { TOOLBAR_SANITIZER_CONFIG } = await importFresh();
    const svgElements = (TOOLBAR_SANITIZER_CONFIG.elements ?? []).filter(
      (element): element is { name: string; namespace: string } => typeof element !== 'string',
    );

    expect(svgElements.map((element) => element.name)).toEqual(
      expect.arrayContaining(['svg', 'path', 'circle']),
    );
    expect(svgElements.every((element) => element.namespace === SVG_NAMESPACE)).toBe(true);
  });

  it('never allowlists event handlers or scripting URLs', async () => {
    const { TOOLBAR_SANITIZER_CONFIG } = await importFresh();
    const attributes = (TOOLBAR_SANITIZER_CONFIG.attributes ?? []).map((attribute) =>
      typeof attribute === 'string' ? attribute : attribute.name,
    );

    expect(attributes.filter((name) => /^on/i.test(name))).toEqual([]);
    expect(attributes).not.toContain('href');
    expect(attributes).toContain('style');
  });
});
