import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Calendar, Radio } from 'lucide-react';
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
      <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('ui_visits_page_field_visits_itineraries')}</h1>
                <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  {t('ui_visits_page_dispatch_radar')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-white/60 mt-0.5">
                {t('ui_visits_page_manage_scheduled_on_site_inspections')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            {/* Telemetry Stat Chips */}
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-white/80 font-mono whitespace-nowrap">
                {t('ui_visits_page_total')} <strong className="text-slate-900 dark:text-white tabular-nums">{visits.length}</strong>
              </span>
              <span className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-mono whitespace-nowrap">
                {t('ui_visits_page_pending')} <strong className="tabular-nums">{pendingCount}</strong>
              </span>
              <span className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 font-mono whitespace-nowrap">
                {t('ui_visits_page_done')} <strong className="tabular-nums">{completedCount}</strong>
              </span>
            </div>

            <button
              onClick={() => setShowVisitModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('visits_schedule_new') || 'Schedule Field Visit'}</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-slate-200/80 dark:border-white/5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Itineraries', count: visits.length },
            { id: 'pending', label: 'Active & Pending', count: pendingCount },
            { id: 'completed', label: 'Completed', count: completedCount },
            { id: 'cancelled', label: 'Cancelled', count: cancelledCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 border whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-50 dark:bg-white/[0.02] text-slate-600 dark:text-white/50 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xxs font-mono tabular-nums">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Visits Cards Grid */}
      {filteredVisits.length === 0 ? (
        <div className="p-12 text-center backdrop-blur-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-xl space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6 opacity-70" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-medium text-slate-900 dark:text-white">{t('ui_visits_page_no_field_visits_scheduled')}</h3>
            <p className="text-xs text-slate-600 dark:text-white/50 max-w-sm mx-auto">
              {filter === 'all'
                ? 'No farm visits in queue. Dispatch your extension team or schedule an agronomic visit.'
                : `No visits matching status "${filter}". Try switching filters or scheduling a visit.`}
            </p>
          </div>
          <button
            onClick={() => setShowVisitModal(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-2"
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

