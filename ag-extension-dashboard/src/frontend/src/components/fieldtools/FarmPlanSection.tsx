import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Sparkles, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { fieldIntelService, PlanMilestone } from '@/api/fieldIntelService';

/**
 * Season plan for a field's current crop cycle — AI/rule-generated milestones
 * with completion tracking. Rendered inside the field card in CropsFields.
 */
export function FarmPlanSection({ cropCycleId }: { cropCycleId: string }) {
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState(false);

    const plan = useQuery({
        queryKey: ['farm-plan', cropCycleId],
        queryFn: () => fieldIntelService.getFarmPlan(cropCycleId),
        enabled: expanded,
    });

    const generate = useMutation({
        mutationFn: () => fieldIntelService.generateFarmPlan(cropCycleId),
        onSuccess: result => {
            toast.success(`Plan generated: ${result.milestones} milestones for ${result.crop}`);
            void queryClient.invalidateQueries({ queryKey: ['farm-plan', cropCycleId] });
        },
        onError: () => toast.error('Failed to generate plan'),
    });

    const setStatus = useMutation({
        mutationFn: ({ id, status }: { id: string; status: PlanMilestone['status'] }) =>
            fieldIntelService.setMilestoneStatus(id, status),
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farm-plan', cropCycleId] }),
        onError: () => toast.error('Failed to update milestone'),
    });

    return (
        <div className="mt-3 border-t border-white/5 pt-3">
            <button
                onClick={() => setExpanded(e => !e)}
                aria-expanded={expanded}
                className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300"
            >
                <ListChecks className="w-4 h-4" />
                Season Plan
                {expanded && <span className="text-xxs text-slate-500 font-normal">(click to collapse)</span>}
            </button>

            {expanded && (
                <div className="mt-2">
                    {plan.isLoading && <p className="text-xs text-slate-500">Loading plan…</p>}
                    {plan.data && plan.data.length === 0 && (
                        <button
                            onClick={() => generate.mutate()}
                            disabled={generate.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            {generate.isPending ? 'Generating…' : 'Generate season plan'}
                        </button>
                    )}
                    {plan.data && plan.data.length > 0 && (
                        <ul className="space-y-1.5">
                            {plan.data.map(m => (
                                <li key={m.id} className="flex items-center gap-2 text-xs">
                                    <button
                                        onClick={() => setStatus.mutate({ id: m.id, status: m.status === 'done' ? 'pending' : 'done' })}
                                        aria-label={m.status === 'done' ? `Mark ${m.title} pending` : `Mark ${m.title} done`}
                                        className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${m.status === 'done' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600'}`}
                                    >
                                        {m.status === 'done' && <Check className="w-3 h-3" />}
                                    </button>
                                    <span className={`min-w-0 flex-1 truncate ${m.status === 'done' ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                                        {m.title}
                                    </span>
                                    {m.dueDate && (
                                        <span className="text-xxs text-slate-500 shrink-0">
                                            {new Date(m.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
