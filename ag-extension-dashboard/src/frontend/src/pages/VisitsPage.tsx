import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Calendar } from 'lucide-react';
import { Visit, Farmer } from '../types/dashboard';
import { updateVisit } from '@/api/visitService';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRIMARY_BUTTON, TAB_ROW, tabButtonClass } from '@/components/ui/controlStyles';
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
      <PageHeader
        title={t('ui_visits_page_field_visits_itineraries')}
        description={t('ui_visits_page_manage_scheduled_on_site_inspections')}
        actions={
          <button onClick={() => setShowVisitModal(true)} className={PRIMARY_BUTTON}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{t('visits_schedule_new') || 'Schedule a visit'}</span>
          </button>
        }
      >
        {/* Status Filter Tabs */}
        <div className={TAB_ROW}>
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
              className={tabButtonClass(filter === tab.id)}
            >
              <span>{tab.label}</span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-white/50">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </PageHeader>

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

