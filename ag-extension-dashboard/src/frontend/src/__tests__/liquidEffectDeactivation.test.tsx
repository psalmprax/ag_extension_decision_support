import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetModules();
});

describe('liquid effect deactivation', () => {
  it('clears the legacy opt-in and initializes the effect as disabled', async () => {
    localStorage.setItem('ag-liquid-effect', 'true');

    const { useAppStore } = await import('@/store/useAppStore');

    expect(useAppStore.getState().liquidEffect).toBe(false);
    expect(localStorage.getItem('ag-liquid-effect')).toBeNull();
  });

  it('does not render the canvas even when enabled in store state', async () => {
    const { useAppStore } = await import('@/store/useAppStore');
    const { LiquidBackgroundCanvas } = await import('@/components/canvasui/LiquidBackgroundCanvas');
    useAppStore.setState({ liquidEffect: true });

    const { container } = render(<LiquidBackgroundCanvas />);

    expect(container.firstChild).toBeNull();
  });
});
