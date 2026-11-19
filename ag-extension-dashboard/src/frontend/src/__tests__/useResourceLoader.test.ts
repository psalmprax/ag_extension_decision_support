import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useResourceLoader } from '@/hooks/useResourceLoader';

const { addNotification } = vi.hoisted(() => ({ addNotification: vi.fn() }));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ addNotification }),
}));

type Payload = { templates: string[]; stats: string };

const successLoad = () =>
  vi.fn(async (_category: string | undefined) => ({
    templates: { success: true, data: ['welcome-email'] },
    stats: { success: true, data: 'ok' },
  }));

function setup(
  load: (category: string | undefined) => Promise<{
    templates: { success: boolean; data: string[] };
    stats: { success: boolean; data: string };
  }>,
  initialCategory?: string
) {
  return renderHook(() =>
    useResourceLoader<Payload>({ load, errorMessage: 'Could not load resources', initialCategory })
  );
}

describe('useResourceLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches once on mount with no category filter and merges keyed data', async () => {
    const load = successLoad();
    const { result } = setup(load);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(undefined);
    expect(result.current.selectedCategory).toBe('all');
    expect(result.current.data.templates).toEqual(['welcome-email']);
    expect(result.current.data.stats).toBe('ok');
    expect(result.current.isRefreshing).toBe(false);
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('starts in loading state before the first response resolves', () => {
    const load = successLoad();
    const { result } = setup(load);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual({});
  });

  it('drops keys the caller reported as failed instead of caching partial junk', async () => {
    const load = vi.fn(async () => ({
      templates: { success: true, data: ['a'] },
      stats: { success: false, data: 'stale' },
    }));
    const { result } = setup(load);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.templates).toEqual(['a']);
    expect(result.current.data.stats).toBeUndefined();
  });

  it('passes the selected category to the loader and preserves earlier keys', async () => {
    const load = successLoad();
    const { result } = setup(load);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedCategory('email');
    });

    await waitFor(() => expect(load).toHaveBeenCalledWith('email'));
    expect(result.current.selectedCategory).toBe('email');
    expect(result.current.data.templates).toEqual(['welcome-email']);
  });

  it('honours a non-default initial category', async () => {
    const load = successLoad();
    const { result } = setup(load, 'sms');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(load).toHaveBeenCalledWith('sms');
    expect(result.current.selectedCategory).toBe('sms');
  });

  it('reload() is a silent fetch that never sets isRefreshing', async () => {
    const load = successLoad();
    const { result } = setup(load);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.reload();
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('refresh() is the user-initiated fetch that sets isRefreshing while it runs', async () => {
    // The mount fetch settles immediately; only the refresh is held open, so the
    // assertion on the in-flight flag cannot race the response.
    let releaseRefresh: () => void = () => undefined;
    const refreshGate = new Promise<void>(resolve => {
      releaseRefresh = resolve;
    });
    let calls = 0;
    const load = vi.fn(async () => {
      calls += 1;
      if (calls === 2) await refreshGate;
      return {
        templates: { success: true, data: ['fresh'] },
        stats: { success: true, data: 'ok' },
      };
    });
    const { result } = setup(load);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.refresh();
    });
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));

    await act(async () => {
      releaseRefresh();
      await pending;
    });
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.data.templates).toEqual(['fresh']);
  });

  it('notifies the user and logs the cause when the loader rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = vi.fn(async () => {
      throw new Error('network down');
    });
    const { result } = setup(load);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(addNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Could not load resources',
    });
    expect(consoleError).toHaveBeenCalled();
    expect(result.current.data).toEqual({});
  });
});
