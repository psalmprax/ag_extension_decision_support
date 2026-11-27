import { useQuery } from '@tanstack/react-query';
import { Radio, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { advisoryService } from '@/api/efficacyService';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useLanguage } from '@/lib/LanguageContext';
import { CardHeading } from '@/components/ui/CardHeading';

const SEVERITY_ICON = {
    info: { Icon: Info, cls: 'text-slate-500' },
    warning: { Icon: AlertTriangle, cls: 'text-amber-500' },
    urgent: { Icon: AlertOctagon, cls: 'text-red-500' },
} as const;

export function AdvisoriesCard() {
    const { cardClass } = useThemeClasses();
    const { t } = useLanguage();
    const { data, isLoading } = useQuery({
        queryKey: ['recent-advisories'],
        queryFn: () => advisoryService.getRecent(8),
        refetchInterval: 5 * 60 * 1000,
    });

    const ruleLabels: Record<string, string> = {
        planting_window: t('advisory_planting_window', { defaultValue: 'Planting window' }),
        dry_spell_warning: t('advisory_dry_spell', { defaultValue: 'Dry spell' }),
        faw_degree_day: t('advisory_fall_armyworm', { defaultValue: 'Fall armyworm risk' }),
        late_blight_risk: t('advisory_late_blight', { defaultValue: 'Late blight risk' }),
    };

    return (
        <div className={`${cardClass} p-4 sm:p-5`}>
            <CardHeading
                icon={<Radio className="w-[18px] h-[18px] text-primary-500" aria-hidden="true" />}
                title={t('advisories_title', { defaultValue: 'Advisories' })}
                subtitle={t('advisories_subtitle', { defaultValue: 'Planting, weather and pest alerts sent to farmers' })}
            />

            {isLoading ? (
                <div className="h-20 animate-pulse bg-gray-100 dark:bg-theme-bg-tertiary rounded-xl" data-testid="advisories-skeleton" />
            ) : !data || data.length === 0 ? (
                <p className="text-xs text-gray-400">
                    {t('advisories_no_dispatched', { defaultValue: 'No advisories dispatched yet. The engine runs daily when farmers opt in.' })}
                </p>
            ) : (
                <ul className="space-y-2.5 max-h-56 overflow-y-auto">
                    {data.map((d, i) => {
                        const { Icon, cls } = SEVERITY_ICON[(d.severity as keyof typeof SEVERITY_ICON) || 'info'];
                        return (
                            <li key={`${d.ruleKey}-${d.district}-${d.dispatchedAt}-${i}`} className="flex gap-2.5">
                                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cls}`} />
                                <div className="min-w-0">
                                    <p className="text-xs font-medium">
                                        {ruleLabels[d.ruleKey] || d.ruleKey}
                                        <span className="text-gray-400 font-normal"> · {d.district} · {d.audienceCount} {t('advisory_farmers_count', { defaultValue: 'farmers' })}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-theme-text-muted line-clamp-2">{d.message}</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
