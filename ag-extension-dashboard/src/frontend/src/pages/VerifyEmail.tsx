import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { verifyEmail } from '@/api/authService';

export const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    verifyEmail(token)
      .then(res => {
        setStatus(res.success ? 'success' : 'error');
        setMessage(res.success ? 'Your email is verified. You can sign in now.' : res.error || 'Verification failed.');
      })
      .catch(err => {
        const e = err as { response?: { data?: { error?: string } } };
        setStatus('error');
        setMessage(e.response?.data?.error || 'Verification link is invalid or has expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 text-center space-y-4">
        {status === 'pending' && <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary-600" />}
        {status === 'success' && <CheckCircle className="w-10 h-10 mx-auto text-green-600" />}
        {status === 'error' && <AlertCircle className="w-10 h-10 mx-auto text-red-600" />}
        <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
        <button type="button" onClick={() => navigate('/login')} className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition-colors">
          Go to sign in
        </button>
      </div>
    </div>
  );
};

export default VerifyEmail;
