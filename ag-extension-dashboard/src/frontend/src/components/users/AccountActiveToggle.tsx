import { useLanguage } from '@/lib/LanguageContext';

interface AccountActiveToggleProps {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

/** Suspension switch: a suspended account is signed out and blocked immediately. */
export function AccountActiveToggle({ checked, disabled, onChange }: AccountActiveToggleProps) {
  const { t } = useLanguage();

  return (
    <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer">
      <div>
        <div className="text-xs font-medium text-white">
          {t('users_access_account_active', 'Account Active')}
        </div>
        <div className="text-[11px] text-white/50">
          {t('users_access_account_active_hint', 'Suspended accounts are immediately signed out and blocked.')}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:opacity-50"
      />
    </label>
  );
}
