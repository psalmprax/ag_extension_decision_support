import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Route, Navigation, Award, FileDown, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { fieldIntelService } from '@/api/fieldIntelService';
import { useThemeClasses } from '@/hooks/useThemeClasses';

// ── Route planner ────────────────────────────────────────────────────────────

export function RoutePlannerCard() {
    const { cardClass } = useThemeClasses();
    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['route-plan'],
        queryFn: () => fieldIntelService.getRoutePlan(10),
    });

    return (
        <div className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-primary-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Today's Route</h3>
                </div>
                <button onClick={() => refetch()} disabled={isFetching} className="text-xs font-bold text-primary-500 hover:text-primary-400 disabled:opacity-50" aria-label="Replan route">
                    <Navigation className="w-4 h-4" />
                </button>
            </div>

            {isLoading ? (
                <div className="h-16 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
            ) : !data || data.stops.length === 0 ? (
                <p className="text-xs text-gray-400">No overdue follow-ups — route is clear.</p>
            ) : (
                <>
                    <ol className="space-y-2 max-h-56 overflow-y-auto">
                        {data.stops.map(stop => (
                            <li key={stop.visitId} className="flex items-center gap-2.5 text-xs">
                                <span className="w-6 h-6 shrink-0 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 font-black flex items-center justify-center">
                                    {stop.order}
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                    <span className="font-semibold">{stop.farmerName || 'Farmer'}</span>
                                    <span className="text-gray-400"> · {stop.daysOverdue}d overdue · {stop.legKm}km</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    <p className="text-xxs text-gray-400 mt-2 uppercase tracking-widest">Total: {data.totalKm} km · {data.stops.length} stops</p>
                </>
            )}
        </div>
    );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export function LeaderboardCard() {
    const { cardClass } = useThemeClasses();
    const { data } = useQuery({ queryKey: ['leaderboard'], queryFn: () => fieldIntelService.getLeaderboard() });

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

export function SoilLabImport() {
    const queryClient = useQueryClient();
    const [csv, setCsv] = useState('');
    const mutation = useMutation({
        mutationFn: () => fieldIntelService.importSoilLab(csv),
        onSuccess: result => {
            toast.success(`Imported ${result.imported} results${result.unmatchedFarmers.length ? ` (${result.unmatchedFarmers.length} unmatched farmer refs)` : ''}`);
            setCsv('');
            void queryClient.invalidateQueries({ queryKey: ['soil-lab'] });
        },
        onError: (error: unknown) => {
            const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Import failed';
            toast.error(message);
        },
    });

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                <Upload className="w-3.5 h-3.5" />
                Import lab results (CSV)
            </div>
            <textarea
                value={csv}
                onChange={e => setCsv(e.target.value)}
                rows={4}
                placeholder={'farmer_ref,lab_name,sample_ref,ph,nitrogen_ppm,phosphorus_ppm,potassium_ppm,organic_matter_pct,tested_at'}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
                onClick={() => mutation.mutate()}
                disabled={!csv.trim() || mutation.isPending}
                className="px-3 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-bold disabled:opacity-50"
            >
                {mutation.isPending ? 'Importing…' : 'Import results'}
            </button>
        </div>
    );
}
