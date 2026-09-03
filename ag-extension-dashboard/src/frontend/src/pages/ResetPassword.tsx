import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { resetPassword } from '@/api/authService';

const MIN_LEN = 10;

function localProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < MIN_LEN) out.push(`at least ${MIN_LEN} characters`);
  if (!/[a-zA-Z]/.test(pw)) out.push('a letter');
  if (!/\d/.test(pw)) out.push('a number');
  return out;
}

export const ResetPassword: React.FC = () => {
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
      const e = err as { response?: { data?: { error?: string } } };
      setStatus('error');
      setMessage(e.response?.data?.error || 'Reset link is invalid or has expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="p-8 bg-gradient-to-br from-primary-500 to-primary-700 text-white">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="text-sm opacity-90 mt-1">At least {MIN_LEN} characters with a letter and a number</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {!token && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              This reset link is missing its token. Request a new one from the sign-in page.
            </div>
          )}

          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
              <button type="button" onClick={() => navigate('/login')} className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition-colors">
                Sign in
              </button>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">New password</span>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                    required
                  />
                </div>
                {password && problems.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Needs {problems.join(', ')}</p>
                )}
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Confirm password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full mt-1 px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                  required
                />
                {confirm && confirm !== password && <p className="text-xs text-amber-600 mt-1">Passwords do not match</p>}
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
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update password
              </button>
              <button type="button" onClick={() => navigate('/login')} className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
