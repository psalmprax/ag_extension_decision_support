import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { enterDemoMode, exitDemoMode } from '@/demo';
import { LiquidBackgroundCanvas } from '@/components/canvasui/LiquidBackgroundCanvas';
import { LiquidToggleSwitch } from '@/components/canvasui/LiquidToggleSwitch';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';

import { login, demoLogin } from '@/api/authService';

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

      // Return the user to where they were headed (e.g. a /tele-call/<roomId>
      // invite link that required sign-in first).
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/') ? from : '/dashboard');
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
      className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      role="main"
      aria-label="Login page"
    >
      {/* ── Liquid WebGL Fluid Background & Ambient Glow ── */}
      <LiquidBackgroundCanvas />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/[0.12] blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-500/[0.08] blur-[150px]" />
      </div>

      <div className="w-full max-w-md lg:max-w-5xl grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10 my-auto py-6">
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
          <div className="flex-1 min-h-[300px] w-full my-3 rounded-xl overflow-hidden border border-white/5 relative z-10 bg-slate-950">
            <AgroEcosystemCanvasScrubber interactive={true} showControls={false} autoPlay={true} />
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

