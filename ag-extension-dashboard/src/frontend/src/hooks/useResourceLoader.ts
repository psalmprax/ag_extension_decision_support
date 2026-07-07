import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

/** Adds the `{ success, data }` response wrapper around each value type in T. */
type WrapSuccess<T extends Record<string, unknown>> = {
  [K in keyof T]: { success: boolean; data: T[K] };
};

interface UseResourceLoaderOptions<T extends Record<string, unknown>> {
  /**
   * Parallel fetcher invoked whenever the category changes or reload()/refresh() is called.
   * Receives `undefined` when the user-selected category is the 'all' sentinel so callers
   * can pass it straight through to the API as a "no filter" argument.
   */
  load: (category: string | undefined) => Promise<WrapSuccess<T>>;
  /** Localized message used as the error toast on fetch failure. */
  errorMessage: string;
  /** Initial category filter. Defaults to 'all'. */
  initialCategory?: string;
}

interface UseResourceLoaderReturn<T extends Record<string, unknown>> {
  /**
   * Partial-collection map keyed by resource name. Each value is the most-recent
   * successfully-fetched value, or `undefined` until the first successful fetch
   * for that key. Coalesce with `?? []` at call sites that need a fallback.
   *
   * Types are preserved end-to-end: if T declares `{ templates: EmailTemplate[] }`,
   * `data.templates` is `EmailTemplate[] | undefined` — no manual cast required.
   */
  data: Partial<T>;
  /** Currently-selected category filter ('all' is the no-filter sentinel). */
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  /** True during the initial fetch and during a silent reload(). */
  isLoading: boolean;
  /** True only during an explicit refresh() call (header refresh button). */
  isRefreshing: boolean;
  /** Silent re-fetch — sets isLoading instead of isRefreshing. Use after mutations. */
  reload: () => Promise<void>;
  /** User-initiated re-fetch — sets isRefreshing. Use for the header refresh button. */
  refresh: () => Promise<void>;
}

/**
 * Encapsulates the category-filter + parallel-fetch state machine previously
 * duplicated (audit dup:73594d16) across EmailWorkflows.tsx and Memory.tsx:
 *   - one `selectedCategory` filter (default 'all', mapped to `undefined` for the API)
 *   - one parallel `load(category)` call whose keyed responses are merged into `data`
 *   - the `isLoading` (initial/silent) vs `isRefreshing` (header-button) split
 *   - the standard success/error/finally toast handling
 */
export function useResourceLoader<T extends Record<string, unknown>>(
  options: UseResourceLoaderOptions<T>
): UseResourceLoaderReturn<T> {
  const { addNotification } = useAppStore();

  const [selectedCategory, setSelectedCategory] = useState(options.initialCategory ?? 'all');
  const [data, setData] = useState<Partial<T>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Both `load` and `errorMessage` are typically recreated every render (the caller's
  // `load` is an inline arrow; `errorMessage` is usually `t(...)` which yields a fresh
  // string reference each render). If either appeared in `doLoad`'s useCallback deps,
  // `doLoad` would invalidate every render and the inner useEffect would re-fire
  // the initial fetch — an infinite re-fetch loop. Isolate both as refs.
  const loadRef = useRef(options.load);
  loadRef.current = options.load;
  const errorMessageRef = useRef(options.errorMessage);
  errorMessageRef.current = options.errorMessage;

  const doLoad = useCallback(
    async (showRefresh: boolean) => {
      try {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        const responses = await loadRef.current(
          selectedCategory === 'all' ? undefined : selectedCategory
        );
        setData(prev => {
          const next = { ...prev };
          (Object.keys(responses) as (keyof T)[]).forEach(k => {
            const r = responses[k];
            if (r.success) next[k] = r.data as T[typeof k];
          });
          return next;
        });
      } catch (err) {
        console.error(`${errorMessageRef.current}:`, err);
        addNotification({ type: 'error', message: errorMessageRef.current });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedCategory, addNotification]
  );

  useEffect(() => {
    doLoad(false);
  }, [doLoad]);

  const reload = useCallback(() => doLoad(false), [doLoad]);
  const refresh = useCallback(() => doLoad(true), [doLoad]);

  return {
    data,
    selectedCategory,
    setSelectedCategory,
    isLoading,
    isRefreshing,
    reload,
    refresh,
  };
}
