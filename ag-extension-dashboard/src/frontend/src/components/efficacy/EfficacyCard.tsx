import { useState } from 'react';
import { CheckCircle2, TrendingUp, ClipboardList, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { efficacyService, OutcomeVerdict } from '@/api/efficacyService';
import { useThemeClasses } from '@/hooks/useThemeClasses';

const VERDICTS: { key: OutcomeVerdict; label: string; tone: string }[] = [
    { key: 'resolved', label: 'Resolved', tone: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
    { key: 'improved', label: 'Improved', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
    { key: 'unresolved', label: 'Unresolved', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
    { key: 'worsened', label: 'Worsened', tone: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
    { key: 'lost_to_followup', label: 'Lost to follow-up', tone: 'bg-gray-500/10 text-gray-500 border-gray-500/30' },
];

function OutcomeModal({ item, onClose }: { item: { visitId: string; farmerName: string | null; notes: string | null }; onClose: () => void }) {
    const queryClient = useQueryClient();
    const [verdict, setVerdict] = useState<OutcomeVerdict | null>(null);
    const [crop, setCrop] = useState('');
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');
    const { cardClass } = useThemeClasses();

    const mutation = useMutation({
        mutationFn: () =>
            efficacyService.recordOutcome({
                visitId: item.visitId,
                crop: crop.trim(),
                adviceCategory: category.trim(),
                adviceSummary: item.notes || 'Follow-up visit outcome',
                outcome: verdict!,
                officerNotes: notes.trim() || undefined,
            }),
        onSuccess: () => {
            toast.success('Outcome recorded — efficacy updated');
            void queryClient.invalidateQueries({ queryKey: ['efficacy-summary'] });
            void queryClient.invalidateQueries({ queryKey: ['efficacy-followups'] });
            onClose();
        },
        onError: () => toast.error('Failed to record outcome'),
    });

    const canSubmit = verdict && crop.trim() && category.trim();

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`${cardClass} relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 space-y-4`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold">Record Advice Outcome</h3>
                    <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Follow-up for <span className="font-semibold">{item.farmerName || 'farmer'}</span>
                    {item.notes ? ` — ${item.notes.slice(0, 90)}` : ''}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={crop} onChange={e => setCrop(e.target.value)} placeholder="Crop (e.g. maize) *" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                    <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Advice category (e.g. pest) *" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>

                <div className="flex flex-wrap gap-2">
                    {VERDICTS.map(v => (
                        <button
                            key={v.key}
                            onClick={() => setVerdict(v.key)}
                            aria-pressed={verdict === v.key}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${verdict === v.key ? `${v.tone} ring-2 ring-offset-1 ring-current` : 'border-gray-200 dark:border-gray-700 opacity-70 hover:opacity-100'}`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Officer notes (optional)"
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />

                <button
                    disabled={!canSubmit || mutation.isPending}
                    onClick={() => mutation.mutate()}
                    className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold disabled:opacity-50"
                >
                    {mutation.isPending ? 'Saving…' : 'Save Outcome'}
                </button>
            </div>
        </div>
    );
}

export function EfficacyCard() {
    const [selected, setSelected] = useState<{ visitId: string; farmerName: string | null; notes: string | null } | null>(null);
    const { cardClass } = useThemeClasses();

    const summary = useQuery({ queryKey: ['efficacy-summary'], queryFn: () => efficacyService.getSummary({ days: 90 }) });
    const followups = useQuery({ queryKey: ['efficacy-followups'], queryFn: () => efficacyService.getFollowUps() });

    return (
        <div className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary-500" />
                <h3 className="text-sm font-black uppercase tracking-widest">Advice Efficacy</h3>
            </div>

            {summary.isLoading ? (
                <div className="h-16 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" data-testid="efficacy-skeleton" />
            ) : summary.data ? (
                <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <div>
                            <p className="text-2xl font-black leading-none">{summary.data.overallSuccessRate}%</p>
                            <p className="text-xxs uppercase tracking-widest text-gray-400">success rate</p>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {summary.data.successCount} of {summary.data.totalOutcomes} tracked outcomes improved or resolved (90d)
                    </p>
                </div>
            ) : null}

            {(followups.data?.length ?? 0) > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3">
                    <div className="flex items-center gap-2 mb-2">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-500" />
                        <p className="text-xs font-bold">
                            {followups.data!.length} follow-up{followups.data!.length > 1 ? 's' : ''} due
                        </p>
                    </div>
                    <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                        {followups.data!.slice(0, 5).map(f => (
                            <li key={f.visitId} className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate">
                                    <span className="font-semibold">{f.farmerName || 'Farmer'}</span>
                                    <span className="text-gray-400"> · {f.daysOverdue}d ago</span>
                                </span>
                                <button
                                    onClick={() => setSelected({ visitId: f.visitId, farmerName: f.farmerName, notes: f.notes })}
                                    className="shrink-0 px-2.5 py-1 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold hover:bg-primary-500/20"
                                >
                                    Record
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {selected && <OutcomeModal item={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}
