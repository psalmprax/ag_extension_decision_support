/**
 * Utility to handle 'Real-First' data fetching.
 * Tries to fetch data from a real backend promise, but falls back to provided dummy data
 * if the promise fails (e.g., backend is offline, network error).
 */
export async function withRealFallback<T>(
  realPromise: Promise<{ success: boolean; data: T } | unknown>,
  fallbackData: T
): Promise<T> {
  try {
    const response = await realPromise;
    const r = response as { success: boolean; data: T } | undefined;

    if (r?.success && r.data !== undefined) {
      return r.data;
    }

    if (response !== undefined && !('success' in (response as object))) {
      return response as T;
    }

    if (r?.data) {
      return r.data;
    }

    return fallbackData;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Real-First Fallback Activated:', error);
    }
    return fallbackData;
  }
}
