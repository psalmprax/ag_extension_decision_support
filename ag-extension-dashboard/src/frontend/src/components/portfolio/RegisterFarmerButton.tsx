import { UserPlus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode } from '@/demo';
import { useLanguage } from '@/lib/LanguageContext';

/** Roles that enrol farmers (the server refuses farmer accounts). */
const REGISTERING_ROLES = new Set(['admin', 'regional_manager', 'extension_officer']);

/**
 * Opens farmer registration from the Farmers page. Hidden in the read-only
 * demo session and for roles that cannot register farmers.
 */
export function RegisterFarmerButton() {
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();
  const role = useAppStore(state => state.user?.role);
  const setActiveTab = useAppStore(state => state.setActiveTab);

  if (isDemo || !role || !REGISTERING_ROLES.has(role)) return null;

  return (
    <button
      type="button"
      onClick={() => setActiveTab('register_farmer')}
      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
    >
      <UserPlus className="w-3.5 h-3.5" />
      <span>{t('portfolio_register_farmer', 'Register farmer')}</span>
    </button>
  );
}
