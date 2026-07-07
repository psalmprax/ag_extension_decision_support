import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, ChevronRight } from 'lucide-react';
import { Visit, Farmer } from '../types/dashboard';
import { updateVisit } from '@/api/visitService';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';

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
  const { isModern, headingClass, btnClass, radiusClass } = useThemeClasses();

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className={`text-3xl ${headingClass}`}>
            {isModern ? 'Field Telemetry' : 'Field Visits'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {t('visits_subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowVisitModal(true)}
          className={`px-6 py-3 ${isModern ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20 shadow-lg' : 'bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-200 text-slate-900 dark:text-white'} ${btnClass} transition-all flex items-center gap-2`}
        >
          <MapPin className="w-4 h-4" />
          {t('visits_schedule_new')}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-2">
        <AnimatePresence>
          {visits.map((visit: Visit, idx: number) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{
                duration: 0.4,
                type: 'spring',
                bounce: 0.3,
                delay: Math.min(idx * 0.05, 0.5),
              }}
              key={visit.id}
              className="card glass p-6 flex flex-col justify-between hover:shadow-2xl transition-all duration-300 relative group min-h-[180px]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 bg-secondary-900/10 dark:bg-white/10 ${radiusClass} flex items-center justify-center transition-colors shadow-inner`}
                  >
                    <MapPin className="w-6 h-6 text-secondary-600 dark:text-secondary-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-lg tracking-tight truncate max-w-[150px]">
                      {visit.farmer_name}
                    </h4>
                    <p className="text-xxs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                      {visit.visit_type}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 ${radiusClass} text-micro font-black uppercase tracking-widest border shadow-sm ${
                    visit.status === 'completed'
                      ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
                      : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                  }`}
                >
                  {visit.status}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary-500" />
                </div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  {new Date(visit.scheduled_at).toLocaleDateString()}{' '}
                  <span className="opacity-50">@</span>{' '}
                  {new Date(visit.scheduled_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/10 flex justify-between items-center group-hover:border-primary-500/30 transition-colors">
                <div className="flex gap-2">
                  {visit.status !== 'completed' && visit.status !== 'cancelled' && (
                    <>
                      <button
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
                        className={`px-3 py-1.5 bg-green-500/20 text-green-700 dark:text-green-400 ${btnClass} text-xxs font-black uppercase hover:bg-green-500/30 transition-colors shadow-sm`}
                      >
                        Complete
                      </button>
                      <button
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
                        className={`px-3 py-1.5 bg-red-500/10 text-red-700 dark:text-red-400 ${btnClass} text-xxs font-black uppercase hover:bg-red-500/20 transition-colors`}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    const farmerData = farmers.find(
                      f =>
                        f.id === visit.farmer_id ||
                        `${f.firstName} ${f.lastName}` === visit.farmer_name
                    );
                    if (farmerData) handleOpenFarmerDetail(farmerData);
                  }}
                  className="w-8 h-8 flex items-center justify-center glass rounded-full hover:bg-primary-500 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
