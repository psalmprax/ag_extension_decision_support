import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { enterDemoMode, exitDemoMode } from '@/demo';

import { login, demoLogin } from '@/api/authService';
import { getApiErrorMessage } from '@/lib/apiError';

interface LoginProps {
  onDemo?: () => void;
}

export function Login({ onDemo }: LoginProps) {
  const navigate = useNavigate();
  const location = useLocation();
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
      // The JWT itself arrives as an httpOnly cookie — nothing token-shaped is
      // written to localStorage.
      const token = data.token || data.data?.token;
      const userData = data.data?.user || data.user;

      // Store user data
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData as User);
        exitDemoMode();
      }

      if (!userData && !token) {
        throw new Error(t('login_failed_no_token'));
      }

      // Return the user to where they were headed (e.g. a /tele-call/<roomId>
      // invite link that required sign-in first).
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') ? from : '/dashboard');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('login_invalid_credentials')));
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

      // Demo JWT arrives as an httpOnly cookie; only the profile is stored.
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
      setError(getApiErrorMessage(err, 'Demo login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="dark surface-dark min-h-[100dvh] bg-[#0d1a14] text-[#e6eee9] flex items-center justify-center p-4 sm:p-6 relative overflow-y-auto overflow-x-hidden"
      role="main"
      aria-label="Login page"
    >
      {/* ── Warm Agrarian Background Picture & Atmosphere ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/maize-field-sunrise.webp"
          alt=""
          role="presentation"
          aria-hidden="true"
          width={1319}
          height={860}
          className="w-full h-full object-cover object-center opacity-40"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[#0d1a14]/85" />
      </div>

      {/* ── Top Header Navigation Bar ── */}
      <header className="absolute top-0 left-0 right-0 z-30 p-4 sm:p-6 flex items-center justify-between pointer-events-none">
        <Link
          to="/"
          className="pointer-events-auto inline-flex items-center gap-2 h-9 px-3 rounded-md text-[#c5d3cb] hover:text-white hover:bg-white/[0.06] text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label={t('common_back_to_landing', { defaultValue: 'Back to landing page' })}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('common_back_to_landing', { defaultValue: 'Back to landing page' })}</span>
          <span className="sm:hidden">{t('common_back_to_home', { defaultValue: 'Back to home' })}</span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <LanguageSwitcher compact />
        </div>
      </header>

      <div className="w-full max-w-md lg:max-w-5xl grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10 my-auto pt-16 pb-8 sm:py-6">
        {/* Left: who this is for, over a real field photo (desktop only). */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between rounded-lg overflow-hidden relative self-stretch min-h-[520px] border border-white/[0.08]">
          <img
            src="/images/landing/officer-farmer-hero-1024.webp"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a14] via-[#0d1a14]/50 to-[#0d1a14]/30" />
          <div className="relative flex items-center gap-2.5 p-7">
            <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
            <span className="text-base font-medium text-white">{t('app_title')}</span>
          </div>
          <div className="relative p-7">
            <p className="text-2xl font-medium leading-snug text-white max-w-sm">
              {t('ui_login_panel_headline', { defaultValue: 'Advice for farmers, records for the officers who visit them.' })}
            </p>
            <p className="text-sm text-[#c5d3cb] mt-3 max-w-sm">
              {t('ui_login_panel_body', { defaultValue: 'Crop checks, visits and messages by SMS, WhatsApp and Telegram, in one place.' })}
            </p>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-6 bg-[#13241b] border border-white/[0.08] rounded-lg p-7 sm:p-8 w-full relative z-10 self-stretch flex flex-col justify-between"
        >
          <div>
            {/* Header Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-medium text-white">{t('login_title')}</h1>
              <p className="text-white/70 text-sm mt-1">{t('login_subtitle')}</p>
            </div>

            {/* Demo Banner */}
            <div className="mb-6 p-3.5 rounded-md border border-white/[0.1] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-[#c5d3cb]">
                <span>{t('login_want_explore')}</span>
              </div>
              <button
                type="button"
                onClick={handleDemo}
                className="h-8 px-3 text-sm rounded-md border border-white/[0.16] text-white hover:bg-white/[0.06] transition-colors"
              >
                {t('login_try_demo')}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-xs font-medium text-white/70">{t('login_or')}</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-md"
              >
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-sm text-[#c5d3cb] mb-1.5"
                >
                  {t('login_email')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder={t('login_email_placeholder') || 'name@organization.org'}
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm text-[#c5d3cb] mb-1.5"
                >
                  {t('login_password')}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-1"
                    aria-label={showPassword ? 'Hide secret' : 'Show secret'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-white/70 hover:text-white">
                  <input
                    type="checkbox"
                    className="rounded bg-white/10 border-white/20 text-emerald-500 focus:ring-emerald-500/30"
                  />
                  <span>{t('login_remember_me')}</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-emerald-300 hover:text-emerald-200 transition-colors"
                >
                  {t('login_forgot_password')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('login_signing_in')}</span>
                  </>
                ) : (
                  <span>{t('login_sign_in')}</span>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center border-t border-white/5 pt-4">
            <p className="text-xs text-white/70">
              {t('login_no_account')}{' '}
              <Link
                to="/register"
                className="text-emerald-300 hover:text-emerald-200 font-medium transition-colors"
              >
                {t('login_create_account')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Login;
