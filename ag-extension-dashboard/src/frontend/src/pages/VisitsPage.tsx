import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Clock,
  ChevronRight,
  Plus,
  Calendar,
  Radio,
  User,
} from 'lucide-react';
import { Visit, Farmer } from '../types/dashboard';
import { updateVisit } from '@/api/visitService';
import { useLanguage } from '@/lib/LanguageContext';

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'cancelled':
        return 'bg-rose-500/15 border-rose-500/30 text-rose-300';
      default:
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
    }
  };

  return (
    <main id="visits-main" className="max-w-7xl mx-auto space-y-6">
      {/* ── Top Bento Banner & Quick Actions ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <MapPin className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">Field Visits & Itineraries</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Dispatch Radar
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Manage scheduled on-site inspections, priority risk queue appointments, and tele-agronomy calls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            {/* Telemetry Stat Chips */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/80 font-mono">
                Total: <strong className="text-white">{visits.length}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-mono">
                Pending: <strong>{pendingCount}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono">
                Done: <strong>{completedCount}</strong>
              </span>
            </div>

            <button
              onClick={() => setShowVisitModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('visits_schedule_new') || 'Schedule Field Visit'}</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 pt-6 mt-6 border-t border-white/5 overflow-x-auto">
          {[
            { id: 'all', label: 'All Itineraries', count: visits.length },
            { id: 'pending', label: 'Active & Pending', count: pendingCount },
            { id: 'completed', label: 'Completed', count: completedCount },
            { id: 'cancelled', label: 'Cancelled', count: cancelledCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                filter === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                  : 'bg-white/[0.02] text-white/50 border-white/5 hover:border-white/15 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-md bg-white/10 text-xxs font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Visits Cards Grid ── */}
      {filteredVisits.length === 0 ? (
        <div className="p-12 text-center backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-2xl">
          <Calendar className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No visits found in this view</h3>
          <p className="text-xs text-white/50">Schedule a new visit or adjust your active status filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredVisits.map((visit: Visit, idx: number) => {
              const farmerData = farmers.find(
                f =>
                  f.id === visit.farmer_id ||
                  `${f.firstName} ${f.lastName}` === visit.farmer_name
              );
              const isUrgent = visit.status !== 'completed' && visit.status !== 'cancelled' && (visit.visit_type?.includes('urgent') || visit.visit_type?.includes('ai'));

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.3) }}
                  key={visit.id}
                  className={`backdrop-blur-xl bg-slate-900/60 border rounded-2xl p-5 flex flex-col justify-between hover:shadow-2xl transition-all relative group min-h-[220px] ${
                    isUrgent
                      ? 'border-amber-500/40 shadow-lg shadow-amber-950/20'
                      : 'border-white/10 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-emerald-400">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base tracking-tight truncate max-w-[170px]">
                            {visit.farmer_name}
                          </h4>
                          <p className="text-xxs text-white/50 font-bold uppercase tracking-wider mt-0.5">
                            {visit.visit_type || 'Routine Visit'}
                          </p>
                        </div>
                      </div>

                      <span
                        role="status"
                        aria-label={`Visit status: ${visit.status}`}
                        className={`px-2.5 py-0.5 rounded-full text-xxs font-black uppercase tracking-wider border shadow-sm flex items-center gap-1.5 ${getStatusBadge(visit.status)}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                        {visit.status}
                      </span>
                    </div>

                    {/* Scheduled Date & Time */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <p className="text-xs font-mono text-white/80">
                        {new Date(visit.scheduled_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        <span className="text-white/40">@</span>{' '}
                        {new Date(visit.scheduled_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {/* Notes Snippet */}
                    {visit.notes && (
                      <p className="text-xs text-white/60 line-clamp-2 leading-relaxed italic">
                        "{visit.notes}"
                      </p>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                      {visit.status !== 'completed' && visit.status !== 'cancelled' && (
                        <>
                          <button
                            aria-label={`Mark visit for ${visit.farmer_name} as completed`}
                            onClick={async e => {
                              e.stopPropagation();
                              try {
                                await updateVisit(visit.id, { status: 'completed' });
                                refetchVisits();
                                addNotification({
                                  type: 'success',
                                  message: `Visit marked as completed`,
                                });
                              } catch {
                                addNotification({
                                  type: 'error',
                                  message: 'Failed to update visit status',
                                });
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-lg text-xxs font-bold uppercase transition-colors"
                          >
                            Complete
                          </button>
                          <button
                            aria-label={`Cancel visit for ${visit.farmer_name}`}
                            onClick={async e => {
                              e.stopPropagation();
                              try {
                                await updateVisit(visit.id, { status: 'cancelled' });
                                refetchVisits();
                                addNotification({ type: 'info', message: `Visit cancelled` });
                              } catch {
                                addNotification({
                                  type: 'error',
                                  message: 'Failed to update visit status',
                                });
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-lg text-xxs font-bold uppercase transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      aria-label={`View details for farmer ${visit.farmer_name}`}
                      onClick={() => {
                        if (farmerData) handleOpenFarmerDetail(farmerData);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-white/70 hover:text-white transition-all shadow-sm"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
};

export default VisitsPage;
