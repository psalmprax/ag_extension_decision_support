import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        // Don't retry on 401 errors (authentication required)
        const e = error as { response?: { status?: number } } | null | undefined;
        if (e && typeof e === 'object' && e.response && e.response.status === 401) {
          return false;
        }
        // Retry other errors once
        return failureCount < 1;
      },
      staleTime: 5 * 60 * 1000,
    },
  },
});
