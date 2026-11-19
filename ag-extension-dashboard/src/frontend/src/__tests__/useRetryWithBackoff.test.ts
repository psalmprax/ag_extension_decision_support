import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRetryWithBackoff } from '@/hooks/useRetryWithBackoff';

const FAST = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, backoffMultiplier: 1 };

describe('useRetryWithBackoff', () => {
  it('returns the value on a first-attempt success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('fresh advisory');
    const { result } = renderHook(() => useRetryWithBackoff(fn, FAST));

    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.execute();
    });

    expect(returned).toBe('fresh advisory');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('fresh advisory');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.attempts).toBe(1);
    expect(result.current.maxAttempts).toBe(3);
  });

  it('retries a transient failure and succeeds on the third attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('recovered');
    const { result } = renderHook(() => useRetryWithBackoff(fn, FAST));

    await act(async () => {
      await result.current.execute();
    });

    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.current.data).toBe('recovered');
    expect(result.current.error).toBeNull();
    expect(result.current.attempts).toBe(3);
  });

  it('exposes the final error after exhausting every attempt and never throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('tile server down'));
    const { result } = renderHook(() => useRetryWithBackoff(fn, FAST));

    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.execute();
    });

    expect(returned).toBeNull();
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe('tile server down');
    expect(result.current.isLoading).toBe(false);
  });

  it('normalizes a non-Error rejection into an Error', async () => {
    const fn = vi.fn().mockRejectedValue('plain string failure');
    const { result } = renderHook(() => useRetryWithBackoff(fn, { ...FAST, maxAttempts: 1 }));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('plain string failure');
  });

  it('honours a single-attempt configuration', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useRetryWithBackoff(fn, { ...FAST, maxAttempts: 1 }));

    await act(async () => {
      await result.current.execute();
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.maxAttempts).toBe(1);
  });

  it('clears data, error and attempt count on reset', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useRetryWithBackoff(fn, { ...FAST, maxAttempts: 1 }));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.attempts).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRetrying).toBe(false);
  });

  it('ignores a second execute() while one is already running', async () => {
    let release: (value: string) => void = () => undefined;
    const gate = new Promise<string>(resolve => {
      release = resolve;
    });
    const fn = vi.fn(() => gate);
    const { result } = renderHook(() => useRetryWithBackoff(fn, FAST));

    let first: Promise<string | null> | undefined;
    act(() => {
      first = result.current.execute();
    });

    let second: string | null = 'unset';
    await act(async () => {
      second = await result.current.execute();
    });

    expect(second).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      release('done');
      await first;
    });
    expect(result.current.data).toBe('done');
  });

  it('returns null instead of writing state after unmount', async () => {
    const fn = vi.fn().mockResolvedValue('late');
    const { result, unmount } = renderHook(() => useRetryWithBackoff(fn, FAST));
    unmount();

    let returned: unknown = 'unset';
    await act(async () => {
      returned = await result.current.execute();
    });

    expect(returned).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('uses the latest callback reference without requiring the caller to memoize', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const second = vi.fn().mockResolvedValue('second');
    const { result, rerender } = renderHook(
      ({ fn }) => useRetryWithBackoff(fn, FAST),
      { initialProps: { fn: first } }
    );

    rerender({ fn: second });
    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBe('second');
    expect(first).not.toHaveBeenCalled();
  });
});
