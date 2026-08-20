import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { enterDemoMode, exitDemoMode } from '@/demo';
import { Liquid } from '@/components/canvasui/Liquid';

import { login, demoLogin } from '@/api/authService';

interface LoginProps {
  onDemo?: () => void;
}

export function Login({ onDemo }: LoginProps) {
  const navigate = useNavigate();
  const { setUser, setIsDemo } = useAppStore();
  const { t } = useLanguage();

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
        exitDemoMode();
      }

      if (!token) {
        throw new Error(t('login_failed_no_token'));
      }

      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMsg =
        error.response?.data?.error || error.message || t('login_invalid_credentials');
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
        // Centralized demo entry — sets the demo user + flips the mode flag.
        enterDemoMode(userData as User);
      } else {
        setIsDemo(true);
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
    <div
      className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden"
      role="main"
      aria-label="Login page"
    >
      {/* ── Liquid WebGL Fluid Background & Ambient Glow ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <Liquid
          style={{ position: 'absolute', inset: 0 }}
          color={[0.03, 0.76, 0.52]}
          intensity={1.7}
          radius={0.35}
          force={1.4}
          distortion={1.1}
          blend={0.65}
        >
          {null}
        </Liquid>
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/[0.12] blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-500/[0.08] blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 shadow-2xl rounded-2xl p-8 w-full max-w-md relative z-10"
        role="form"
        aria-label="Login form"
      >
        {/* Logo and Language Switcher */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1 text-center">
            <img
              src="/logo.png"
              alt="Ag-Extension Logo"
              className="w-16 h-16 mx-auto mb-3 rounded-2xl shadow-xl shadow-emerald-950/40 object-contain"
            />
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('login_title')}</h1>
            <p className="text-white/60 text-sm mt-1">{t('login_subtitle')}</p>
          </div>
          <div className="pt-1">
            <LanguageSwitcher compact />
          </div>
        </div>

        {/* Demo Banner */}
        <div className="mb-6 p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            <span>{t('login_want_explore')}</span>
          </div>
          <button
            type="button"
            onClick={handleDemo}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 transition-colors"
          >
            {t('login_try_demo')}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{t('login_or')}</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl backdrop-blur-sm"
          >
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
            >
              {t('login_email')}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-white/70 uppercase tracking-wide"
              >
                {t('login_password')}
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                {t('login_forgot_password') || 'Forgot password?'}
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide secret text' : 'Show secret text'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
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
        <p className="mt-6 text-center text-sm text-white/60">
          {t('login_no_account')}{' '}
          <Link
            to="/register"
            className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
          >
            {t('login_register_here')}
          </Link>
        </p>

        {/* Version Badge */}
        <div className="mt-8 pt-4 border-t border-white/10 flex justify-center">
          <span className="px-2.5 py-0.5 text-xxs font-mono bg-white/[0.05] border border-white/10 text-white/40 rounded-full tracking-wider">
            APP VERSION: v1.0.2 [HARDENED]
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
