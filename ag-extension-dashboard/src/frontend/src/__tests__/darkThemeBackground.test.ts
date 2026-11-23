import { describe, expect, it } from 'vitest';
import { getDarkThemeCSS, getThemeCSS } from '@/theme';

const value = (css: string, name: string) => css.match(new RegExp(`${name}: ([^;]+);`))?.[1];

describe('dark mode backgrounds', () => {
  it('puts every page of the forest theme on the field greens of the header and sidebar', () => {
    const css = getDarkThemeCSS('forest');
    expect(value(css, '--color-bg-primary')).toBe('#0d1a14');
    expect(value(css, '--color-bg-secondary')).toBe('#13241b');
    expect(value(css, '--color-bg-tertiary')).toBe('#1a2f24');
    // The surface follows the panels, so no navy is left on a forest page.
    expect(value(css, '--color-surface')).toBe('#13241b');
    expect(css).not.toContain('#0a0f1e');
  });

  it('keeps the neutral navy for themes that have no dark background of their own', () => {
    const css = getDarkThemeCSS('oceanic');
    expect(value(css, '--color-bg-primary')).toBe('#0a0f1e');
    expect(value(css, '--color-bg-tertiary')).toBe('#1f2937');
    expect(value(css, '--color-surface')).toBe('#0c1324');
  });

  it('gives light mode a tertiary background too, the same as its secondary', () => {
    const css = getThemeCSS('forest');
    expect(value(css, '--color-bg-tertiary')).toBe(value(css, '--color-bg-secondary'));
  });
});

describe('dark mode text', () => {
  it('writes forest and sage copy in green-greys that keep AA contrast on their panels', () => {
    for (const theme of ['forest', 'sage'] as const) {
      const css = getDarkThemeCSS(theme);
      expect(value(css, '--color-text-primary')).toBe('#e6eee9');
      expect(value(css, '--color-text-secondary')).toBe('#c5d3cb');
      expect(value(css, '--color-text-muted')).toBe('#8fa69a');
      expect(value(css, '--color-text-muted-rgb')).toBe('143 166 154');
    }
  });

  it('keeps slate text for themes on the neutral navy', () => {
    const css = getDarkThemeCSS('oceanic');
    expect(value(css, '--color-text-secondary')).toBe('#cbd5e1');
    expect(value(css, '--color-text-muted')).toBe('#94a3b8');
  });

  it('defines the text steps in light mode too', () => {
    expect(value(getThemeCSS('forest'), '--color-text-primary')).toBe('#1f2937');
  });
});

