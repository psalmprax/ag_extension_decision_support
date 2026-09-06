import React from 'react';
import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';
import { Field } from '@/api/fieldService';

interface GrowthCycleModalProps {
  showCycleModal: boolean;
  setShowCycleModal: (show: boolean) => void;
  selectedField: Field | null;
  cycleForm: {
    cropName: string;
    variety: string;
    plantingDate: string;
    expectedHarvestDate: string;
    notes: string;
  };
  setCycleForm: React.Dispatch<
    React.SetStateAction<{
      cropName: string;
      variety: string;
      plantingDate: string;
      expectedHarvestDate: string;
      notes: string;
    }>
  >;
  handleStartCycle: () => Promise<void>;
  radiusClass: string;
}

export const GrowthCycleModal: React.FC<GrowthCycleModalProps> = ({
  showCycleModal,
  setShowCycleModal,
  selectedField,
  cycleForm,
  setCycleForm,
  handleStartCycle,
  radiusClass,
}) => {
  if (!showCycleModal || !selectedField) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto custom-scrollbar shadow-2xl"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Sprout className="w-5 h-5 text-primary-400" />
              Plant Crop on: {selectedField.name}
            </h3>
            <button
              onClick={() => setShowCycleModal(false)}
              className="text-slate-400 hover:text-white text-xl font-medium"
            >
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Crop Name / Type
              </label>
              <input
                type="text"
                value={cycleForm.cropName}
                onChange={e => setCycleForm(prev => ({ ...prev, cropName: e.target.value }))}
                placeholder="e.g. Maize, Sorghum, Coffee"
                className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Crop Variety
              </label>
              <input
                type="text"
                value={cycleForm.variety}
                onChange={e => setCycleForm(prev => ({ ...prev, variety: e.target.value }))}
                placeholder="e.g. H614, Katumani"
                className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Planting Date
                </label>
                <input
                  type="date"
                  value={cycleForm.plantingDate}
                  onChange={e =>
                    setCycleForm(prev => ({ ...prev, plantingDate: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Est. Harvest Date
                </label>
                <input
                  type="date"
                  value={cycleForm.expectedHarvestDate}
                  onChange={e =>
                    setCycleForm(prev => ({ ...prev, expectedHarvestDate: e.target.value }))
                  }
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Notes / Recommendations
              </label>
              <textarea
                value={cycleForm.notes}
                onChange={e => setCycleForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add details on fertilizers applied or seeds used..."
                rows={3}
                className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none`}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5">
              <button
                onClick={handleStartCycle}
                className="flex-1 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all rounded-xl"
              >
                Initialize Growth Cycle
              </button>
              <button
                onClick={() => setShowCycleModal(false)}
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
