import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './index.css';
import { initializeTheme } from './theme';
import { LanguageProvider } from './lib/LanguageContext';
import { ThemeProvider } from './lib/ThemeProvider';
import ErrorBoundary from '@ag-extension/shared';
import { CH_COLORS } from '@/lib/colors';
// Global console silencing for production logging compliance
if (!import.meta.env.DEV) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

const queryClient = new QueryClient({
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

// Register PWA Service Worker for offline field operations and caching
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Graceful fallback if sw is unavailable during development
    });
  });
}

// Initialize theme before rendering
initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary reportingEndpoint={import.meta.env.PROD ? '/api/errors' : undefined}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <LanguageProvider>
            <ThemeProvider>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--color-primary-500)',
                    color: 'var(--color-primary-500)',
                  },
                  success: {
                    duration: 3000,
                    style: {
                      background: CH_COLORS.green,
                    },
                  },
                  error: {
                    duration: 4000,
                    style: {
                      background: CH_COLORS.error,
                    },
                  },
                }}
              />
              <MotionConfig
                reducedMotion="user"
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <App />
              </MotionConfig>
            </ThemeProvider>
          </LanguageProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
