import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatChatTime } from '@/lib/chatTime';
import { visitTypeLabel } from '@/lib/visitType';
import { randomId } from '@/lib/randomId';
import { requestGpsFix } from '@/lib/geo';
import { triggerHaptic } from '@/lib/haptics';
import { isAudioEnabled, playScrubTick, playStageChime, setAudioMuted } from '@/lib/audioHaptics';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  calculateDeviceBudget,
  useDeviceThermalMemoryBudget,
} from '@/hooks/useDeviceThermalMemoryBudget';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getApiErrorMessage', () => {
  it('prefers the server payload inside an axios-shaped error', () => {
    expect(getApiErrorMessage({ response: { data: 'Account locked' } }, 'fallback')).toBe(
      'Account locked'
    );
  });

  it('reads the global errorHandler object shape', () => {
    expect(
      getApiErrorMessage({ response: { data: { error: { message: 'Boom', type: 'X' } } } }, 'fb')
    ).toBe('Boom');
  });

  it('falls back to the client message when the response carries nothing readable', () => {
    expect(getApiErrorMessage({ message: 'timeout of 10000ms exceeded' }, 'fb')).toBe(
      'timeout of 10000ms exceeded'
    );
  });

  it('walks arrays and nested detail fields', () => {
    expect(getApiErrorMessage(['  ', { detail: 'phone number is invalid' }], 'fb')).toBe(
      'phone number is invalid'
    );
    expect(getApiErrorMessage({ details: ['first problem'] }, 'fb')).toBe('first problem');
  });

  it('stringifies primitives and returns the fallback for whitespace-only text', () => {
    expect(getApiErrorMessage(429, 'fb')).toBe('429');
    expect(getApiErrorMessage(false, 'fb')).toBe('false');
    expect(getApiErrorMessage('   ', 'fb')).toBe('fb');
  });

  it('returns the fallback for null, undefined and objects with no message', () => {
    expect(getApiErrorMessage(null, 'fb')).toBe('fb');
    expect(getApiErrorMessage(undefined, 'fb')).toBe('fb');
    expect(getApiErrorMessage({ success: false }, 'fb')).toBe('fb');
  });

  it('does not recurse forever on a circular payload', () => {
    const circular: Record<string, unknown> = { success: false };
    circular.self = circular;
    expect(getApiErrorMessage(circular, 'fb')).toBe('fb');
  });
});

describe('formatChatTime', () => {
  it('formats an ISO timestamp as a short clock time', () => {
    expect(formatChatTime({ timestamp: '2026-01-02T10:30:00Z' })).toMatch(/\d{1,2}:\d{2}/);
  });

  it('falls back to createdAt when timestamp is absent', () => {
    expect(formatChatTime({ createdAt: '2026-01-02T10:30:00Z' })).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns an empty string instead of "Invalid Date"', () => {
    expect(formatChatTime({})).toBe('');
    expect(formatChatTime({ createdAt: null })).toBe('');
    expect(formatChatTime({ timestamp: 'not-a-date' })).toBe('');
  });
});

describe('visitTypeLabel', () => {
  it('turns stored codes into sentence-case labels', () => {
    expect(visitTypeLabel('pest_control')).toBe('Pest control');
    expect(visitTypeLabel('HARVEST-VISIT')).toBe('Harvest visit');
    expect(visitTypeLabel('followup visit')).toBe('Followup visit');
  });

  it('defaults to a routine visit when the code is missing or blank', () => {
    expect(visitTypeLabel(null)).toBe('Routine visit');
    expect(visitTypeLabel(undefined)).toBe('Routine visit');
    expect(visitTypeLabel('   ')).toBe('Routine visit');
  });
});

describe('randomId', () => {
  it('produces distinct identifiers', () => {
    const ids = new Set(Array.from({ length: 25 }, () => randomId()));
    expect(ids.size).toBe(25);
  });

  it('applies the requested prefix verbatim', () => {
    expect(randomId('visit_')).toMatch(/^visit_/);
    expect(randomId('visit_').length).toBeGreaterThan('visit_'.length);
  });
});

describe('requestGpsFix', () => {
  const originalGeolocation = navigator.geolocation;

  function stubGeolocation(value: unknown) {
    Object.defineProperty(navigator, 'geolocation', {
      value,
      configurable: true,
      writable: true,
    });
  }

  afterEach(() => {
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true,
        writable: true,
      });
    } else {
      // jsdom ships no Geolocation API: leave the property absent so the
      // feature-detection branch behaves as it does in an unsupported browser.
      Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  it('rejects with an actionable message when the device has no location API', async () => {
    Reflect.deleteProperty(navigator, 'geolocation');
    expect('geolocation' in navigator).toBe(false);
    await expect(requestGpsFix()).rejects.toThrow(/Location is not available on this device/);
  });

  it('resolves the fix with its accuracy', async () => {
    stubGeolocation({
      getCurrentPosition: (ok: (pos: unknown) => void) =>
        ok({ coords: { latitude: -0.303, longitude: 36.08, accuracy: 8 } }),
    });

    await expect(requestGpsFix()).resolves.toEqual({
      latitude: -0.303,
      longitude: 36.08,
      accuracyM: 8,
    });
  });

  it('reports a missing accuracy reading as null rather than NaN', async () => {
    stubGeolocation({
      getCurrentPosition: (ok: (pos: unknown) => void) =>
        ok({ coords: { latitude: 1, longitude: 2, accuracy: undefined } }),
    });

    const fix = await requestGpsFix();
    expect(fix.accuracyM).toBeNull();
  });

  it('distinguishes denied permission from an unreadable fix', async () => {
    stubGeolocation({
      getCurrentPosition: (_ok: unknown, fail: (err: unknown) => void) =>
        fail({ code: 1, PERMISSION_DENIED: 1 }),
    });
    await expect(requestGpsFix()).rejects.toThrow(/permission denied/);

    stubGeolocation({
      getCurrentPosition: (_ok: unknown, fail: (err: unknown) => void) =>
        fail({ code: 3, PERMISSION_DENIED: 1 }),
    });
    await expect(requestGpsFix()).rejects.toThrow(/Could not read GPS/);
  });
});

describe('triggerHaptic', () => {
  it('does nothing when the device cannot vibrate', () => {
    expect(() => triggerHaptic('success')).not.toThrow();
  });

  it('maps each feedback type to its vibration pattern once activated', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
    Object.defineProperty(navigator, 'userActivation', {
      value: { hasBeenActive: true },
      configurable: true,
      writable: true,
    });

    triggerHaptic();
    expect(vibrate).toHaveBeenLastCalledWith(10);
    triggerHaptic('medium');
    expect(vibrate).toHaveBeenLastCalledWith(25);
    triggerHaptic('heavy');
    expect(vibrate).toHaveBeenLastCalledWith(45);
    triggerHaptic('success');
    expect(vibrate).toHaveBeenLastCalledWith([15, 50, 20]);
    triggerHaptic('warning');
    expect(vibrate).toHaveBeenLastCalledWith([30, 40, 30]);
    triggerHaptic('error');
    expect(vibrate).toHaveBeenLastCalledWith([50, 60, 50, 60]);
  });

  it('stays silent before the user has interacted with the page', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true });
    Object.defineProperty(navigator, 'userActivation', {
      value: { hasBeenActive: false },
      configurable: true,
      writable: true,
    });

    triggerHaptic('heavy');
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe('audioHaptics', () => {
  it('tracks the mute state', () => {
    setAudioMuted(true);
    expect(isAudioEnabled()).toBe(false);
    setAudioMuted(false);
    expect(isAudioEnabled()).toBe(true);
  });

  it('never throws when audio is muted or the context is unavailable', () => {
    setAudioMuted(true);
    expect(() => playStageChime(2)).not.toThrow();
    expect(() => playScrubTick()).not.toThrow();

    setAudioMuted(false);
    expect(() => playStageChime(0)).not.toThrow();
    expect(() => playScrubTick()).not.toThrow();
    setAudioMuted(false);
  });
});

describe('useOnlineStatus', () => {
  it('tracks browser connectivity events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});

describe('useReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('follows the OS preference and updates when it changes', () => {
    let listener: (() => void) | undefined;
    const mql = {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (_event: string, cb: () => void) => {
        listener = cb;
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    mql.matches = true;
    act(() => {
      listener?.();
    });
    expect(result.current).toBe(true);
  });
});

describe('calculateDeviceBudget', () => {
  it('throttles polling and batch size on a low-memory device', () => {
    const budget = calculateDeviceBudget(2, 8, false);
    expect(budget.isLowEndDevice).toBe(true);
    expect(budget.shouldReduceBlur).toBe(true);
    expect(budget.disableComplexAnimations).toBe(true);
    expect(budget.pollIntervalMs).toBe(30000);
    expect(budget.maxBatchSize).toBe(10);
    expect(budget.memoryGiB).toBe(2);
  });

  it('throttles on a low-core device and when data saver is on', () => {
    expect(calculateDeviceBudget(8, 2, false).isLowEndDevice).toBe(true);
    expect(calculateDeviceBudget(8, 8, true).isLowEndDevice).toBe(true);
  });

  it('keeps full fidelity on a capable device', () => {
    const budget = calculateDeviceBudget(8, 8, false);
    expect(budget.isLowEndDevice).toBe(false);
    expect(budget.shouldReduceBlur).toBe(false);
    expect(budget.pollIntervalMs).toBe(10000);
    expect(budget.maxBatchSize).toBe(50);
  });

  it('assumes 4 GiB and 4 cores when the hardware APIs are unavailable', () => {
    const budget = calculateDeviceBudget(undefined, undefined, false);
    expect(budget.memoryGiB).toBe(4);
    expect(budget.cpuCores).toBe(4);
    expect(budget.isLowEndDevice).toBe(false);
  });
});

describe('useDeviceThermalMemoryBudget', () => {
  it('returns a budget whose throttling flags agree with its own low-end verdict', () => {
    const { result } = renderHook(() => useDeviceThermalMemoryBudget());
    const budget = result.current;

    if (budget.isLowEndDevice) {
      expect(budget.pollIntervalMs).toBe(30000);
      expect(budget.maxBatchSize).toBe(10);
    } else {
      expect(budget.pollIntervalMs).toBe(10000);
      expect(budget.maxBatchSize).toBe(50);
    }
    expect(budget.memoryGiB).toBeGreaterThan(0);
    expect(budget.cpuCores).toBeGreaterThan(0);
  });
});
