import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Calendar } from 'lucide-react';
import { Visit, Farmer } from '../types/dashboard';
import { updateVisit } from '@/api/visitService';
import { useLanguage } from '@/lib/LanguageContext';
import { VisitCard } from '@/components/visits/VisitCard';
import { VisitReportModal, type VisitReportTarget } from '@/components/visits/VisitReportModal';

interface VisitsPageProps {
  visits: Visit[];
  setShowVisitModal: (show: boolean) => void;
  refetchVisits: () => void;
  handleOpenFarmerDetail: (farmer: Farmer) => void;
  farmers: Farmer[];
  addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
}

export const VisitsPage: React.FC<VisitsPageProps> = ({
  visits,
  setShowVisitModal,
  refetchVisits,
  handleOpenFarmerDetail,
  farmers,
  addNotification,
}) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');

  const pendingCount = visits.filter(v => v.status !== 'completed' && v.status !== 'cancelled').length;
  const completedCount = visits.filter(v => v.status === 'completed').length;
  const cancelledCount = visits.filter(v => v.status === 'cancelled').length;

  const filteredVisits = visits.filter(v => {
    if (filter === 'all') return true;
    if (filter === 'pending') return v.status !== 'completed' && v.status !== 'cancelled';
    return v.status === filter;
  });

  // Completing a visit means filing its report: findings, time on farm, photos, follow-up.
  const [reportFor, setReportFor] = useState<VisitReportTarget | null>(null);
  const handleComplete = (visit: Visit, name: string) => {
    const farmerId = visit.farmerId || visit.farmer_id;
    if (farmerId) setReportFor({ visitId: visit.id, farmerId, farmerName: name });
  };

  const handleCancel = async (id: string, name: string) => {
    try {
      await updateVisit(id, { status: 'cancelled' });
      refetchVisits();
      addNotification({
        type: 'info',
        message: `Visit for ${name} cancelled`,
      });
    } catch {
      addNotification({
        type: 'error',
        message: 'Failed to update visit status',
      });
    }
  };

  return (
    <main id="visits-main" className="max-w-7xl mx-auto space-y-6">
      {reportFor && (
        <VisitReportModal
          target={reportFor}
          onClose={() => setReportFor(null)}
          onSaved={message => {
            refetchVisits();
            addNotification({ type: 'success', message });
          }}
        />
      )}
      {/* ── Top Bento Banner & Quick Actions ── */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
          <div>
            <h1 className="text-2xl font-medium text-slate-900 dark:text-white">{t('ui_visits_page_field_visits_itineraries')}</h1>
            <p className="text-sm text-slate-600 dark:text-white/60 mt-1">
              {t('ui_visits_page_manage_scheduled_on_site_inspections')}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            <button
              onClick={() => setShowVisitModal(true)}
              className="w-full sm:w-auto h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('visits_schedule_new') || 'Schedule Field Visit'}</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-slate-200/80 dark:border-white/5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: t('visits_filter_all', { defaultValue: 'All' }), count: visits.length },
            { id: 'pending', label: t('visits_filter_upcoming', { defaultValue: 'Upcoming' }), count: pendingCount },
            { id: 'completed', label: t('visits_filter_completed', { defaultValue: 'Completed' }), count: completedCount },
            { id: 'cancelled', label: t('visits_filter_cancelled', { defaultValue: 'Cancelled' }), count: cancelledCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              aria-pressed={filter === tab.id}
              className={`h-8 px-3 rounded-md text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-emerald-50 dark:bg-emerald-400/[0.1] text-emerald-800 dark:text-emerald-200 font-medium'
                  : 'text-slate-600 dark:text-white/60 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-white/50">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Visits Cards Grid */}
      {filteredVisits.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg space-y-4">
          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-slate-300 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-medium text-slate-900 dark:text-white">{t('ui_visits_page_no_field_visits_scheduled')}</h3>
            <p className="text-sm text-slate-600 dark:text-white/60 max-w-sm mx-auto">
              {filter === 'all'
                ? t('visits_empty_all', { defaultValue: 'Plan a visit to a farmer and it will show here with its date and notes.' })
                : t('visits_empty_filtered', { defaultValue: 'No visits in this list. Choose All to see every visit.' })}
            </p>
          </div>
          <button
            onClick={() => setShowVisitModal(true)}
            className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('ui_visits_page_schedule_field_visit')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredVisits.map((visit: Visit, idx: number) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                idx={idx}
                farmers={farmers}
                onComplete={handleComplete}
                onCancel={handleCancel}
                onOpenDetail={handleOpenFarmerDetail}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
};

export default VisitsPage;

