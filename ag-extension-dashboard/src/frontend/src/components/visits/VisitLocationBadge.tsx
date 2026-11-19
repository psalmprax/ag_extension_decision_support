import React from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import type { VisitLocationCheck } from '@/types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';

const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/** Where the visit report was filed: on the farm, away from it, or not known. */
export const VisitLocationBadge: React.FC<{ check?: VisitLocationCheck | null }> = ({ check }) => {
  const { t } = useLanguage();
  if (!check) return null;
  const distance = check.distanceM ?? 0;
  const view = {
    on_farm: { good: true, text: t('visit_location_on_farm', { defaultValue: 'Verified on the farm ({distance})', distance: metres(distance) }) },
    away: { good: false, text: t('visit_location_away', { defaultValue: 'Filed {distance} from the farm', distance: metres(distance) }) },
    imprecise: { good: false, text: t('visit_location_imprecise', 'Location too imprecise to confirm') },
    farm_location_unknown: { good: false, text: t('visit_location_farm_unknown', 'Farm location not set, so the visit could not be confirmed') },
    not_shared: { good: false, text: t('visit_location_not_shared', 'Location not shared with this report') },
  }[check.status];
  if (!view) return null;
  const Icon = view.good ? MapPin : MapPinOff;
  return (
    <p
      data-testid="visit-location"
      data-status={check.status}
      className={`flex items-center gap-1.5 text-xs ${view.good ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{view.text}</span>
    </p>
  );
};
