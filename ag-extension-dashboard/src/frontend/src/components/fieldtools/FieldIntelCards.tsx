import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import { fieldIntelService } from '@/api/fieldIntelService';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useDemoMode } from '@/demo';
import { DEMO_LEADERBOARD } from '@/demo/demoMode';
import { useLanguage } from '@/lib/LanguageContext';

// ── Route planner ────────────────────────────────────────────────────────────


// ── Leaderboard ──────────────────────────────────────────────────────────────

export function LeaderboardCard() {
    const { t } = useLanguage();
    const { cardClass } = useThemeClasses();
    const { isDemo } = useDemoMode();
    const { data } = useQuery({
        queryKey: ['leaderboard', isDemo],
        queryFn: async () => {
            if (isDemo) return DEMO_LEADERBOARD;
            return fieldIntelService.getLeaderboard();
        }
    });

    return (
        <div className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black  ">{t('ui_field_intel_cards_officer_leaderboard')}</h3>
                <span className="text-xxs text-gray-400 ms-auto">{t('ui_field_intel_cards_30_days')}</span>
            </div>
            {!data || data.length === 0 ? (
                <p className="text-xs text-gray-400">{t('ui_field_intel_cards_no_officer_activity_in_the_last_30_d')}</p>
            ) : (
                <ol className="space-y-2">
                    {data.slice(0, 5).map((o, idx) => (
                        <li key={o.officerId} className="flex items-center gap-2.5 text-xs">
                            <span className={`w-6 h-6 shrink-0 rounded-full font-black flex items-center justify-center ${idx === 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-gray-500/10 text-gray-400'}`}>
                                {idx + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                                <span className="font-semibold">{o.officerName}</span>
                                <span className="text-gray-400"> · {o.visitsCompleted} {t('ui_field_intel_cards_visits')} {o.efficacySuccessRate !== null ? `${o.efficacySuccessRate}% efficacy` : 'no outcomes yet'}</span>
                            </span>
                            <span className="flex gap-1 shrink-0">
                                {o.badges.slice(0, 2).map(b => (
                                    <span key={b} className="px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xxs font-bold" title={b}>
                                        {b}
                                    </span>
                                ))}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}


// ── Soil lab import ──────────────────────────────────────────────────────────
