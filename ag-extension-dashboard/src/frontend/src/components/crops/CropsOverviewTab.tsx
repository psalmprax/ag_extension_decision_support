import React from 'react';
import {
  Sprout,
  Map,
  Edit,
  Trash2,
  CheckCircle,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Field, CropCycle } from '@/api/fieldService';
import { FarmPlanSection } from '@/components/fieldtools/FarmPlanSection';

interface CropsOverviewTabProps {
  fields: Field[];
  isFarmer: boolean;
  selectedFarmerId: string;
  cardClass: string;
  btnClass: string;
  handleOpenEditField: (field: Field) => void;
  handleDeleteField: (id: string) => void;
  handleOpenStartCycle: (field: Field) => void;
  handleOpenHarvest: (field: Field, cycle: CropCycle) => void;
  handleOpenAddField: () => void;
}

export const CropsOverviewTab: React.FC<CropsOverviewTabProps> = ({
  fields,
  isFarmer,
  selectedFarmerId,
  cardClass,
  btnClass,
  handleOpenEditField,
  handleDeleteField,
  handleOpenStartCycle,
  handleOpenHarvest,
  handleOpenAddField,
}) => {
  return (
    <motion.div
      key="overview-tab"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      {fields.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {fields.map(field => {
            const currentCycle = field.cropCycles?.find(c => c.status === 'growing');
            return (
              <div
                key={field.id}
                className={`${cardClass} flex flex-col justify-between hover:shadow-2xl border-white/5 hover:border-white/10 transition-all duration-300`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">{field.name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        ID: {field.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditField(field)}
                        className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-primary-400 rounded-lg transition-colors"
                        title="Edit Field details"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                        title="Delete Field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                    <div>
                      <span className="text-xxs font-black uppercase tracking-wider text-slate-500">
                        Area size
                      </span>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">
                        {field.areaHectares} Hectares
                      </p>
                    </div>
                    <div>
                      <span className="text-xxs font-black uppercase tracking-wider text-slate-500">
                        Soil type
                      </span>
                      <p className="text-sm font-bold text-slate-200 mt-0.5 capitalize">
                        {field.soilType || 'Unspecified'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xxs font-black uppercase tracking-wider text-slate-500">
                        Soil pH
                      </span>
                      <p className="text-sm font-bold text-slate-200 mt-0.5">
                        {field.soilPh ? `${Number(field.soilPh).toFixed(1)} pH` : 'Not Measured'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xxs font-black uppercase tracking-wider text-slate-500">
                        Coordinates
                      </span>
                      <p className="text-sm font-bold text-slate-200 mt-0.5 truncate">
                        {field.latitude && field.longitude
                          ? `${Number(field.latitude).toFixed(4)}, ${Number(field.longitude).toFixed(4)}`
                          : 'No GPS Set'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {currentCycle ? (
                      <div className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-xl flex items-start gap-3">
                        <Sprout className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-primary-400 uppercase tracking-wider">
                              Growing
                            </span>
                            <span className="text-xxs font-medium text-slate-400">
                              Planted {new Date(currentCycle.plantingDate!).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-200 mt-1 truncate">
                            {currentCycle.cropName} ({currentCycle.variety || 'Standard'})
                          </h4>
                          {currentCycle.notes && (
                            <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">
                              "{currentCycle.notes}"
                            </p>
                          )}
                          <FarmPlanSection cropCycleId={currentCycle.id} />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-900/30 border border-dashed border-white/10 p-4 rounded-xl text-center py-6">
                        <Info className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-semibold mb-3">
                          No Active Crop Growth Cycles
                        </p>
                        <button
                          onClick={() => handleOpenStartCycle(field)}
                          className="text-xs font-bold text-primary-400 bg-primary-400/10 border border-primary-400/20 hover:bg-primary-400/20 px-3 py-1.5 rounded-xl transition-all"
                        >
                          Plant New Crop
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {currentCycle && (
                  <div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenHarvest(field, currentCycle)}
                      className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400/20 px-4 py-2 rounded-xl transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Record Harvest
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-900/10 border border-dashed border-white/5 rounded-3xl">
          <Map className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-300">No Farm Sectors Found</h3>
          <p className="text-slate-500 text-sm mt-1 mb-6">
            {!isFarmer && !selectedFarmerId
              ? 'Please select a farmer to load their sectors.'
              : 'Start by provisioning your first agronomic field sector.'}
          </p>
          <button
            onClick={handleOpenAddField}
            disabled={!isFarmer && !selectedFarmerId}
            className={`px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all ${btnClass} disabled:opacity-50`}
          >
            Create First Sector
          </button>
        </div>
      )}
    </motion.div>
  );
};
