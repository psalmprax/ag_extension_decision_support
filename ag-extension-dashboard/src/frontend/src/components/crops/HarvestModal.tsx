import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { Field, CropCycle } from '@/api/fieldService';

interface HarvestModalProps {
  showHarvestModal: boolean;
  setShowHarvestModal: (show: boolean) => void;
  selectedField: Field | null;
  selectedCycle: CropCycle | null;
  harvestForm: {
    status: 'harvested' | 'failed';
    actualHarvestDate: string;
    yieldKg: string;
    notes: string;
  };
  setHarvestForm: React.Dispatch<
    React.SetStateAction<{
      status: 'harvested' | 'failed';
      actualHarvestDate: string;
      yieldKg: string;
      notes: string;
    }>
  >;
  handleHarvestCycle: () => Promise<void>;
  radiusClass: string;
}

export const HarvestModal: React.FC<HarvestModalProps> = ({
  showHarvestModal,
  setShowHarvestModal,
  selectedField,
  selectedCycle,
  harvestForm,
  setHarvestForm,
  handleHarvestCycle,
  radiusClass,
}) => {
  if (!showHarvestModal || !selectedField || !selectedCycle) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Conclude Cycle: {selectedCycle.cropName}
            </h3>
            <button
              onClick={() => setShowHarvestModal(false)}
              className="text-slate-400 hover:text-white text-xl font-medium"
            >
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Status Result
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setHarvestForm(prev => ({ ...prev, status: 'harvested' }))}
                  className={`py-3 text-sm font-bold uppercase rounded-xl border transition-all ${
                    harvestForm.status === 'harvested'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                      : 'bg-slate-950 text-slate-400 border-white/5'
                  }`}
                >
                  Successful Harvest
                </button>
                <button
                  type="button"
                  onClick={() => setHarvestForm(prev => ({ ...prev, status: 'failed' }))}
                  className={`py-3 text-sm font-bold uppercase rounded-xl border transition-all ${
                    harvestForm.status === 'failed'
                      ? 'bg-red-500/10 text-red-400 border-red-500'
                      : 'bg-slate-950 text-slate-400 border-white/5'
                  }`}
                >
                  Crop Failure
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Harvest Date
                </label>
                <input
                  type="date"
                  value={harvestForm.actualHarvestDate}
                  onChange={e =>
                    setHarvestForm(prev => ({ ...prev, actualHarvestDate: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Yield (Kilograms)
                </label>
                <input
                  type="number"
                  disabled={harvestForm.status === 'failed'}
                  value={harvestForm.status === 'failed' ? '' : harvestForm.yieldKg}
                  onChange={e => setHarvestForm(prev => ({ ...prev, yieldKg: e.target.value }))}
                  placeholder="e.g. 4500"
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none disabled:opacity-50`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Harvest Notes / Remarks
              </label>
              <textarea
                value={harvestForm.notes}
                onChange={e => setHarvestForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add concluding notes on yield, conditions, or causes of crop failure..."
                rows={3}
                className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none`}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5">
              <button
                onClick={handleHarvestCycle}
                className={`flex-1 px-5 py-2.5 font-bold transition-all rounded-xl ${
                  harvestForm.status === 'harvested'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                Conclude Growth Cycle
              </button>
              <button
                onClick={() => setShowHarvestModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
