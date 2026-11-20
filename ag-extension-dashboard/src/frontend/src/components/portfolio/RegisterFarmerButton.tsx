import { UserPlus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode } from '@/demo';
import { useLanguage } from '@/lib/LanguageContext';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';

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
      className={PRIMARY_BUTTON}
    >
      <UserPlus className="w-4 h-4" aria-hidden="true" />
      <span>{t('portfolio_register_farmer', 'Register farmer')}</span>
    </button>
  );
}
