import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { requestPasswordReset } from '@/api/authService';
import { useLanguage } from '@/lib/LanguageContext';

export const ForgotPassword: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setStatus('idle');
    try {
      const res = await requestPasswordReset(email.trim());
      if (res.success) {
        setStatus('success');
        setMessage(res.message || 'Password reset instructions have been sent to your email.');
      } else {
        setStatus('error');
        setMessage(res.message || 'Failed to send reset email. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden`}
      >
        <div className="p-8 bg-primary-700 text-white">
          <h1 className="text-2xl font-medium">{t('ui_forgot_password_reset_password')}</h1>
          <p className="text-sm opacity-90 mt-1">{t('ui_forgot_password_enter_your_email_to_receive_reset_in')}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className={`w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium btn btn-primary w-full transition-colors`}
              >
                {t('ui_forgot_password_back_to_login')}
              </button>
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div
                  className={`p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2`}
                >
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('login_email')}
                </label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className={`w-full ps-10 pe-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:text-white`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className={`w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium btn btn-primary w-full transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isLoading ? 'Sending...' : 'Send reset link'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3 text-gray-500 dark:text-gray-400 font-medium text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('ui_forgot_password_back_to_login')}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
