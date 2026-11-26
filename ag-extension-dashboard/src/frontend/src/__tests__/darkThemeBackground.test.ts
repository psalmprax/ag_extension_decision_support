import { describe, expect, it } from 'vitest';
import { getDarkThemeCSS, getThemeCSS, themes, type ThemeName } from '@/theme';

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

  /** WCAG contrast between two #rrggbb colours. */
  const contrast = (a: string, b: string) => {
    const lum = (hex: string) => {
      const [r, g, bl] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('keeps brand primary 300/400 in dark mode, readable as text on the dark panels', () => {
    for (const name of Object.keys(themes) as ThemeName[]) {
      const css = getDarkThemeCSS(name);
      const background = value(css, '--color-bg-secondary') as string;
      for (const step of [300, 400]) {
        const shade = value(css, `--color-primary-${step}`) as string;
        expect(shade, `${name} primary-${step}`).toBe(themes[name].primary[step]);
        expect(contrast(shade, background), `${name} primary-${step} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
      // The palest tints still become dark neutrals, so tinted panels do not glow.
      expect(value(css, '--color-primary-50')).toBe('#111827');
    }
  });
});

