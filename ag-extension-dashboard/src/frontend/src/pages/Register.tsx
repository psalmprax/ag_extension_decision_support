import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';
import { RegisterAccountFields } from '@/components/auth/RegisterAccountFields';
import { RegisterAffiliationFields } from '@/components/auth/RegisterAffiliationFields';
import { isTextFieldName, type RegisterFormState } from '@/components/auth/registerForm';
import { register, type RegisterData } from '@/api/authService';
import { getCountryConfig } from '@/lib/countries';
import { getApiErrorMessage } from '@/lib/apiError';
import apiClient from '@/api/client';
import { EncryptedStorageService } from '@/services/encryptedStorageService';

interface PublicConsultationSession {
  messages: Array<{ sender: 'user' | 'assistant'; text: string; language?: string; sourceBadge?: string }>;
  entitySlots?: Record<string, string | null>;
}

async function retrievePendingConsultationSession(): Promise<PublicConsultationSession | null> {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;

  try {
    const raw = window.sessionStorage.getItem('ag_ext_talking_session_raw');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.messages) && parsed.messages.length > 1) {
        return parsed as PublicConsultationSession;
      }
    }
  } catch {
    // ignore
  }

  try {
    const encrypted = window.sessionStorage.getItem('ag_ext_talking_session');
    if (encrypted) {
      const key = await EncryptedStorageService.deriveKeyFromSecret('talking_assistant_public_2026');
      const decrypted = await EncryptedStorageService.decrypt(encrypted, key);
      const parsed = JSON.parse(decrypted);
      if (Array.isArray(parsed?.messages) && parsed.messages.length > 1) {
        return parsed as PublicConsultationSession;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

async function handleHandoffPendingSession(): Promise<boolean> {
  try {
    const pendingSession = await retrievePendingConsultationSession();
    if (!pendingSession || !pendingSession.messages || pendingSession.messages.length <= 1) {
      return false;
    }

    await apiClient.post('/chatbot/import-session', {
      messages: pendingSession.messages,
      entitySlots: pendingSession.entitySlots ?? {},
    });

    window.sessionStorage.removeItem('ag_ext_talking_session');
    window.sessionStorage.removeItem('ag_ext_talking_session_raw');
    return true;
  } catch (err) {
    console.warn('Failed to import pending consultation session:', err);
    return false;
  }
}

export function Register() {
  const navigate = useNavigate();
  const { setUser } = useAppStore();
  const { t } = useLanguage();

  const [formData, setFormData] = useState<RegisterFormState>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    organization: '',
    country: 'Kenya',
    region: '',
    role: 'extension_officer',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [managerNotice, setManagerNotice] = useState('');

  const regionOptions = getCountryConfig(formData.country)?.regions ?? [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'role') {
      setFormData((prev) => ({ ...prev, role: value === 'farmer' ? 'farmer' : 'extension_officer' }));
      return;
    }
    if (name === 'country') {
      // Regions are country-specific; keeping the old one would assign the wrong manager.
      setFormData((prev) => ({ ...prev, country: value, region: '' }));
      return;
    }
    if (isTextFieldName(name)) {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('register_password_mismatch'));
      setIsLoading(false);
      return;
    }

    try {
      const payload: RegisterData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        phone: formData.phone.trim() || undefined,
        country: formData.country || undefined,
        region: formData.region.trim() || undefined,
      };
      const data = await register(payload);

      // Handle nested response structure { success: true, data: { token, user } }
      // The JWT arrives as an httpOnly cookie — only the profile is stored.
      const token = data.token || data.data?.token;
      const userData = data.data?.user || data.user;

      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData as User);
      }

      if (!userData && !token) {
        throw new Error(t('register_failed_no_token'));
      }

      // The account exists, but this region has no regional manager yet. Say so
      // instead of dropping the officer into a dashboard with no manager.
      if (formData.role === 'extension_officer' && data.data?.managerAssigned === false) {
        setManagerNotice(
          formData.region
            ? `Your account is created. No regional manager covers ${formData.region} yet, so an administrator will link your account.`
            : 'Your account is created. An administrator will link your account to a regional manager.'
        );
        return;
      }

      const hasImportedSession = await handleHandoffPendingSession();
      if (hasImportedSession) {
        navigate('/farmer-chat?imported=1');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('register_creation_failed')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 relative overflow-y-auto overflow-x-hidden"
      role="main"
      aria-label="Register page"
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
          className="w-full h-full object-cover object-center opacity-25 filter saturate-[1.1] contrast-[1.05]"
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
          aria-label={t('common_back_to_landing', { defaultValue: 'Back to landing page' })}
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">{t('common_back_to_landing', { defaultValue: 'Back to landing page' })}</span>
          <span className="sm:hidden">{t('common_back_to_home', { defaultValue: 'Back to home' })}</span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <LanguageSwitcher compact />
        </div>
      </header>

      <div className="w-full max-w-md lg:max-w-5xl grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10 my-auto pt-16 pb-8 sm:py-6">
        {/* Left Side: Interactive Agro Intelligence Preview HUD (Desktop) */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden lg:flex lg:col-span-5 flex-col justify-between p-7 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden self-stretch"
        >
          {/* Top Brand & Status */}
          <div className="flex items-center justify-between z-10 pb-2">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GPExts Logo" className="w-9 h-9 object-contain rounded-xl shadow-md" />
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block leading-none">
                  {t('app_title')}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold ">
                  {t('ui_register_enterprise_enrollment')}
                </span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              LIVE
            </span>
          </div>

          {/* Interactive Procedural Canvas in Center */}
          <div className="w-full h-[380px] min-h-[380px] my-3 relative z-10">
            <AgroEcosystemCanvasScrubber interactive={true} showControls={false} autoPlay={true} className="w-full h-full" />
          </div>

          {/* Bottom Live Feature Badges */}
          <div className="space-y-2 z-10 pt-3 border-t border-white/5 text-xs text-stone-300">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{t('ui_register_multi_spectral_field_disease_detecti')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span>{t('ui_register_nasa_power_weather_sync_offline_fiel')}</span>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Register Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-7 backdrop-blur-2xl bg-slate-900/90 border border-white/10 shadow-2xl rounded-xl p-7 sm:p-8 w-full relative z-10 self-stretch flex flex-col justify-between"
          style={{ pointerEvents: 'auto', touchAction: 'auto' }}
        >
          <div>
            {/* Header Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {t('register_title')}
              </h1>
              <p className="text-white/70 text-sm mt-1">{t('register_subtitle')}</p>
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

            {managerNotice && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl backdrop-blur-sm space-y-3"
              >
                <p className="text-sm text-emerald-200">{managerNotice}</p>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm transition-all"
                >
                  {t('ui_register_continue_to_dashboard')}
                </button>
              </div>
            )}

            {!managerNotice && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <RegisterAccountFields
                  formData={formData}
                  onChange={handleChange}
                  showPassword={showPassword}
                  showConfirmPassword={showConfirmPassword}
                  onTogglePassword={() => setShowPassword((prev) => !prev)}
                  onToggleConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
                />

                <RegisterAffiliationFields
                  formData={formData}
                  onChange={handleChange}
                  regionOptions={regionOptions}
                />

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('register_creating_account')}</span>
                    </>
                  ) : (
                    <span>{t('register_button')}</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center border-t border-white/5 pt-4">
            <p className="text-xs text-white/70">
              {t('register_already_have_account')}{' '}
              <Link
                to="/login"
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                {t('register_sign_in')}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default Register;
