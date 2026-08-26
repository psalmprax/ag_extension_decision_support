import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { AxiosError } from 'axios';
import { useLanguage } from '@/lib/LanguageContext';
import { register } from '@/api/authService';
import { LiquidBackgroundCanvas } from '@/components/canvasui/LiquidBackgroundCanvas';
import { LiquidToggleSwitch } from '@/components/canvasui/LiquidToggleSwitch';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';

export function Register() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'extension_officer',
    region: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRequirements = [
    { met: formData.password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(formData.password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(formData.password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(formData.password), text: 'One number' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('register_passwords_not_match'));
      return;
    }

    if (!passwordRequirements.every(r => r.met)) {
      setError(t('register_password_requirements'));
      return;
    }

    setIsLoading(true);

    try {
      const result = await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        region: formData.region,
      });

      // Save auth credentials
      if (result.data?.token) {
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
      }

      // Success - redirect to login
      navigate('/login', { state: { registered: true } });
    } catch (err: unknown) {
      // Error handling is managed by apiClient interceptors,
      // but we can extract more detail if available
      const axiosErr = err instanceof AxiosError ? err : null;
      const errorMsg =
        axiosErr?.response?.data?.details?.[0]?.message ||
        axiosErr?.response?.data?.error ||
        (err instanceof Error ? err.message : null) ||
        t('register_failed');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* ── Liquid WebGL Fluid Background & Ambient Glow ── */}
      <LiquidBackgroundCanvas />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/[0.12] blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-amber-500/[0.08] blur-[150px]" />
      </div>

      <div className="w-full max-w-md lg:max-w-5xl grid lg:grid-cols-12 gap-8 items-center relative z-10 my-6">
        {/* Left Side: Interactive Agro Intelligence Preview HUD (Desktop) */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden lg:flex lg:col-span-5 flex-col justify-between h-[680px] p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl shadow-2xl relative overflow-hidden"
        >
          {/* Top Brand & Status */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GPExts Logo" className="w-9 h-9 object-contain rounded-xl" />
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
          <div className="h-[380px] w-full my-4 rounded-2xl overflow-hidden border border-white/5 relative z-10">
            <AgroEcosystemCanvasScrubber interactive={true} showControls={false} />
          </div>

          {/* Bottom Live Feature Badges */}
          <div className="space-y-2 z-10 pt-2 border-t border-white/5 text-xs text-stone-300">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Multi-spectral field disease detection models</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>NASA POWER weather sync & offline field visit caching</span>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Register Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-7 backdrop-blur-2xl bg-slate-900/80 border border-white/10 shadow-2xl rounded-3xl p-8 w-full relative z-10"
          style={{ pointerEvents: 'auto', touchAction: 'auto' }}
        >
          {/* Logo and Controls */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {t('register_title')}
              </h1>
              <p className="text-white/60 text-sm mt-1">{t('register_subtitle')}</p>
            </div>
            <div className="pt-1">
              <LiquidToggleSwitch compact />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl backdrop-blur-sm"
            >
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                  {t('register_first_name')}
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                  {t('register_last_name')}
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                {t('login_email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                  {t('register_role')}
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-slate-900 text-white focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                >
                  <option value="extension_officer">Extension Officer</option>
                  <option value="lead_agronomist">Lead Agronomist</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="agribusiness_admin">Agribusiness Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                  {t('register_region') || 'Region / District'}
                </label>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={e => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                  placeholder="e.g. Western Province"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                {t('login_password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 pr-12 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {passwordRequirements.map((req, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 text-xxs ${
                      req.met ? 'text-emerald-400 font-semibold' : 'text-white/30'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    <span>{req.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
                {t('register_confirm_password')}
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('register_creating')}
                </>
              ) : (
                t('register_create_account')
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-white/60">
            {t('register_have_account')}{' '}
            <Link
              to="/login"
              className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors"
            >
              {t('register_sign_in')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default Register;
