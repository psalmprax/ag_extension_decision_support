import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy loaded public page components
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const DemoPage = lazy(() => import('./pages/DemoPage').then(m => ({ default: m.DemoPage })));

function App() {
    const user = useAppStore((s) => s.user);

    // Public routes
    if (!user) {
        return (
            <ErrorBoundary componentName="PublicAuth">
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>}>
                    <Routes>
                        <Route path="/login" element={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4"><Login /></div>} />
                        <Route path="/register" element={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4"><Register /></div>} />
                        <Route path="/forgot-password" element={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4"><ForgotPassword /></div>} />
                        <Route path="/demo" element={<DemoPage />} />
                        <Route path="*" element={<LandingPage />} />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        );
    }

    // Authenticated routes
    return (
        <ErrorBoundary componentName="AuthenticatedApp">
            <AuthenticatedLayout />
        </ErrorBoundary>
    );
}

export default App;
