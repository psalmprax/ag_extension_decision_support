import React from 'react';
import { appLocale } from '@/lib/appLocale';
import { CheckCircle, CloudSun, Edit, FlaskConical, Info, Sprout, Trash2 } from 'lucide-react';
import type { Field, CropCycle } from '@/api/fieldService';
import { FarmPlanSection } from '@/components/fieldtools/FarmPlanSection';
import { useLanguage } from '@/lib/LanguageContext';
import { useUnits } from '@/hooks/useUnits';
import { BoundaryOutline } from './boundary/BoundaryOutline';
import { useBoundaryDescription } from './boundary/useBoundaryDescription';
import { storedBoundary, type FieldBoundary } from './boundary/boundaryModel';
import type { FieldRecordsTab } from './records/FieldRecordsDialog';
import { PendingSyncBadge } from '@/components/common/PendingSyncBadge';

interface FieldCardProps {
  field: Field;
  cardClass: string;
  onEdit: (field: Field) => void;
  onDelete: (id: string) => void;
  onStartCycle: (field: Field) => void;
  onHarvest: (field: Field, cycle: CropCycle) => void;
  onOpenRecords: (field: Field, tab: FieldRecordsTab) => void;
}

const LABEL = 'text-xs font-medium text-slate-500 dark:text-theme-text-muted';
const VALUE = 'text-sm font-medium text-slate-800 dark:text-theme-text-primary mt-0.5';
const RECORD_BUTTON = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm border border-slate-900/[0.12] dark:border-white/[0.14] text-slate-700 dark:text-theme-text-primary hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]';

/** The mapped shape and how its area was measured. */
const BoundaryLine: React.FC<{ boundary: FieldBoundary }> = ({ boundary }) => {
  const { t } = useLanguage();
  const { how, margin } = useBoundaryDescription(boundary);
  return (
    <div className="flex items-center gap-3 mb-4">
      <BoundaryOutline points={boundary.points} label={t('boundary_outline_label', { defaultValue: 'Shape of the field' })} className="w-10 h-10" />
      <p className="text-xs text-slate-600 dark:text-theme-text-muted">
        {t('boundary_area_measured', { defaultValue: 'Area measured from the boundary.' })} {margin ? `${how}; ${margin}.` : `${how}.`}
      </p>
    </div>
  );
};

/** One field: its size, soil and location, its boundary, the crop growing on it and its records. */
export const FieldCard: React.FC<FieldCardProps> = ({ field, cardClass, onEdit, onDelete, onStartCycle, onHarvest, onOpenRecords }) => {
  const { t } = useLanguage();
  const units = useUnits();
  const currentCycle = field.cropCycles?.find(c => c.status === 'growing');
  const boundary = storedBoundary(field);

  return (
    <div className={`${cardClass} flex flex-col justify-between border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors`}>
      <div>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-medium text-slate-900 dark:text-white">{field.name}</h3>
            {field.pendingSync ? <PendingSyncBadge className="mt-1" /> : <p className="text-xs text-slate-500 mt-1 tabular-nums">ID: {field.id.slice(0, 8)}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(field)} aria-label={t('field_edit_named', { defaultValue: 'Edit {name}', name: field.name })} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(field.id)} aria-label={t('field_delete_named', { defaultValue: 'Delete {name}', name: field.name })} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50 dark:bg-theme-bg-primary/40 p-3 rounded-xl border border-slate-200 dark:border-white/5">
          <div>
            <span className={LABEL}>{t('ui_crops_overview_tab_area_size')}</span>
            <p className={`${VALUE} tabular-nums`}>{units.area(field.areaHectares, 2)}</p>
          </div>
          <div>
            <span className={LABEL}>{t('ui_crops_overview_tab_soil_type')}</span>
            <p className={`${VALUE} capitalize`}>{field.soilType || t('field_soil_unspecified', { defaultValue: 'Not recorded' })}</p>
          </div>
          <div>
            <span className={LABEL}>{t('ui_crops_overview_tab_soil_ph')}</span>
            <p className={`${VALUE} tabular-nums`}>{field.soilPh ? `${Number(field.soilPh).toFixed(1)} pH` : t('field_ph_not_measured', { defaultValue: 'Not measured' })}</p>
          </div>
          <div>
            <span className={LABEL}>{t('ui_crops_overview_tab_coordinates')}</span>
            <p className={`${VALUE} truncate text-xs tabular-nums`}>
              {field.latitude && field.longitude ? `${Number(field.latitude).toFixed(4)}, ${Number(field.longitude).toFixed(4)}` : t('field_no_location', { defaultValue: 'No location yet' })}
            </p>
          </div>
        </div>

        {boundary && <BoundaryLine boundary={boundary} />}

        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={() => onOpenRecords(field, 'soil')} className={RECORD_BUTTON}>
            <FlaskConical className="w-4 h-4" aria-hidden="true" />
            {t('field_records_soil', { defaultValue: 'Soil tests' })}
          </button>
          <button type="button" onClick={() => onOpenRecords(field, 'weather')} className={RECORD_BUTTON}>
            <CloudSun className="w-4 h-4" aria-hidden="true" />
            {t('field_records_weather', { defaultValue: 'Weather' })}
          </button>
        </div>

        {currentCycle ? (
          <div className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-xl flex items-start gap-3">
            <Sprout className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{t('ui_crops_overview_tab_growing')}</span>
                <span className="text-xxs font-medium text-slate-500 dark:text-theme-text-muted">
                  {t('ui_crops_overview_tab_planted')} {new Date(currentCycle.plantingDate!).toLocaleDateString(appLocale())}
                </span>
              </div>
              <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary mt-1 truncate">
                {currentCycle.cropName} ({currentCycle.variety || 'Standard'})
              </h4>
              {currentCycle.notes && <p className="text-xs text-slate-600 dark:text-theme-text-muted mt-1 italic line-clamp-1">"{currentCycle.notes}"</p>}
              {currentCycle.pendingSync ? <PendingSyncBadge className="mt-2" /> : <FarmPlanSection cropCycleId={currentCycle.id} />}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-theme-bg-secondary/30 border border-dashed border-slate-200 dark:border-white/10 p-4 rounded-xl text-center py-6">
            <Info className="w-5 h-5 text-slate-400 dark:text-theme-text-muted mx-auto mb-2" />
            <p className="text-xs text-slate-600 dark:text-theme-text-muted font-medium mb-3">{t('ui_crops_overview_tab_no_active_crop_growth_cycles')}</p>
            <button onClick={() => onStartCycle(field)} className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-500/10 border border-primary-500/20 hover:bg-primary-500/20 px-3 py-1.5 rounded-xl transition-all">
              {t('ui_crops_overview_tab_plant_new_crop')}
            </button>
          </div>
        )}
      </div>

      {currentCycle && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-end gap-2">
          <button onClick={() => onHarvest(field, currentCycle)} className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 px-4 py-2 rounded-xl transition-all">
            <CheckCircle className="w-3.5 h-3.5" />
            {t('ui_crops_overview_tab_record_harvest')}
          </button>
        </div>
      )}
    </div>
  );
};
