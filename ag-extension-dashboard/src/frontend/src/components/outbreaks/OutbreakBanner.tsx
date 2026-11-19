import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, X } from 'lucide-react';
import { useState } from 'react';
import { outbreakService } from '@/api/efficacyService';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Dashboard banner: surfaces k-anonymized outbreak alerts for the officer's
 * districts. Dismissible per session; only renders when alert-level clusters exist.
 */
export function OutbreakBanner() {
    const { t } = useLanguage();
    const [dismissed, setDismissed] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: ['outbreak-clusters'],
        queryFn: () => outbreakService.getClusters({ days: 14 }),
        refetchInterval: 10 * 60 * 1000,
    });

    const alerts = (data || []).filter(c => c.alert);
    if (isLoading || dismissed || alerts.length === 0) return null;

    return (
        <div
            role="alert"
            className="flex items-start gap-3 p-3 sm:p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
        >
            <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                    {t('ui_outbreak_banner_outbreak_alert')}{alerts.length > 1 ? 's' : ''} {t('ui_outbreak_banner_in_your_region')}
                </p>
                <ul className="text-xs mt-1 space-y-0.5">
                    {alerts.slice(0, 3).map(c => (
                        <li key={`${c.district}-${c.diseaseLabel}`}>
                            <span className="font-semibold">{c.diseaseLabel.replace(/_/g, ' ')}</span> on {c.crop} —{' '}
                            {c.caseCount} {t('ui_outbreak_banner_cases_in')} {c.district} {t('ui_outbreak_banner_last_14_days')}
                        </li>
                    ))}
                    {alerts.length > 3 && <li>+{alerts.length - 3} {t('ui_outbreak_banner_more_see_the_outbreak_map_layer')}</li>}
                </ul>
            </div>
            <button onClick={() => setDismissed(true)} aria-label="Dismiss outbreak alert" className="p-1 rounded-lg hover:bg-red-500/10">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
