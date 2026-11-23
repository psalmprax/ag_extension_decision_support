import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { finishWalk, judgeWalkFix, median, outlinePath, storedBoundary, summarizeBoundary } from '../boundary/boundaryModel';
import { useBoundaryDraft } from '../boundary/useBoundaryDraft';

const METRE = 1 / 111_195;
const at = (east: number, north: number) => ({ lat: north * METRE, lng: 36 + east * METRE });

describe('walking a boundary', () => {
  it('skips rough GPS fixes and fixes taken before the walker has moved', () => {
    expect(judgeWalkFix([], { ...at(0, 0), accuracy: 45 })).toBe('too_inaccurate');
    expect(judgeWalkFix([at(0, 0)], { ...at(1, 0), accuracy: 4 })).toBe('too_close');
    expect(judgeWalkFix([at(0, 0)], { ...at(6, 0), accuracy: 4 })).toBe('accepted');
  });

  it('needs a bigger step when the fix is rough, so wobble is not mistaken for walking', () => {
    expect(judgeWalkFix([at(0, 0)], { ...at(6, 0), accuracy: 20 })).toBe('too_close');
  });

  it('drops the last point when the walk ends back at the start', () => {
    const walk = [at(0, 0), at(100, 0), at(100, 100), at(0, 100), at(1, 1)];
    expect(finishWalk(walk, 5)).toEqual([at(0, 0), at(100, 0), at(100, 100), at(0, 100)]);
  });

  it('takes the middle GPS error, not the average, so one bad fix does not dominate', () => {
    expect(median([3, 4, 40])).toBe(4);
    expect(median([])).toBeNull();
  });
});

describe('boundary summary', () => {
  const square = [at(0, 0), at(100, 0), at(100, 100), at(0, 100)];

  it('gives a walked boundary an area margin from its GPS error', () => {
    const summary = summarizeBoundary({ points: square, method: 'walked', accuracyM: 5 });
    expect(summary.problem).toBeNull();
    expect(summary.metrics.hectares).toBeCloseTo(1, 2);
    expect(summary.uncertaintyHa).toBeCloseTo(0.2, 2);
  });

  it('gives a drawn boundary no GPS margin', () => {
    expect(summarizeBoundary({ points: square, method: 'drawn', accuracyM: null }).uncertaintyHa).toBeNull();
  });

  it('reads a stored boundary and ignores one that is not usable', () => {
    expect(storedBoundary({ boundaryCoordinates: square.map(p => ({ lat: String(p.lat), lng: String(p.lng) })), boundaryMethod: 'walked', boundaryAccuracyM: '4.5' })).toEqual({ points: square, method: 'walked', accuracyM: 4.5 });
    expect(storedBoundary({ boundaryCoordinates: [{ lat: 1 }] })).toBeNull();
    expect(storedBoundary({ boundaryCoordinates: null })).toBeNull();
  });

  it('draws a closed outline inside the square', () => {
    const path = outlinePath(square);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    for (const n of path.match(/-?\d+(\.\d+)?/g)!.map(Number)) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });
});

describe('useBoundaryDraft', () => {
  it('adds a corner for each tap on the map', () => {
    const { result } = renderHook(() => useBoundaryDraft(null));
    act(() => result.current.setMethod('drawn'));
    act(() => result.current.tap(at(0, 0)));
    act(() => result.current.tap(at(50, 0)));
    expect(result.current.draft.points).toHaveLength(2);
    act(() => result.current.undo());
    expect(result.current.draft.points).toHaveLength(1);
  });

  it('records GPS fixes while walking and reports the typical error', () => {
    let send: (position: GeolocationPosition) => void = () => undefined;
    const clearWatch = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: (success: typeof send) => ((send = success), 7), clearWatch, getCurrentPosition: vi.fn() },
    });
    const fix = (east: number, north: number, accuracy: number) =>
      send({ coords: { ...at(east, north), latitude: at(east, north).lat, longitude: at(east, north).lng, accuracy } } as unknown as GeolocationPosition);

    const { result } = renderHook(() => useBoundaryDraft(null));
    act(() => result.current.startWalking());
    act(() => fix(0, 0, 4));
    act(() => fix(100, 0, 60)); // too rough: skipped
    act(() => fix(100, 0, 5));
    act(() => fix(100, 100, 3));
    act(() => fix(0, 100, 6));
    expect(result.current.draft.points).toHaveLength(4);
    expect(result.current.draft.lastFix?.verdict).toBe('accepted');
    act(() => result.current.stopWalking());
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(result.current.boundary()).toMatchObject({ method: 'walked', accuracyM: 4.5 });
  });

  it('keeps walking through a lost GPS fix, and stops only when location access is refused', () => {
    let fail: (error: Partial<GeolocationPositionError>) => void = () => undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: (_ok: unknown, error: typeof fail) => ((fail = error), 3), clearWatch: vi.fn(), getCurrentPosition: vi.fn() },
    });
    const { result } = renderHook(() => useBoundaryDraft(null));
    act(() => result.current.startWalking());
    act(() => fail({ code: 2, PERMISSION_DENIED: 1 }));
    expect(result.current.walking).toBe(true);
    expect(result.current.draft.signalLost).toBe(true);
    act(() => fail({ code: 1, PERMISSION_DENIED: 1 }));
    expect(result.current.walking).toBe(false);
    expect(result.current.draft.gps).toBe('denied');
  });
});
