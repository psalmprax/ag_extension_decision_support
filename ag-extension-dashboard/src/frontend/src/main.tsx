import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './index.css';
import { initializeTheme } from './theme';
import { LanguageProvider } from './lib/LanguageContext';
import { ThemeProvider } from './lib/ThemeProvider';
import ErrorBoundary from '@ag-extension/shared';
import { CH_COLORS } from '@/lib/colors';
import { queryClient } from './lib/queryClient';
// Global console silencing for production logging compliance
if (!import.meta.env.DEV) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}

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
        <BrowserRouter>
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
