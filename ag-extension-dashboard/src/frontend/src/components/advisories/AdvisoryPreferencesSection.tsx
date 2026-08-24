import { useState } from 'react';
import { Radio } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { advisoryService, AdvisoryPreference } from '@/api/efficacyService';

const CATEGORIES = [
    { key: 'planting_window', label: 'Planting windows' },
    { key: 'dry_spell_warning', label: 'Dry spell alerts' },
    { key: 'faw_degree_day', label: 'Fall armyworm risk' },
    { key: 'late_blight_risk', label: 'Late blight risk' },
];

const CHANNELS = [
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'sms', label: 'SMS' },
];

export function AdvisoryPreferencesSection({ farmerId }: { farmerId: string }) {
    const queryClient = useQueryClient();
    const { data } = useQuery({
        queryKey: ['advisory-preference', farmerId],
        queryFn: () => advisoryService.getPreference(farmerId),
    });

    const [draft, setDraft] = useState<AdvisoryPreference | null>(null);
    const prefs = draft ?? data ?? { optIn: true, channels: ['whatsapp'], categories: CATEGORIES.map(c => c.key) };

    const mutation = useMutation({
        mutationFn: () => advisoryService.setPreference(farmerId, prefs),
        onSuccess: () => {
            toast.success('Advisory preferences saved');
            setDraft(null);
            void queryClient.invalidateQueries({ queryKey: ['advisory-preference', farmerId] });
        },
        onError: () => toast.error('Failed to save preferences'),
    });

    const toggle = (list: string[], key: string): string[] =>
        list.includes(key) ? list.filter(k => k !== key) : [...list, key];

    const dirty = draft !== null;

    return (
        <section className="border-t border-gray-100 dark:border-gray-800 pt-4 mt-4" aria-label="Proactive advisory preferences">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary-500" />
                    <h4 className="text-xs font-black uppercase tracking-widest">Proactive Advisories</h4>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                        type="checkbox"
                        checked={prefs.optIn}
                        onChange={e => setDraft({ ...prefs, optIn: e.target.checked })}
                        className="accent-primary-600"
                    />
                    Opted in
                </label>
            </div>

            {prefs.optIn && (
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                        {CHANNELS.map(c => (
                            <button
                                key={c.key}
                                onClick={() => setDraft({ ...prefs, channels: toggle(prefs.channels, c.key) })}
                                aria-pressed={prefs.channels.includes(c.key)}
                                className={`px-2.5 py-1 rounded-lg text-xxs font-bold border ${prefs.channels.includes(c.key) ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map(c => (
                            <button
                                key={c.key}
                                onClick={() => setDraft({ ...prefs, categories: toggle(prefs.categories, c.key) })}
                                aria-pressed={prefs.categories.includes(c.key)}
                                className={`px-2.5 py-1 rounded-lg text-xxs font-bold border ${prefs.categories.includes(c.key) ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    {dirty && (
                        <button
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending}
                            className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-bold disabled:opacity-50"
                        >
                            {mutation.isPending ? 'Saving…' : 'Save preferences'}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
