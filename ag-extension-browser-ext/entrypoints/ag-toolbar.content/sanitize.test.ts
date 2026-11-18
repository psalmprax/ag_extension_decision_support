import { afterEach, describe, expect, it, vi } from 'vitest';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

class FakeSanitizer {
  constructor(readonly config: SanitizerConfig) {}
}

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
    const setHTML = vi.fn();
    const el = { setHTML } as unknown as HTMLElement;

    safeSetHTML(el, '  <svg viewBox="0 0 1 1"><path d="M0 0"/></svg>  ');

    expect(setHTML).toHaveBeenCalledTimes(1);
    const [html, options] = setHTML.mock.calls[0] as [string, { sanitizer: unknown }];
    expect(html).toBe('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>');
    expect(options.sanitizer).toBeInstanceOf(FakeSanitizer);
  });

  it('replaces instead of appending, so repeated icon swaps cannot stack', async () => {
    vi.stubGlobal('Sanitizer', FakeSanitizer);
    const { safeSetHTML } = await importFresh();
    const setHTML = vi.fn();
    const appendChild = vi.fn();
    const el = { setHTML, appendChild } as unknown as HTMLElement;

    safeSetHTML(el, '<span>one</span>');
    safeSetHTML(el, '<span>two</span>');

    expect(appendChild).not.toHaveBeenCalled();
    expect(setHTML).toHaveBeenCalledTimes(2);
  });

  it('falls back to text when the Sanitizer API is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { safeSetHTML, isToolbarSanitizerSupported } = await importFresh();
    expect(isToolbarSanitizerSupported()).toBe(false);

    const setHTML = vi.fn();
    const el = { setHTML, textContent: '' } as unknown as HTMLElement;

    safeSetHTML(el, '<div class="x">  hello  <b>world</b></div>');

    expect(setHTML).not.toHaveBeenCalled();
    expect(el.textContent).toBe('hello world');
  });

  it('falls back when the target element has no setHTML', async () => {
    vi.stubGlobal('Sanitizer', FakeSanitizer);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { safeSetHTML } = await importFresh();
    const el = { textContent: '' } as unknown as HTMLElement;

    safeSetHTML(el, '<p>plain</p>');

    expect(el.textContent).toBe('plain');
  });

  it('never assigns innerHTML, even when setHTML rejects the input', async () => {
    vi.stubGlobal('Sanitizer', FakeSanitizer);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { safeSetHTML } = await importFresh();
    const el = {
      setHTML: () => {
        throw new TypeError('bad markup');
      },
      textContent: '',
      set innerHTML(_value: string) {
        throw new Error('innerHTML must not be used');
      },
    } as unknown as HTMLElement;

    expect(() => safeSetHTML(el, '<b>safe</b>')).not.toThrow();
    expect(el.textContent).toBe('safe');
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
