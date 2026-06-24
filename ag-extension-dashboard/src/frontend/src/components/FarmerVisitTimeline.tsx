import React from 'react';
import { Visit } from '@/types/dashboard';
import { Button } from './ui/Button';
import { Clock, Calendar } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface FarmerVisitTimelineProps {
    /** Visits to render; `undefined` is coalesced to `[]` by the receiver. */
    visits: Visit[] | undefined;
    handleUpdateVisitStatus: (visitId: string, status: 'completed' | 'cancelled') => void;
    radiusClass: string;
    isCyber: boolean;
}

export const FarmerVisitTimeline: React.FC<FarmerVisitTimelineProps> = ({
    visits, handleUpdateVisitStatus, radiusClass, isCyber
}) => {
    const { t } = useLanguage();
    const safeVisits = visits ?? [];

    return (
        <section>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4 text-purple-500" />
                {t('nav_visits')}
            </h3>
            <div className="space-y-4">
                {safeVisits.length > 0 ? safeVisits.map((visit, i) => (
                    <div key={visit.id || i} className="relative pl-8 group">
                        {i !== safeVisits.length - 1 && (
                            <div className={`absolute left-3 top-6 bottom-[-16px] w-0.5 transition-colors ${isCyber ? 'bg-primary-500/30' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-500'}`} />
                        )}
                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 shadow-md border-white dark:border-gray-900
                             ${visit.status === 'completed' ? (isCyber ? 'bg-primary-500 neon-glow-primary' : 'bg-primary-500') : 'bg-accent-500'}`} />

                        <div className={`p-4 ${radiusClass} border transition-all cursor-pointer ${isCyber ? 'bg-primary-500/5 hover:border-primary-500/30'
                                : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                            }`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-black uppercase tracking-tight text-gray-900 dark:text-white">
                                    {visit.visit_type}
                                </span>
                                <span className="text-xxs font-bold text-gray-400">
                                    {new Date(visit.scheduled_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-xs-plus text-gray-500 dark:text-gray-400 leading-relaxed italic">
                                &ldquo;{visit.reason || t('visit_routine_inspection')}&rdquo;
                            </p>
                            {visit.status === 'scheduled' && (
                                <div className="flex gap-2 mt-3">
                                    <Button
                                        size="sm"
                                        onClick={() => handleUpdateVisitStatus(visit.id, 'completed')}
                                        className="bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 text-micro font-black uppercase tracking-widest border border-green-500/20"
                                    >
                                        Complete
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => handleUpdateVisitStatus(visit.id, 'cancelled')}
                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-micro font-black uppercase tracking-widest border border-red-500/20"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )) : (
                    <div className={`p-8 text-center ${radiusClass} border border-dashed bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700`}>
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('visit_no_history')}</p>
                    </div>
                )}
            </div>
        </section>
    );
};
