import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Send,
  FileText,
  Trash2,
  X,
  Lock,
  Radio,
  Search,
  ChevronRight,
} from 'lucide-react';
import { Farmer } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';
import { useDemoMode } from '@/demo';

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
  const { t: _t } = useLanguage();
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
      {/* ── Top Bento Banner: Portfolio Intelligence & Telemetry ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">Client Portfolio</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Telemetry Mesh Active
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Manage smallholder cohorts, inspect individual agronomic telemetry, and dispatch bulk advisories.
              </p>
            </div>
          </div>

          {/* Quick Telemetry Metric Badges */}
          <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full lg:w-auto">
            <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
              <span className="text-xxs font-semibold text-white/40 uppercase block">Total Clients</span>
              <strong className="text-sm font-bold text-white font-mono">{effectiveFarmers.length}</strong>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
              <span className="text-xxs font-semibold text-white/40 uppercase block">Total Land</span>
              <strong className="text-sm font-bold text-emerald-400 font-mono">{(Number(totalLandHa) || 0).toFixed(1)} ha</strong>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
              <span className="text-xxs font-semibold text-white/40 uppercase block">Selected</span>
              <strong className="text-sm font-bold text-purple-400 font-mono">{selectedFarmers.size}</strong>
            </div>
          </div>
        </div>

        {/* Search & Bulk Select Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-5 border-t border-white/5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, region, crop..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-white/30 focus:ring-1 focus:ring-emerald-400 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-colors"
            >
              {selectedFarmers.size === filteredFarmers.length && filteredFarmers.length > 0
                ? 'Deselect All'
                : 'Select All Filtered'}
            </button>
            <button
              onClick={handleBulkExport}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-xs font-semibold text-white/80 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {isDemo && (
        <div className="p-4 backdrop-blur-xl bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/90">
            <strong>Sandbox Mode:</strong> Sample farmer cohort records shown. Connect tenant account to sync live SMS registries and satellite NDVI boundaries.
          </p>
        </div>
      )}

      {/* ── Bulk SMS Composer Drawer ── */}
      {showBulkSmsComposer && selectedFarmers.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 backdrop-blur-xl bg-slate-900/80 border border-purple-500/30 rounded-xl shadow-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Multi-Channel Broadcast to {selectedFarmers.size} Client{selectedFarmers.size !== 1 ? 's' : ''}
              </h4>
            </div>
            <button
              onClick={() => setShowBulkSmsComposer(false)}
              className="p-1 text-white/40 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={bulkSmsMessage}
            onChange={e => setBulkSmsMessage(e.target.value)}
            placeholder="Type advisory alert message... (e.g. Warning: Heavy rain forecast over next 48 hours. Ensure field drainage channels are cleared.)"
            rows={3}
            className="w-full p-3.5 rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-white/30 focus:ring-1 focus:ring-purple-400 outline-none text-xs resize-none"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-xxs text-white/40 font-mono">{bulkSmsMessage.length} characters</span>
            <button
              onClick={handleBulkSMS}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-950/40 transition-all flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Dispatch to {selectedFarmers.size} Farmer{selectedFarmers.size !== 1 ? 's' : ''}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Farmer Bento Grid ── */}
      {filteredFarmers.length === 0 ? (
        <div className="p-12 text-center backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-xl space-y-4">
          <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
            <Users className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Client Records Found</h3>
            <p className="text-xs text-white/50 max-w-sm mx-auto">
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
                  className={`backdrop-blur-xl bg-slate-900/60 border rounded-xl p-5 hover:shadow-2xl transition-all duration-300 relative group flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-emerald-950/30'
                      : 'border-white/10 hover:border-emerald-500/40 hover:-translate-y-1'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold text-base shadow-inner">
                          {farmer.firstName?.[0] || 'F'}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight truncate max-w-[140px]">
                            {farmer.firstName} {farmer.lastName}
                          </h3>
                          <span className="text-xxs font-mono text-white/40">
                            ID: {farmer.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      {/* Checkbox Selector */}
                      <div
                        onClick={e => e.stopPropagation()}
                        className="pt-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => handleSelectFarmer(farmer.id, e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Telemetry Details */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">
                          Location
                        </span>
                        <p className="font-semibold text-white/90 truncate">
                          {farmer.district || farmer.region || farmer.village || '—'}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xxs font-bold text-white/40 uppercase tracking-wider block">
                          Land Holding
                        </span>
                        <p className="font-bold text-emerald-400 font-mono">
                          {farmer.farmSize || 0} ha
                        </p>
                      </div>
                    </div>

                    {/* Crops Chips */}
                    <div className="flex flex-wrap gap-1 min-h-[26px]">
                      {farmer.crops && farmer.crops.length > 0 ? (
                        farmer.crops.map((crop: string) => (
                          <span
                            key={crop}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xxs font-medium"
                          >
                            {crop}
                          </span>
                        ))
                      ) : (
                        <span className="text-xxs text-white/30 italic">No crops tagged</span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Protocol badges & detail arrow */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xxs text-white/50">
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/5 text-white/70">
                        SMS
                      </span>
                      {farmer.phone && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-white/[0.03] group-hover:bg-emerald-500/20 text-white/50 group-hover:text-emerald-300 flex items-center justify-center transition-colors">
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
            className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 backdrop-blur-2xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl shadow-emerald-950/60 rounded-xl px-4 sm:px-6 py-3 flex items-center justify-between sm:justify-start gap-3 sm:gap-4 flex-wrap w-[calc(100%-1.5rem)] max-w-xl md:w-auto"
          >
            <div className="flex items-center gap-2 pr-2 border-r border-white/10 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <strong className="text-white font-mono">{selectedFarmers.size}</strong>
              <span className="text-white/70">selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkSmsComposer(!showBulkSmsComposer)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Broadcast Alert</span>
              </button>

              <button
                onClick={handleBulkExport}
                className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold rounded-xl border border-white/10 transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <button
                onClick={() => setSelectedFarmers(new Set())}
                className="px-3 py-2 text-white/50 hover:text-white text-xs font-semibold transition-colors"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortfolioPage;
