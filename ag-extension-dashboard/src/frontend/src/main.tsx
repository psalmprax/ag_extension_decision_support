import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
// import { registerSW } from 'virtual:pwa-register';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { SMSPage } from './pages/SMS';
import { ProtectedRoute } from './components/ProtectedRoute';
import './index.css';
import { initializeTheme } from './theme';
import { LanguageProvider } from './lib/LanguageContext';
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

async function enableMocking() {
    const params = new URLSearchParams(window.location.search);
    const mockParam = params.get('mock');
    
    // Only enable mocking if explicitly requested via ?mock=true
    // or if we are in development AND the real backend is unreachable (handled by manual override for now)
    if (mockParam !== 'true') {
        return;
    }

    const { worker } = await import('./mocks/browser');
    return worker.start({
        onUnhandledRequest: 'bypass',
    });
}

// Initialize theme before rendering
initializeTheme();

// Register Service Worker for PWA
// registerSW({ immediate: true });

enableMocking().then(() => {
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
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route
                                    path="/sms"
                                    element={
                                        <ProtectedRoute>
                                            <SMSPage />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/*"
                                    element={
                                        <ProtectedRoute>
                                            <App />
                                        </ProtectedRoute>
                                    }
                                />
                            </Routes>
                            <Toaster
                                position="top-right"
                                toastOptions={{
                                    duration: 4000,
                                    style: {
                                        background: '#363636',
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
                        </LanguageProvider>
                    </BrowserRouter>
                </QueryClientProvider>
            </ErrorBoundary>
        </React.StrictMode>
    );
});
