import React from 'react';
import { motion } from 'framer-motion';
import { Field } from '@/api/fieldService';

interface FieldModalProps {
  showFieldModal: boolean;
  setShowFieldModal: (show: boolean) => void;
  editingField: Field | null;
  fieldForm: {
    name: string;
    areaHectares: string;
    soilType: string;
    soilPh: string;
    latitude: string;
    longitude: string;
  };
  setFieldForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      areaHectares: string;
      soilType: string;
      soilPh: string;
      latitude: string;
      longitude: string;
    }>
  >;
  handleSaveField: () => Promise<void>;
  radiusClass: string;
}

export const FieldModal: React.FC<FieldModalProps> = ({
  showFieldModal,
  setShowFieldModal,
  editingField,
  fieldForm,
  setFieldForm,
  handleSaveField,
  radiusClass,
}) => {
  if (!showFieldModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-white/10 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-xl font-bold text-white">
              {editingField ? 'Modify Field Sector' : 'Register New Sector'}
            </h3>
            <button
              onClick={() => setShowFieldModal(false)}
              className="text-slate-400 hover:text-white text-xl font-medium"
            >
              &times;
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                Sector Name
              </label>
              <input
                type="text"
                value={fieldForm.name}
                onChange={e => setFieldForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. North Plot, Riverside Block B"
                className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Area (Hectares)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={fieldForm.areaHectares}
                  onChange={e =>
                    setFieldForm(prev => ({ ...prev, areaHectares: e.target.value }))
                  }
                  placeholder="e.g. 2.5"
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Soil Type
                </label>
                <input
                  type="text"
                  value={fieldForm.soilType}
                  onChange={e => setFieldForm(prev => ({ ...prev, soilType: e.target.value }))}
                  placeholder="e.g. Loam, Clay"
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Soil pH
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={fieldForm.soilPh}
                  onChange={e => setFieldForm(prev => ({ ...prev, soilPh: e.target.value }))}
                  placeholder="e.g. 6.5"
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={fieldForm.latitude}
                  onChange={e => setFieldForm(prev => ({ ...prev, latitude: e.target.value }))}
                  placeholder="e.g. -1.2863"
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={fieldForm.longitude}
                  onChange={e => setFieldForm(prev => ({ ...prev, longitude: e.target.value }))}
                  placeholder="e.g. 36.8172"
                  className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-primary-500 focus:outline-none`}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/5">
              <button
                onClick={handleSaveField}
                className="flex-1 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all rounded-xl"
              >
                {editingField ? 'Commit Changes' : 'Provision Sector'}
              </button>
              <button
                onClick={() => setShowFieldModal(false)}
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
