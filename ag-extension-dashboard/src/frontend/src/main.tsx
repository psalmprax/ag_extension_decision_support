import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { initializeTheme } from './theme';
import { LanguageProvider } from './lib/LanguageContext';
import { ThemeProvider } from './lib/ThemeProvider';
import ErrorBoundary from './components/ErrorBoundary';
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


// Force unregister any existing service workers to clear stale content
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
            registration.unregister();
        }
    });
}

// Initialize theme before rendering
initializeTheme();



ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
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
                            <App />
                        </ThemeProvider>
                    </LanguageProvider>
                </BrowserRouter>
            </QueryClientProvider>
        </ErrorBoundary>
    </React.StrictMode>
);
