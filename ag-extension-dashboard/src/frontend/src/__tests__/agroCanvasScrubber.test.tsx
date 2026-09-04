import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';

// Regression test: out-of-range or non-finite `progress` must never crash the
// stage HUD (AGRO_STAGES[index] was undefined for negative/NaN progress and
// `.icon` threw during render). Auto-play is disabled so the rAF loop cannot
// rewrite progress mid-assertion.
function renderScrubber(progress?: number) {
  const onStageChange = vi.fn();
  const result = render(
    <AgroEcosystemCanvasScrubber progress={progress} autoPlay={false} onStageChange={onStageChange} />
  );
  return { ...result, onStageChange };
}

describe('AgroEcosystemCanvasScrubber hostile progress', () => {
  it.each([Number.NaN, -0.5, -1, 1.5, 2, Number.POSITIVE_INFINITY])(
    'renders a valid stage badge for progress=%s without crashing',
    (progress) => {
      const { onStageChange, unmount } = renderScrubber(progress);
      expect(screen.getByText(/STAGE 0\d \/\//)).toBeInTheDocument();
      const reported = onStageChange.mock.calls.map((c) => c[0] as number);
      for (const stage of reported) {
        expect(Number.isInteger(stage)).toBe(true);
        expect(stage).toBeGreaterThanOrEqual(0);
        expect(stage).toBeLessThanOrEqual(3);
      }
      unmount();
    }
  );

  it('maps boundary progress values to the correct stages', async () => {
    const { rerender, onStageChange } = renderScrubber(0);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText('STAGE 01 // SATELLITE')).toBeInTheDocument();
    rerender(
      <AgroEcosystemCanvasScrubber progress={0.99} autoPlay={false} onStageChange={onStageChange} />
    );
    expect(screen.getByText('STAGE 04 // EDGE DISPATCH')).toBeInTheDocument();
  });
});
