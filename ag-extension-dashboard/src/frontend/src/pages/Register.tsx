import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { RegisterAccountFields } from '@/components/auth/RegisterAccountFields';
import { RegisterAffiliationFields } from '@/components/auth/RegisterAffiliationFields';
import { isTextFieldName, type RegisterFormState } from '@/components/auth/registerForm';
import { register, type RegisterData } from '@/api/authService';
import { browserCountry, getCountryConfig } from '@/lib/countries';
import { getApiErrorMessage } from '@/lib/apiError';
import apiClient from '@/api/client';
import { EncryptedStorageService } from '@/services/encryptedStorageService';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AUTH_CARD } from '@/components/ui/controlStyles';
import { safeStorage } from '@/lib/safeStorage';
import { useSignupChallenge } from '@/hooks/useSignupChallenge';
import { SignupHoneypot } from '@/components/auth/SignupHoneypot';

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
    country: browserCountry() ?? 'Kenya',
    region: '',
    role: 'extension_officer',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [managerNotice, setManagerNotice] = useState('');
  const formToken = useSignupChallenge();
  const honeypotRef = useRef<HTMLInputElement>(null);

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
      const data = await register(payload, { formToken, website: honeypotRef.current?.value ?? '' });

      // Handle nested response structure { success: true, data: { token, user } }
      // The JWT arrives as an httpOnly cookie — only the profile is stored.
      const token = data.token || data.data?.token;
      const userData = data.data?.user || data.user;

      if (userData) {
        safeStorage.set('user', JSON.stringify(userData));
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
    <AuthLayout
      label="Registration page"
      headline={t('ui_register_panel_headline', { defaultValue: 'Officers, managers and farmers each get their own workspace.' })}
      body={t('ui_register_panel_body', { defaultValue: 'Your regional manager is assigned from the region you choose.' })}
      wide
    >
      <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${AUTH_CARD} relative z-10 flex flex-col justify-between`}
          style={{ pointerEvents: 'auto', touchAction: 'auto' }}
        >
          <div>
            {/* Header Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-medium text-white">
                {t('register_title')}
              </h1>
              <p className="text-white/70 text-sm mt-1">{t('register_subtitle')}</p>
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

            {managerNotice && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-md space-y-3"
              >
                <p className="text-sm text-emerald-200">{managerNotice}</p>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-sm transition-colors"
                >
                  {t('ui_register_continue_to_dashboard')}
                </button>
              </div>
            )}

            {!managerNotice && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <SignupHoneypot ref={honeypotRef} />
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
                  className="w-full h-12 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="mt-6 text-center border-t border-white/[0.08] pt-4">
            <p className="text-xs text-white/70">
              {t('register_already_have_account')}{' '}
              <Link
                to="/login"
                className="text-emerald-300 hover:text-emerald-200 font-medium transition-colors"
              >
                {t('register_sign_in')}
              </Link>
            </p>
          </div>
        </motion.div>
    </AuthLayout>
  );
}

export default Register;
