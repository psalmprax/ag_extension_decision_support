import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { resetPassword } from '@/api/authService';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLanguage } from '@/lib/LanguageContext';

const MIN_LEN = 10;

function localProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < MIN_LEN) out.push(`at least ${MIN_LEN} characters`);
  if (!/[a-zA-Z]/.test(pw)) out.push('a letter');
  if (!/\d/.test(pw)) out.push('a number');
  return out;
}

export const ResetPassword: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const problems = useMemo(() => localProblems(password), [password]);
  const canSubmit = token && problems.length === 0 && password === confirm && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setStatus('idle');
    try {
      const res = await resetPassword(token, password);
      if (res.success) {
        setStatus('success');
        setMessage(res.message || 'Password updated.');
      } else {
        setStatus('error');
        setMessage(res.error || 'Reset failed.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(getApiErrorMessage(err, 'Reset link is invalid or has expired.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="p-8 bg-primary-700 text-white">
          <h1 className="text-2xl font-medium">{t('ui_reset_password_choose_a_new_password')}</h1>
          <p className="text-sm opacity-90 mt-1">{t('ui_reset_password_at_least_characters_with_a_letter_an', { MIN_LEN })}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {!token && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {t('ui_reset_password_this_reset_link_is_missing_its_token')}
            </div>
          )}

          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
              <button type="button" onClick={() => navigate('/login')} className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors">
                {t('ui_reset_password_sign_in')}
              </button>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('ui_reset_password_new_password')}</span>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 absolute start-3 top-3.5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full ps-9 pe-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                    required
                  />
                </div>
                {password && problems.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">{t('ui_reset_password_needs')} {problems.join(', ')}</p>
                )}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('ui_reset_password_confirm_password')}</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full mt-1 px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                  required
                />
                {confirm && confirm !== password && <p className="text-xs text-amber-600 mt-1">{t('register_passwords_not_match')}</p>}
              </label>

              {status === 'error' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('ui_reset_password_update_password')}
              </button>
              <button type="button" onClick={() => navigate('/login')} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> {t('ui_reset_password_back_to_sign_in')}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
