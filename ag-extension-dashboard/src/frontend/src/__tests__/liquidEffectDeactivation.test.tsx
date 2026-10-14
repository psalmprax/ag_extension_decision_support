import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetModules();
});

describe('liquid effect deactivation', () => {
  it('clears the legacy opt-in when the store loads', async () => {
    localStorage.setItem('ag-liquid-effect', 'true');

    await import('@/store/useAppStore');

    expect(localStorage.getItem('ag-liquid-effect')).toBeNull();
  });
});
