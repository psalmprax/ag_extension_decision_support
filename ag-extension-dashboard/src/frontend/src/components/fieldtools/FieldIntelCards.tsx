import { useQuery } from '@tanstack/react-query';
import { Award, FileDown } from 'lucide-react';
import { fieldIntelService } from '@/api/fieldIntelService';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_LEADERBOARD } from '@/demo/demoMode';

// ── Route planner ────────────────────────────────────────────────────────────


// ── Leaderboard ──────────────────────────────────────────────────────────────

export function LeaderboardCard() {
    const { cardClass } = useThemeClasses();
    const isDemo = useAppStore(s => s.isDemo);
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
                <h3 className="text-sm font-black uppercase tracking-widest">Officer Leaderboard</h3>
                <span className="text-xxs text-gray-400 ml-auto">30 days</span>
            </div>
            {!data || data.length === 0 ? (
                <p className="text-xs text-gray-400">No officer activity in the last 30 days.</p>
            ) : (
                <ol className="space-y-2">
                    {data.slice(0, 5).map((o, idx) => (
                        <li key={o.officerId} className="flex items-center gap-2.5 text-xs">
                            <span className={`w-6 h-6 shrink-0 rounded-full font-black flex items-center justify-center ${idx === 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-gray-500/10 text-gray-400'}`}>
                                {idx + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                                <span className="font-semibold">{o.officerName}</span>
                                <span className="text-gray-400"> · {o.visitsCompleted} visits · {o.efficacySuccessRate !== null ? `${o.efficacySuccessRate}% efficacy` : 'no outcomes yet'}</span>
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

// ── MIS export ───────────────────────────────────────────────────────────────

export function MisExportButtons() {
    const datasets: { key: 'farmers' | 'visits' | 'outcomes'; label: string }[] = [
        { key: 'farmers', label: 'Farmers' },
        { key: 'visits', label: 'Visits' },
        { key: 'outcomes', label: 'Outcomes' },
    ];
    return (
        <div className="flex flex-wrap gap-2">
            {datasets.map(d => (
                <a
                    key={d.key}
                    href={fieldIntelService.misExportUrl(d.key)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold hover:bg-primary-500/20"
                    download
                >
                    <FileDown className="w-3.5 h-3.5" />
                    {d.label} CSV
                </a>
            ))}
        </div>
    );
}

// ── Soil lab import ──────────────────────────────────────────────────────────
