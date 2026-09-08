import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeProbePoint } from '@/lib/canvasProbe';
import { requestGpsFix } from '@/lib/geo';

describe('normalizeProbePoint', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };

  it('maps canvas offsets to 0–1 coordinates', () => {
    expect(normalizeProbePoint(110, 70, rect)).toEqual({ x: 100, y: 50, xNorm: 0.5, yNorm: 0.5 });
  });

  it('clamps out-of-bounds pointers instead of extrapolating', () => {
    const p = normalizeProbePoint(-50, 500, rect);
    expect(p.xNorm).toBe(0);
    expect(p.yNorm).toBe(1);
  });

  it('never divides by zero on degenerate rects', () => {
    const p = normalizeProbePoint(10, 20, { left: 0, top: 0, width: 0, height: 0 });
    expect(Number.isFinite(p.xNorm)).toBe(true);
    expect(Number.isFinite(p.yNorm)).toBe(true);
  });
});

describe('requestGpsFix', () => {
  const realGeolocation = Object.getOwnPropertyDescriptor(window.navigator, 'geolocation');

  afterEach(() => {
    vi.restoreAllMocks();
    if (realGeolocation) {
      Object.defineProperty(window.navigator, 'geolocation', realGeolocation);
    }
  });

  function mockGeolocation(outcome: { ok: true } | { error: number }) {
    const getCurrentPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
      if ('ok' in outcome) {
        success({
          coords: { latitude: 9.05, longitude: 7.49, accuracy: 12 },
        } as unknown as GeolocationPosition);
      } else if (error) {
        error({ code: outcome.error, PERMISSION_DENIED: 1 } as GeolocationPositionError);
      }
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    return getCurrentPosition;
  }

  it('resolves latitude/longitude/accuracy on success', async () => {
    mockGeolocation({ ok: true });
    await expect(requestGpsFix()).resolves.toMatchObject({
      latitude: 9.05,
      longitude: 7.49,
      accuracyM: 12,
    });
  });

  it('rejects with a permission message when denied', async () => {
    mockGeolocation({ error: 1 });
    await expect(requestGpsFix()).rejects.toThrow(/permission denied/i);
  });

  it('rejects with a retry message on position failure', async () => {
    mockGeolocation({ error: 2 });
    await expect(requestGpsFix()).rejects.toThrow(/outdoors/i);
  });
});
