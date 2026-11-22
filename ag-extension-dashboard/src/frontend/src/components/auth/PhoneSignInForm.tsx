import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { requestPhoneCode, verifyPhoneCode, type AuthResponse } from '@/api/authService';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLanguage } from '@/lib/LanguageContext';
import { AUTH_INPUT, AUTH_SUBMIT } from '@/components/ui/controlStyles';
import { SUPPORTED_COUNTRIES, browserCountry } from '@/lib/countries';

interface PhoneSignInFormProps {
  onSignedIn: (data: AuthResponse) => void;
  onUseEmail: () => void;
}

const RESEND_SECONDS = 30;
const LABEL = 'block text-sm text-[#c5d3cb] mb-1.5';
const LINK =
  'text-sm text-emerald-300 hover:text-emerald-200 transition-colors disabled:text-white/40';

/** Sign-in with a phone number and a 6-digit code sent by SMS. */
export function PhoneSignInForm({ onSignedIn, onUseEmail }: PhoneSignInFormProps) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  // A number typed without +country code is read in this country.
  const [country, setCountry] = useState(() => browserCountry() ?? 'Kenya');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = window.setTimeout(() => setWait(seconds => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const sendCode = async () => {
    setBusy(true);
    setError('');
    try {
      const reply = await requestPhoneCode(phone, country);
      setNotice(
        reply.data?.message ??
          t('phone_login_code_sent', {
            defaultValue: 'If this number is registered, a code is on its way.',
          })
      );
      setStep('code');
      setWait(RESEND_SECONDS);
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          t('phone_login_send_failed', { defaultValue: 'Could not send a code. Try again.' })
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (step === 'phone') {
      await sendCode();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await verifyPhoneCode(phone, code, country);
      if ((data as { data?: { mfaRequired?: boolean } }).data?.mfaRequired) {
        setError(
          t('phone_login_mfa', {
            defaultValue:
              'This account uses two-step sign-in. Sign in with email and password instead.',
          })
        );
        return;
      }
      onSignedIn(data);
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          t('phone_login_wrong_code', {
            defaultValue: 'That code is not right. Check the SMS and try again.',
          })
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4"
      aria-label={t('phone_login_title', { defaultValue: 'Sign in with your phone number' })}
    >
      {error && (
        <div role="alert" className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-md">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}
      {step === 'phone' ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="login-country" className={LABEL}>
              {t('register_country_label', { defaultValue: 'Country' })}
            </label>
            <select
              id="login-country"
              value={country}
              onChange={event => setCountry(event.target.value)}
              className={AUTH_INPUT}
            >
              {SUPPORTED_COUNTRIES.filter(c => c.iso2).map(c => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="login-phone" className={LABEL}>
              {t('phone_login_number', { defaultValue: 'Phone number' })}
            </label>
            <input
              id="login-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={event => setPhone(event.target.value)}
              className={AUTH_INPUT}
            />
            <p className="text-xs text-white/60 mt-1.5">
              {t('phone_login_number_hint', {
                defaultValue: 'We will text you a 6-digit code. Standard SMS rates may apply.',
              })}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#c5d3cb] mb-3" aria-live="polite">
            {notice}
          </p>
          <label htmlFor="login-code" className={LABEL}>
            {t('phone_login_code', { defaultValue: 'Code from the SMS' })}
          </label>
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
            className={`${AUTH_INPUT} font-mono tabular-nums`}
          />
          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              className={LINK}
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
            >
              {t('phone_login_change_number', { defaultValue: 'Use a different number' })}
            </button>
            <button type="button" className={LINK} disabled={wait > 0 || busy} onClick={sendCode}>
              {wait > 0
                ? t('phone_login_resend_wait', {
                    seconds: wait,
                    defaultValue: 'New code in {seconds}s',
                  })
                : t('phone_login_resend', { defaultValue: 'Send a new code' })}
            </button>
          </div>
        </div>
      )}
      <button type="submit" disabled={busy} className={AUTH_SUBMIT}>
        {busy && <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
        <span>
          {step === 'phone'
            ? t('phone_login_send', { defaultValue: 'Send code' })
            : t('login_sign_in')}
        </span>
      </button>
      <button type="button" onClick={onUseEmail} className={`${LINK} w-full text-center`}>
        {t('phone_login_use_email', { defaultValue: 'Sign in with email instead' })}
      </button>
    </form>
  );
}
