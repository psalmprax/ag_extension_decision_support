import { useLanguage } from '@/lib/LanguageContext';

/**
 * Tells an officer or regional manager which region the farmer is registered
 * in (their own), or that their account needs a region first. Nothing for
 * staff without a fixed region (null).
 */
export function StaffRegionNote({ region }: { region: string | null }) {
  const { t } = useLanguage();
  if (region === null) return null;
  return (
    <p className="text-xs text-white/50">
      {region
        ? t('farmer_register_manager_region', 'Registered in your region: {region}').replace('{region}', region)
        : t('farmer_register_manager_no_region', 'Your account has no region yet. Ask an administrator to set it before registering farmers.')}
    </p>
  );
}
