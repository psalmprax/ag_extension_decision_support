import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Send, FileText, Trash2, X, Lock, Search, ChevronRight } from 'lucide-react';
import { Farmer } from '../types/dashboard';
import { useDemoMode } from '@/demo';
import { PageHeader } from '@/components/ui/PageHeader';
import { SECONDARY_BUTTON } from '@/components/ui/controlStyles';
import { useLanguage } from '../lib/LanguageContext';
import { RegisterFarmerButton } from '@/components/portfolio/RegisterFarmerButton';
import { useUnits } from '@/hooks/useUnits';

interface PortfolioPageProps {
  effectiveFarmers: Farmer[];
  selectedFarmers: Set<string>;
  handleSelectFarmer: (id: string, checked: boolean) => void;
  handleOpenFarmerDetail: (farmer: Farmer) => void;
  showBulkSmsComposer: boolean;
  setShowBulkSmsComposer: (show: boolean) => void;
  bulkSmsMessage: string;
  setBulkSmsMessage: (msg: string) => void;
  handleBulkSMS: () => void;
  handleBulkExport: () => void;
  handleBulkDelete: () => void;
  setSelectedFarmers: (farmers: Set<string>) => void;
}

export const PortfolioPage: React.FC<PortfolioPageProps> = ({
  effectiveFarmers,
  selectedFarmers,
  handleSelectFarmer,
  handleOpenFarmerDetail,
  showBulkSmsComposer,
  setShowBulkSmsComposer,
  bulkSmsMessage,
  setBulkSmsMessage,
  handleBulkSMS,
  handleBulkExport,
  handleBulkDelete,
  setSelectedFarmers,
}) => {
  const { t } = useLanguage();
  const units = useUnits();
  const { isDemo } = useDemoMode();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFarmers = effectiveFarmers.filter(f => {
    const term = searchQuery.toLowerCase();
    const fullName = `${f.firstName} ${f.lastName}`.toLowerCase();
    const loc = `${f.district || ''} ${f.region || ''} ${f.village || ''}`.toLowerCase();
    const crops = (f.crops || []).join(' ').toLowerCase();
    return fullName.includes(term) || loc.includes(term) || crops.includes(term);
  });

  const totalLandHa = effectiveFarmers.reduce((acc, f) => acc + (Number(f.farmSize) || 0), 0);

  const toggleSelectAll = () => {
    if (selectedFarmers.size === filteredFarmers.length) {
      setSelectedFarmers(new Set());
    } else {
      setSelectedFarmers(new Set(filteredFarmers.map(f => f.id)));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      <PageHeader
        title={t('ui_portfolio_page_client_portfolio')}
        description={t('ui_portfolio_page_manage_smallholder_cohorts_inspect_i')}
        meta={
          <span className="tabular-nums">
            {t('portfolio_summary', {
              count: effectiveFarmers.length,
              area: units.area(totalLandHa),
              defaultValue: '{count} farmers, {area} in total',
            })}
            {selectedFarmers.size > 0 && ` · ${t('portfolio_selected_count', { count: selectedFarmers.size, defaultValue: '{count} selected' })}`}
          </span>
        }
      >
        {/* Search & Bulk Select Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 dark:text-white/40 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('portfolio_search_placeholder', { defaultValue: 'Search by name, region or crop' })}
              className="w-full h-10 ps-10 pe-4 text-sm rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            <RegisterFarmerButton />
            <button
              onClick={toggleSelectAll}
              className={SECONDARY_BUTTON}
            >
              {selectedFarmers.size === filteredFarmers.length && filteredFarmers.length > 0
                ? t('portfolio_clear_selection', { defaultValue: 'Clear selection' })
                : t('portfolio_select_all', { defaultValue: 'Select all' })}
            </button>
            <button
              onClick={handleBulkExport}
              className={SECONDARY_BUTTON}
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>{t('portfolio_export_csv')}</span>
            </button>
          </div>
        </div>
      </PageHeader>

      {isDemo && (
        <div className="p-4 bg-amber-50 dark:bg-amber-400/[0.08] border border-amber-600/20 dark:border-amber-300/20 rounded-lg flex items-center gap-3">
          <Lock className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" aria-hidden="true" />
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <strong className="font-medium">{t('ui_portfolio_page_sandbox_mode')}</strong> {t('ui_portfolio_page_sample_farmer_cohort_records_shown_c')}
          </p>
        </div>
      )}

      {/* ── Bulk SMS Composer Drawer ── */}
      {showBulkSmsComposer && selectedFarmers.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 backdrop-blur-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                {t('ui_portfolio_page_multi_channel_broadcast_to')} {selectedFarmers.size} {t('ui_portfolio_page_client')}{selectedFarmers.size !== 1 ? 's' : ''}
              </h4>
            </div>
            <button
              onClick={() => setShowBulkSmsComposer(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={bulkSmsMessage}
            onChange={e => setBulkSmsMessage(e.target.value)}
            placeholder="Type advisory alert message... (e.g. Warning: Heavy rain forecast over next 48 hours. Ensure field drainage channels are cleared.)"
            rows={3}
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:ring-1 focus:ring-emerald-500/40 outline-none text-xs resize-none"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-xxs text-slate-500 dark:text-white/40 font-mono tabular-nums">{t('ui_ussd_gateway_tester_characters', { length: bulkSmsMessage.length })}</span>
            <button
              onClick={handleBulkSMS}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('ui_portfolio_page_dispatch_to')} {selectedFarmers.size} {t('register_role_farmer')}{selectedFarmers.size !== 1 ? 's' : ''}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Farmer Bento Grid ── */}
      {filteredFarmers.length === 0 ? (
        <div className="p-12 text-center backdrop-blur-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200 dark:border-white/[0.08] rounded-xl space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('ui_portfolio_page_no_client_records_found')}</h3>
            <p className="text-xs text-slate-600 dark:text-white/50 max-w-sm mx-auto">
              {searchQuery
                ? `No farmers found matching "${searchQuery}". Try clearing search keywords.`
                : 'No smallholder client farmers enrolled in this portfolio yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence>
            {filteredFarmers.map((farmer: Farmer, idx: number) => {
              const isSelected = selectedFarmers.has(farmer.id);

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3) }}
                  key={farmer.id}
                  onClick={() => handleOpenFarmerDetail(farmer)}
                  className={`bg-white dark:bg-white/[0.03] border rounded-lg p-5 transition-colors relative group flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500/60 ring-1 ring-emerald-500/40'
                      : 'border-slate-900/[0.08] dark:border-white/[0.08] hover:border-slate-900/20 dark:hover:border-white/20'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold text-base">
                          {farmer.firstName?.[0] || 'F'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-tight truncate max-w-[140px]">
                            {farmer.firstName} {farmer.lastName}
                          </h3>
                          {farmer.phone && (
                            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-white/50">{farmer.phone}</span>
                          )}
                        </div>
                      </div>

                      <div
                        onClick={e => e.stopPropagation()}
                        className="pt-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => handleSelectFarmer(farmer.id, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Telemetry Details */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-xxs font-medium text-slate-500 dark:text-white/40 block">
                          {t('farmer_register_location')}
                        </span>
                        <p className="font-medium text-slate-800 dark:text-white/90 truncate">
                          {farmer.district || farmer.region || farmer.village || '—'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xxs font-medium text-slate-500 dark:text-white/40 block">
                          {t('ui_portfolio_page_land_holding')}
                        </span>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                          {units.area(farmer.farmSize || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 min-h-[26px]">
                      {farmer.crops && farmer.crops.length > 0 ? (
                        farmer.crops.map((crop: string) => (
                          <span
                            key={crop}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xxs font-medium"
                          >
                            {crop}
                          </span>
                        ))
                      ) : (
                        <span className="text-xxs text-slate-400 dark:text-white/30 italic">{t('ui_portfolio_page_no_crops_tagged')}</span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Protocol badges & detail arrow */}
                  <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xxs text-slate-500 dark:text-white/50">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/70 font-medium">
                        SMS
                      </span>
                      {farmer.phone && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                          {t('billing_status_active')}
                        </span>
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.03] group-hover:bg-slate-200 dark:group-hover:bg-white/[0.08] text-slate-500 dark:text-white/50 flex items-center justify-center transition-colors">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Floating Batch Action Dock (when farmers selected) ── */}
      <AnimatePresence>
        {selectedFarmers.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom))] md:bottom-8 left-1/2 -translate-x-1/2 z-[1050] backdrop-blur-xl bg-slate-900/95 border border-slate-700/80 dark:border-white/10 shadow-xl rounded-xl px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sm:justify-start gap-2 sm:gap-4 flex-wrap w-[calc(100%-1.5rem)] max-w-xl md:w-auto"
          >
            <div className="flex items-center gap-2 pe-2 border-e border-white/10 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <strong className="text-white font-mono tabular-nums">{selectedFarmers.size}</strong>
              <span className="text-white/70">{t('common_selected', { defaultValue: 'selected' })}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => setShowBulkSmsComposer(!showBulkSmsComposer)}
                className="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('portfolio_broadcast_alert', { defaultValue: 'Broadcast alert' })}</span>
              </button>

              <button
                onClick={handleBulkExport}
                className="px-3 sm:px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-medium rounded-lg border border-white/10 transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>{t('portfolio_export_csv', { defaultValue: 'Export CSV' })}</span>
              </button>

              <button
                onClick={handleBulkDelete}
                className="px-3 sm:px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('common_delete', { defaultValue: 'Delete' })}</span>
              </button>

              <button
                onClick={() => setSelectedFarmers(new Set())}
                className="px-2.5 sm:px-3 py-2 text-white/50 hover:text-white text-xs font-medium transition-colors"
              >
                {t('common_clear', { defaultValue: 'Clear' })}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortfolioPage;
