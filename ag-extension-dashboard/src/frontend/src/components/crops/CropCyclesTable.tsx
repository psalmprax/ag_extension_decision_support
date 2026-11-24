import React from 'react';
import { appLocale } from '@/lib/appLocale';
import { Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Field } from '@/api/fieldService';
import { useLanguage } from '@/lib/LanguageContext';
import { PendingSyncBadge } from '@/components/common/PendingSyncBadge';

interface CropCyclesTableProps {
  fields: Field[];
  handleDeleteCycle: (fieldId: string, cycleId: string) => void;
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    growing: 'bg-primary-500/10 text-primary-700 dark:text-primary-400 border border-primary-500/20',
    harvested: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20',
  };
  return map[status] ?? 'bg-slate-100 text-slate-700 dark:bg-theme-bg-tertiary dark:text-theme-text-muted';
}

function formatHarvestDate(cycle: { actualHarvestDate?: string | null; expectedHarvestDate?: string | null }): string {
  if (cycle.actualHarvestDate) return new Date(cycle.actualHarvestDate).toLocaleDateString(appLocale());
  if (cycle.expectedHarvestDate) return `Est: ${new Date(cycle.expectedHarvestDate).toLocaleDateString(appLocale())}`;
  return 'N/A';
}

function formatYield(yieldKg: number | null | undefined): string {
  if (yieldKg !== undefined && yieldKg !== null) return `${yieldKg.toLocaleString(appLocale())} kg`;
  return 'In Progress';
}

export const CropCyclesTable: React.FC<CropCyclesTableProps> = ({
  fields,
  handleDeleteCycle,
}) => {
  const { t } = useLanguage();
  const allCycles = fields.flatMap(field =>
    (field.cropCycles || []).map(cycle => ({ field, cycle }))
  );

  return (
    <motion.div
      key="cycles-tab"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden"
    >
      {allCycles.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500">
          {t('ui_crop_cycles_table_no_crop_cycles_registered_for_these')}
        </div>
      ) : (
        <>
          {/* Mobile Card Layout */}
          <div className="block md:hidden divide-y divide-slate-200 dark:divide-white/5">
            {allCycles.map(({ field, cycle }) => (
              <div key={cycle.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{cycle.cropName}</h4>
                    {cycle.pendingSync && <PendingSyncBadge className="my-1" />}
                    <p className="text-xs text-slate-500 dark:text-theme-text-muted">
                      {t('ui_crop_cycles_table_sector')} <span className="text-slate-800 dark:text-theme-text-primary font-medium">{field.name}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusClass(
                        cycle.status
                      )}`}
                    >
                      {cycle.status}
                    </span>
                    <button
                      onClick={() => handleDeleteCycle(field.id, cycle.id)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                      title="Delete Cycle Record"
                      aria-label="Delete Cycle Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-theme-bg-primary/40 p-2.5 rounded-lg border border-slate-200 dark:border-white/5">
                  <div>
                    <span className="text-xxs text-slate-500 dark:text-theme-text-muted font-medium block">{t('ui_crop_cycles_table_variety')}</span>
                    <span className="text-slate-700 dark:text-theme-text-secondary font-medium">{cycle.variety || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-xxs text-slate-500 dark:text-theme-text-muted font-medium block">{t('ui_crop_cycles_table_yield_output')}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium font-mono tabular-nums">{formatYield(cycle.yieldKg)}</span>
                  </div>
                  <div>
                    <span className="text-xxs text-slate-500 dark:text-theme-text-muted font-medium block">{t('ui_crop_cycles_table_planting_date')}</span>
                    <span className="text-slate-600 dark:text-theme-text-muted">
                      {cycle.plantingDate ? new Date(cycle.plantingDate).toLocaleDateString(appLocale()) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xxs text-slate-500 dark:text-theme-text-muted font-medium block">{t('ui_crop_cycles_table_projected_harvest')}</span>
                    <span className="text-slate-600 dark:text-theme-text-muted">{formatHarvestDate(cycle)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-start border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-theme-bg-primary/40 text-xs font-medium text-slate-500 dark:text-theme-text-muted">
                  <th className="p-4 ps-6">{t('ui_crop_cycles_table_sector_name')}</th>
                  <th className="p-4">{t('ui_crop_cycles_table_crop_name')}</th>
                  <th className="p-4">{t('ui_crop_cycles_table_variety')}</th>
                  <th className="p-4">{t('ui_crop_cycles_table_growth_phase')}</th>
                  <th className="p-4">{t('ui_crop_cycles_table_planting_date')}</th>
                  <th className="p-4">{t('ui_crop_cycles_table_projected_harvest')}</th>
                  <th className="p-4">{t('ui_crop_cycles_table_yield_output')}</th>
                  <th className="p-4 pe-6 text-end">{t('ui_crop_cycles_table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {allCycles.map(({ field, cycle }) => (
                  <tr key={cycle.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                    <td className="p-4 ps-6 font-medium text-slate-900 dark:text-theme-text-primary">{field.name}</td>
                    <td className="p-4 font-medium text-slate-800 dark:text-theme-text-primary">
                      {cycle.cropName}
                      {cycle.pendingSync && <PendingSyncBadge className="ms-2" />}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-theme-text-muted font-mono text-xs">{cycle.variety || 'N/A'}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${getStatusClass(
                          cycle.status
                        )}`}
                      >
                        {cycle.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-theme-text-muted">
                      {cycle.plantingDate ? new Date(cycle.plantingDate).toLocaleDateString(appLocale()) : 'N/A'}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-theme-text-muted">{formatHarvestDate(cycle)}</td>
                    <td className="p-4 font-mono font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{formatYield(cycle.yieldKg)}</td>
                    <td className="p-4 pe-6 text-end">
                      <button
                        onClick={() => handleDeleteCycle(field.id, cycle.id)}
                        className="p-1.5 hover:bg-slate-200/60 dark:hover:bg-white/5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Delete Cycle Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </motion.div>
  );
};
