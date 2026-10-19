import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { enterDemoMode, exitDemoMode } from '@/demo';
import { LiquidToggleSwitch } from '@/components/canvasui/LiquidToggleSwitch';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';

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
      className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
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
          className="w-full h-full object-cover object-center opacity-25 filter saturate-110 contrast-105"
          loading="eager"
          decoding="async"
        />
        {/* Soft, warm agrarian sunlit vignette overlays preserving contrast & readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/80 via-slate-950/85 to-slate-950/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(245,158,11,0.15),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.12),transparent_70%)]" />
      </div>

      {/* ── Ambient Glow ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/[0.12] blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-500/[0.08] blur-[150px]" />
      </div>

      {/* ── Top Header Navigation Bar ── */}
      <header className="absolute top-0 left-0 right-0 z-30 p-4 sm:p-6 flex items-center justify-between pointer-events-none">
        <Link
          to="/"
          className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold backdrop-blur-md shadow-lg transition-all active:scale-95 group focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label={t('common_back_to_landing', { defaultValue: 'Back to Landing Page' })}
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">{t('common_back_to_landing', { defaultValue: 'Back to Landing Page' })}</span>
          <span className="sm:hidden">{t('common_back_to_home', { defaultValue: 'Back to Home' })}</span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <LiquidToggleSwitch compact />
          <LanguageSwitcher compact />
        </div>
      </header>

      <div className="w-full max-w-md lg:max-w-5xl grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10 my-auto pt-16 pb-8 sm:py-6">
        {/* Left Side: Interactive Agro Intelligence Preview HUD (Desktop) */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden lg:flex lg:col-span-6 flex-col justify-between p-7 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden self-stretch"
        >
          {/* Top Brand & Status */}
          <div className="flex items-center justify-between z-10 pb-2">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GPExts Logo" className="w-9 h-9 object-contain rounded-xl shadow-md" />
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block leading-none">
                  GPExts
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold tracking-wider">
                  DECISION SUPPORT PLATFORM
                </span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE TELEMETRY
            </span>
          </div>

          {/* Interactive Procedural Canvas in Center */}
          <div className="w-full h-[360px] min-h-[360px] my-3 relative z-10">
            <AgroEcosystemCanvasScrubber interactive={true} showControls={false} autoPlay={true} className="w-full h-full" />
          </div>

          {/* Bottom Live Feature Badges */}
          <div className="grid grid-cols-3 gap-2 text-center z-10 pt-3 border-t border-white/5">
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-[10px] font-mono text-sky-400 font-bold">NASA POWER</div>
              <div className="text-[11px] text-white/80 font-medium">Solar & Rain</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-[10px] font-mono text-emerald-400 font-bold">SOILGRIDS</div>
              <div className="text-[11px] text-white/80 font-medium">Stratigraphy</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-[10px] font-mono text-purple-400 font-bold">OFFLINE USSD</div>
              <div className="text-[11px] text-white/80 font-medium">Edge Sync</div>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-6 backdrop-blur-2xl bg-slate-900/90 border border-white/10 shadow-2xl rounded-xl p-7 sm:p-8 w-full relative z-10 self-stretch flex flex-col justify-between"
          role="form"
          aria-label="Login form"
        >
          <div>
            {/* Back to Landing Navigation (In-Card) */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-emerald-400 transition-all mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-fit group"
              aria-label={t('common_back_to_landing', { defaultValue: 'Back to Landing Page' })}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>{t('common_back_to_landing', { defaultValue: 'Back to Landing Page' })}</span>
            </Link>

            {/* Logo and Language Switcher */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h1 className="text-2xl font-bold tracking-tight text-white">{t('login_title')}</h1>
                <p className="text-white/60 text-sm mt-1">{t('login_subtitle')}</p>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <LiquidToggleSwitch compact />
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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder={t('login_email_placeholder') || 'name@organization.org'}
                  autoComplete="email"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
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
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
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
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {t('login_forgot_password')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
            <p className="text-xs text-white/50">
              {t('login_no_account')}{' '}
              <Link
                to="/register"
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
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
