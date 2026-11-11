import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { AppToaster } from '@/components/AppToaster';
import { getDarkThemeCSS, getThemeCSS, surfaceTokens, themes, type ThemeName } from '@/theme';

vi.unmock('react-hot-toast');

function luminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const linear = channels.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('AppToaster', () => {
  afterEach(() => {
    toast.remove();
  });

  it('uses the same readable surface for default, success, error, and loading messages', async () => {
    render(<AppToaster />);
    act(() => {
      toast('Opening SMS composer (advisory truncated to 300 chars)…');
      toast.success('Saved successfully');
      toast.error('Unable to save');
      toast.loading('Running live RAG');
    });

    for (const message of [
      'Opening SMS composer (advisory truncated to 300 chars)…',
      'Saved successfully',
      'Unable to save',
      'Running live RAG',
    ]) {
      const status = (await screen.findByText(message)).closest('[role="status"]');
      const toastBar = status?.parentElement;
      expect(toastBar?.getAttribute('style')).toContain('background: var(--color-surface)');
      expect(toastBar?.getAttribute('style')).toContain('color: var(--color-on-surface)');
    }
  });

  it.each(Object.keys(themes) as ThemeName[])(
    'keeps toast text at WCAG AA contrast in both modes of the %s theme',
    theme => {
      for (const [css, surface] of [
        [getThemeCSS(theme), surfaceTokens.light],
        [getDarkThemeCSS(theme), surfaceTokens.dark],
      ] as const) {
        expect(css).toContain(`--color-surface: ${surface.surface};`);
        expect(css).toContain(`--color-on-surface: ${surface.onSurface};`);
        expect(contrast(surface.surface, surface.onSurface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  );
});
