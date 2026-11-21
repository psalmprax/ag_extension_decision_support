import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { enterDemoMode, exitDemoMode } from '@/demo';

import { login, demoLogin, type AuthResponse } from '@/api/authService';
import { PhoneSignInForm } from '@/components/auth/PhoneSignInForm';
import { getApiErrorMessage } from '@/lib/apiError';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AUTH_CARD, AUTH_INPUT, AUTH_SUBMIT } from '@/components/ui/controlStyles';

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
  const [usePhone, setUsePhone] = useState(false);

  /** Store the signed-in user and go where they were headed (shared by email and phone sign-in). */
  const finishSignIn = (data: AuthResponse) => {
    // The JWT itself arrives as an httpOnly cookie — nothing token-shaped is
    // written to localStorage.
    const token = data.token || data.data?.token;
    const userData = data.data?.user || data.user;
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData as User);
      exitDemoMode();
    }
    if (!userData && !token) throw new Error(t('login_failed_no_token'));
    // Return the user to where they were headed (e.g. a /tele-call/<roomId>
    // invite link that required sign-in first).
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from.startsWith('/') ? from : '/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      finishSignIn(await login({ email, password }));
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
    <AuthLayout
      label="Login page"
      headline={t('ui_login_panel_headline', { defaultValue: 'Advice for farmers, records for the officers who visit them.' })}
      body={t('ui_login_panel_body', { defaultValue: 'Crop checks, visits and messages by SMS, WhatsApp and Telegram, in one place.' })}
    >
      <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${AUTH_CARD} relative z-10 flex flex-col justify-between`}
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

            {usePhone ? (
              <PhoneSignInForm onSignedIn={finishSignIn} onUseEmail={() => setUsePhone(false)} />
            ) : (
            <>
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
                  className={AUTH_INPUT}
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
                    className={`${AUTH_INPUT} pe-12`}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors p-1"
                    aria-label={showPassword ? 'Hide secret' : 'Show secret'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end text-sm pt-1">
                <Link
                  to="/forgot-password"
                  className="text-emerald-300 hover:text-emerald-200 transition-colors"
                >
                  {t('login_forgot_password')}
                </Link>
              </div>

              <button type="submit" disabled={isLoading} className={`${AUTH_SUBMIT} mt-2`}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('login_signing_in')}</span>
                  </>
                ) : (
                  <span>{t('login_sign_in')}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setError(''); setUsePhone(true); }}
                className="w-full text-center text-sm text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                {t('phone_login_switch', { defaultValue: 'Sign in with your phone number' })}
              </button>
            </form>
            </>
            )}
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
    </AuthLayout>
  );
}

export default Login;
