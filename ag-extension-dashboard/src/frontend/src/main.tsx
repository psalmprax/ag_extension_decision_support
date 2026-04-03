import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { initializeTheme } from './theme';
import { LanguageProvider } from './lib/LanguageContext';
import { ThemeProvider } from './lib/ThemeProvider';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
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

// Register Service Worker for PWA
registerSW({ immediate: true });

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
                                        background: '#333',
                                        color: '#fff',
                                    },
                                    success: {
                                        duration: 3000,
                                        style: {
                                            background: '#22c55e',
                                        },
                                    },
                                    error: {
                                        duration: 4000,
                                        style: {
                                            background: '#ef4444',
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
