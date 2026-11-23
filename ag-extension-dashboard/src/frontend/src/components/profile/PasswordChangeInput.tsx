import React from 'react';

const PASSWORD_INPUT_CLASS =
  'w-full px-3.5 py-2 bg-white dark:bg-theme-bg-secondary border border-slate-300 dark:border-white/[0.12] rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500';

/**
 * Password field for the change-password form. `autoComplete` tells password managers
 * whether to offer the saved password (current-password) or generate one (new-password).
 */
export const PasswordChangeInput: React.FC<{
  autoComplete: 'current-password' | 'new-password';
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ autoComplete, placeholder, value, onChange }) => (
  <input
    type="password"
    autoComplete={autoComplete}
    placeholder={placeholder}
    aria-label={placeholder}
    value={value}
    onChange={e => onChange(e.target.value)}
    className={PASSWORD_INPUT_CLASS}
  />
);
