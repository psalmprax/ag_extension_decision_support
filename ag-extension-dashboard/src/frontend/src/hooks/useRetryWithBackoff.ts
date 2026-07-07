import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseRetryWithBackoffOptions {
  /** Total number of attempts (including the first call). Default: 3. */
  maxAttempts?: number;
  /** Delay before the first retry, in ms. Default: 800. */
  baseDelayMs?: number;
  /** Cap on the exponential backoff delay, in ms. Default: 8000. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each failed attempt. Default: 2. */
  backoffMultiplier?: number;
}

export interface UseRetryWithBackoffResult<T> {
  /** The data returned by the most recent successful `execute()` call. */
  data: T | null;
  /** The final error after all attempts failed, otherwise null. */
  error: Error | null;
  /** True while `execute()` is in progress (including retry delays). */
  isLoading: boolean;
  /** True while a retry attempt is in progress (false on the first attempt). */
  isRetrying: boolean;
  /** Number of attempts completed in the current cycle (1..maxAttempts). */
  attempts: number;
  /** Configured max attempts. */
  maxAttempts: number;
  /** Run the wrapped function with retry/backoff. Returns the data on success, null on failure/unmount. */
  execute: () => Promise<T | null>;
  /** Clear all state so a new `execute()` call starts fresh. */
  reset: () => void;
}

/**
 * Run an async function with exponential backoff between failed attempts.
 *
 * Never throws. Returns safe defaults on unmount, cancellation, or after
 * `maxAttempts` consecutive failures. The `fn` reference is read fresh on
 * each call via a ref so callers don't need to memoize it.
 */
export function useRetryWithBackoff<T = unknown>(
  fn: () => Promise<T>,
  options: UseRetryWithBackoffOptions = {}
): UseRetryWithBackoffResult<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 800,
    maxDelayMs = 8000,
    backoffMultiplier = 2,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // Latest fn reference — avoids stale closures without forcing callers to memoize.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const isUnmountedRef = useRef(false);
  const isExecutingRef = useRef(false);
  // Bumped on every `reset()` so in-flight retries from a previous cycle bail
  // out before overwriting the new cycle's state (e.g. rapid "Try Again").
  const generationRef = useRef(0);

  const sleep = useCallback(
    (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
    []
  );

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const execute = useCallback(async (): Promise<T | null> => {
    if (isExecutingRef.current) return null;
    isExecutingRef.current = true;
    const myGeneration = generationRef.current;
    setIsLoading(true);
    setError(null);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (isUnmountedRef.current) break;
      if (myGeneration !== generationRef.current) break;
      setAttempts(attempt);

      try {
        const result = await fnRef.current();
        if (isUnmountedRef.current) return null;
        if (myGeneration !== generationRef.current) return null;
        setData(result);
        setError(null);
        setIsLoading(false);
        isExecutingRef.current = false;
        return result;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxAttempts) {
          const delay = Math.min(
            baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
            maxDelayMs
          );
          await sleep(delay);
          if (isUnmountedRef.current) return null;
          if (myGeneration !== generationRef.current) return null;
        }
      }
    }

    if (isUnmountedRef.current) return null;
    if (myGeneration !== generationRef.current) return null;
    setError(lastError);
    setIsLoading(false);
    isExecutingRef.current = false;
    return null;
  }, [maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier, sleep]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setAttempts(0);
    isExecutingRef.current = false;
    // Invalidate any in-flight retry so its state writes are ignored.
    generationRef.current += 1;
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    isRetrying: isLoading && attempts > 1,
    attempts,
    maxAttempts,
    execute,
    reset,
  };
}
