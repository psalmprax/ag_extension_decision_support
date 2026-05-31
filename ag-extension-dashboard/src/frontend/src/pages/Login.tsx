import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Sprout } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useDesignSystemMode } from '@/hooks/useDesignSystemMode';

import { login, demoLogin } from '@/api/authService';

interface LoginProps {
    onDemo?: () => void;
}

export function Login({ onDemo }: LoginProps) {
    const navigate = useNavigate();
    const { setUser } = useAppStore();
    const { t } = useLanguage();
    const { isModern, radiusClass, btnClass } = useDesignSystemMode();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const data = await login({ email, password });

            // Handle nested response structure { success: true, data: { token, user } }
            const token = data.token || data.data?.token;
            const userData = data.data?.user || data.user;

            // Store token in localStorage for API requests
            if (token) {
                localStorage.setItem('token', token);
            }
            // Also store user data
            if (userData) {
                localStorage.setItem('user', JSON.stringify(userData));
                setUser(userData as User);
            }

            if (!token) {
                throw new Error(t('login_failed_no_token'));
            }

            navigate('/dashboard');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message?: string };
            const errorMsg = error.response?.data?.error || error.message || t('login_invalid_credentials');
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDemo = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await demoLogin();

            const token = data.token || data.data?.token;
            const userData = data.data?.user || data.user;

            if (token) localStorage.setItem('token', token);
            if (userData) {
                localStorage.setItem('user', JSON.stringify(userData));
                setUser(userData as User);
            }

            if (!token) {
                throw new Error('Demo login failed: No access token received');
            }

            onDemo?.();
            navigate('/dashboard');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message?: string };
            const errorMsg = error.response?.data?.error || error.message || 'Demo login failed';
            setError(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4" role="main" aria-label="Login page">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-gray-800 ${radiusClass} shadow-xl p-8 w-full max-w-md`}
                role="form"
                aria-label="Login form"
            >
                {/* Logo and Language Switcher */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex-1 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
                            <Sprout className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('login_title')}</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('login_subtitle')}</p>
                    </div>
                    <div className="pt-2">
                        <LanguageSwitcher compact />
                    </div>
                </div>

                {/* Demo Banner */}
                <div className={`mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 ${radiusClass} border border-blue-200 dark:border-blue-800`}>
                    <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                        {t('login_want_explore')}{' '}
                        <button
                            type="button"
                            onClick={handleDemo}
                            className="font-semibold underline hover:text-blue-800 dark:hover:text-blue-200"
                        >
                            {t('login_try_demo')}
                        </button>
                    </p>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                    <span className="text-sm text-gray-400">{t('login_or')}</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className={`mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 ${radiusClass}`}>
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t('login_email')}
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full px-4 py-3 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent`}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('login_password')}
                            </label>
                            <Link to="/forgot-password" className="text-xs text-green-600 dark:text-green-400 font-medium hover:underline">
                                {t('login_forgot_password') || 'Forgot password?'}
                            </Link>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full px-4 py-3 pr-12 ${radiusClass} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent`}
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold ${btnClass} transition-colors flex items-center justify-center gap-2`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {t('login_signing_in')}
                            </>
                        ) : (
                            t('login_sign_in')
                        )}
                    </button>
                </form>

                {/* Register Link */}
                <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
                    {t('login_no_account')}{' '}
                    <Link to="/register" className="text-green-600 dark:text-green-400 font-medium hover:underline">
                        {t('login_register_here')}
                    </Link>
                </p>

                {/* Version Badge for Cache Verification */}
                <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-center">
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded uppercase tracking-wider">
                        App Version: v1.0.2 [Hardened]
                    </span>
                </div>
            </motion.div>
        </div>
    );
}

export default Login;
