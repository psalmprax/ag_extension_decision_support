import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAppStore, type User } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LiquidBackgroundCanvas } from '@/components/canvasui/LiquidBackgroundCanvas';
import { LiquidToggleSwitch } from '@/components/canvasui/LiquidToggleSwitch';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';
import { register } from '@/api/authService';

export function Register() {
  const navigate = useNavigate();
  const { setUser } = useAppStore();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    organization: '',
    role: 'extension_officer',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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
      const data = await register(formData);

      // Handle nested response structure { success: true, data: { token, user } }
      const token = data.token || data.data?.token;
      const userData = data.data?.user || data.user;

      if (token) {
        localStorage.setItem('token', token);
      }
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData as User);
      }

      if (!token) {
        throw new Error(t('register_failed_no_token'));
      }

      navigate('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errorMsg =
        error.response?.data?.error || error.message || t('register_creation_failed');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      role="main"
      aria-label="Register page"
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
          className="hidden lg:flex lg:col-span-5 flex-col justify-between p-7 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden self-stretch"
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
                  ENTERPRISE ENROLLMENT
                </span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          </div>

          {/* Interactive Procedural Canvas in Center */}
          <div className="flex-1 min-h-[300px] w-full my-3 rounded-xl overflow-hidden border border-white/5 relative z-10 bg-slate-950">
            <AgroEcosystemCanvasScrubber interactive={true} showControls={false} />
          </div>

          {/* Bottom Live Feature Badges */}
          <div className="space-y-2 z-10 pt-3 border-t border-white/5 text-xs text-stone-300">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>Multi-spectral field disease detection models</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              <span>NASA POWER weather sync & offline field visit caching</span>
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
            {/* Logo and Controls */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {t('register_title')}
                </h1>
                <p className="text-white/60 text-sm mt-1">{t('register_subtitle')}</p>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <LiquidToggleSwitch compact />
                <LanguageSwitcher compact />
              </div>
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-firstName"
                    className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                  >
                    {t('register_first_name_label')}
                  </label>
                  <input
                    id="reg-firstName"
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                    placeholder={t('register_first_name_placeholder')}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reg-lastName"
                    className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                  >
                    {t('register_last_name_label')}
                  </label>
                  <input
                    id="reg-lastName"
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                    placeholder={t('register_last_name_placeholder')}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                >
                  {t('register_email_label')}
                </label>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                  placeholder={t('register_email_placeholder')}
                  autoComplete="email"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                  >
                    {t('register_password_label')}
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-10 text-sm"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      aria-label={showPassword ? 'Hide secret' : 'Show secret'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="reg-confirmPassword"
                    className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                  >
                    {t('register_confirm_password_label')}
                  </label>
                  <div className="relative">
                    <input
                      id="reg-confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-10 text-sm"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      aria-label={showConfirmPassword ? 'Hide secret' : 'Show secret'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-phone"
                    className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                  >
                    {t('register_phone_label')}
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                    placeholder={t('register_phone_placeholder')}
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reg-organization"
                    className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                  >
                    {t('register_organization_label')}
                  </label>
                  <input
                    id="reg-organization"
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                    placeholder={t('register_organization_placeholder')}
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-role"
                  className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide"
                >
                  {t('register_role_label')}
                </label>
                <select
                  id="reg-role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                >
                  <option value="extension_officer">{t('register_role_extension_officer')}</option>
                  <option value="admin">{t('register_role_admin')}</option>
                  <option value="farmer">{t('register_role_farmer')}</option>
                </select>
              </div>

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
          </div>

          {/* Footer */}
          <div className="mt-6 text-center border-t border-white/5 pt-4">
            <p className="text-xs text-white/50">
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

