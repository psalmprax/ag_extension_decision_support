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
import { useLanguage } from '@/lib/LanguageContext';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';
import { useUnits } from '@/hooks/useUnits';

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
  btnClass: _btnClass,
  handleOpenEditField,
  handleDeleteField,
  handleOpenStartCycle,
  handleOpenHarvest,
  handleOpenAddField,
}) => {
  const { t } = useLanguage();
  const units = useUnits();
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
                className={`${cardClass} flex flex-col justify-between hover:shadow-2xl border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all duration-300`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-medium text-slate-900 dark:text-white tracking-tight">{field.name}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        ID: {field.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditField(field)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors"
                        title="Edit Field details"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Delete Field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 dark:bg-theme-bg-primary/40 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t('ui_crops_overview_tab_area_size')}
                      </span>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                        {units.area(field.areaHectares, 2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t('ui_crops_overview_tab_soil_type')}
                      </span>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5 capitalize">
                        {field.soilType || 'Unspecified'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t('ui_crops_overview_tab_soil_ph')}
                      </span>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5 tabular-nums">
                        {field.soilPh ? `${Number(field.soilPh).toFixed(1)} pH` : 'Not Measured'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t('ui_crops_overview_tab_coordinates')}
                      </span>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate font-mono text-xs tabular-nums">
                        {field.latitude && field.longitude
                          ? `${Number(field.latitude).toFixed(4)}, ${Number(field.longitude).toFixed(4)}`
                          : 'No GPS Set'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {currentCycle ? (
                      <div className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-xl flex items-start gap-3">
                        <Sprout className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                              {t('ui_crops_overview_tab_growing')}
                            </span>
                            <span className="text-xxs font-medium text-slate-500 dark:text-slate-400">
                              {t('ui_crops_overview_tab_planted')} {new Date(currentCycle.plantingDate!).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-200 mt-1 truncate">
                            {currentCycle.cropName} ({currentCycle.variety || 'Standard'})
                          </h4>
                          {currentCycle.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic line-clamp-1">
                              "{currentCycle.notes}"
                            </p>
                          )}
                          <FarmPlanSection cropCycleId={currentCycle.id} />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-theme-bg-secondary/30 border border-dashed border-slate-200 dark:border-white/10 p-4 rounded-xl text-center py-6">
                        <Info className="w-5 h-5 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-3">
                          {t('ui_crops_overview_tab_no_active_crop_growth_cycles')}
                        </p>
                        <button
                          onClick={() => handleOpenStartCycle(field)}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-500/10 border border-primary-500/20 hover:bg-primary-500/20 px-3 py-1.5 rounded-xl transition-all"
                        >
                          {t('ui_crops_overview_tab_plant_new_crop')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {currentCycle && (
                  <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenHarvest(field, currentCycle)}
                      className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-4 py-2 rounded-xl transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t('ui_crops_overview_tab_record_harvest')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-14 px-6 border border-dashed border-slate-900/[0.12] dark:border-white/[0.1] rounded-xl">
          <Map className="w-8 h-8 text-slate-400 dark:text-white/40 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-medium text-slate-900 dark:text-white">{t('fields_empty_title', { defaultValue: 'No fields yet' })}</h3>
          <p className="text-slate-600 dark:text-white/60 text-sm mt-1 mb-5">
            {!isFarmer && !selectedFarmerId
              ? t('fields_choose_farmer', { defaultValue: 'Choose a farmer to see their fields.' })
              : t('fields_empty_body', { defaultValue: 'Add the first field: its size, soil and where it is.' })}
          </p>
          <button onClick={handleOpenAddField} disabled={!isFarmer && !selectedFarmerId} className={PRIMARY_BUTTON}>
            {t('field_add_title', { defaultValue: 'Add field' })}
          </button>
        </div>
      )}
    </motion.div>
  );
};
