import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import {
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  type RegisterFormState,
} from './registerForm';

interface RegisterAccountFieldsProps {
  formData: RegisterFormState;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
}

const SECRET_INPUT_CLASS = `${FIELD_INPUT_CLASS} pe-10`;

export function RegisterAccountFields({
  formData,
  onChange,
  showPassword,
  showConfirmPassword,
  onTogglePassword,
  onToggleConfirmPassword,
}: RegisterAccountFieldsProps) {
  const { t } = useLanguage();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-firstName" className={FIELD_LABEL_CLASS}>
            {t('register_first_name_label')}
          </label>
          <input
            id="reg-firstName"
            type="text"
            name="firstName"
            required
            value={formData.firstName}
            onChange={onChange}
            className={FIELD_INPUT_CLASS}
            placeholder={t('register_first_name_placeholder')}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label htmlFor="reg-lastName" className={FIELD_LABEL_CLASS}>
            {t('register_last_name_label')}
          </label>
          <input
            id="reg-lastName"
            type="text"
            name="lastName"
            required
            value={formData.lastName}
            onChange={onChange}
            className={FIELD_INPUT_CLASS}
            placeholder={t('register_last_name_placeholder')}
            autoComplete="family-name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="reg-email" className={FIELD_LABEL_CLASS}>
          {t('register_email_label')}
        </label>
        <input
          id="reg-email"
          type="email"
          name="email"
          required
          value={formData.email}
          onChange={onChange}
          className={FIELD_INPUT_CLASS}
          placeholder={t('register_email_placeholder')}
          autoComplete="email"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-password" className={FIELD_LABEL_CLASS}>
            {t('register_password_label')}
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              value={formData.password}
              onChange={onChange}
              className={SECRET_INPUT_CLASS}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={onTogglePassword}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
              aria-label={showPassword ? 'Hide secret' : 'Show secret'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="reg-confirmPassword" className={FIELD_LABEL_CLASS}>
            {t('register_confirm_password_label')}
          </label>
          <div className="relative">
            <input
              id="reg-confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              required
              value={formData.confirmPassword}
              onChange={onChange}
              className={SECRET_INPUT_CLASS}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={onToggleConfirmPassword}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors"
              aria-label={showConfirmPassword ? 'Hide secret' : 'Show secret'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
