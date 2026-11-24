import React from 'react';
import { CloudSun, FlaskConical, X } from 'lucide-react';
import type { Field } from '@/api/fieldService';
import { Dialog, DialogTitle } from '@/components/ui/Dialog';
import { TAB_ROW, tabButtonClass } from '@/components/ui/controlStyles';
import { useLanguage } from '@/lib/LanguageContext';
import { uuidSchema } from '@ag-extension/shared/api';
import { SoilTestsPanel } from './SoilTestsPanel';
import { FieldWeatherPanel } from './FieldWeatherPanel';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export type FieldRecordsTab = 'soil' | 'weather';

interface FieldRecordsDialogProps {
  field: Field;
  tab: FieldRecordsTab;
  onTabChange: (tab: FieldRecordsTab) => void;
  onClose: () => void;
}

/** One field's soil tests and weather, in tabs. Demo fields have no saved records. */
export const FieldRecordsDialog: React.FC<FieldRecordsDialogProps> = ({ field, tab, onTabChange, onClose }) => {
  const { t } = useLanguage();
  const saved = uuidSchema.safeParse(field.id).success;
  const online = useOnlineStatus();
  const hasLocation = field.latitude !== null && field.latitude !== undefined && field.longitude !== null && field.longitude !== undefined;
  const tabs: Array<{ id: FieldRecordsTab; label: string; Icon: typeof FlaskConical }> = [
    { id: 'soil', label: t('field_records_soil', { defaultValue: 'Soil tests' }), Icon: FlaskConical },
    { id: 'weather', label: t('field_records_weather', { defaultValue: 'Weather' }), Icon: CloudSun },
  ];

  return (
    <Dialog open onClose={onClose} size="3xl">
      <div className="p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <DialogTitle>{field.name}</DialogTitle>
          <button type="button" onClick={onClose} aria-label={t('common_close', { defaultValue: 'Close' })} className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:text-white/60 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]">
            <X className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className={TAB_ROW} role="tablist">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => onTabChange(id)} className={tabButtonClass(tab === id)}>
              <Icon className="w-4 h-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {!saved ? (
            <p className="py-6 text-sm text-slate-600 dark:text-theme-text-secondary">
              {t('field_records_demo', { defaultValue: 'Demo fields have no saved records. Add a field of your own to record soil tests and see its weather.' })}
            </p>
          ) : tab === 'soil' ? (
            <SoilTestsPanel fieldId={field.id} fieldName={field.name} />
          ) : !online || field.pendingSync ? (
            <p className="py-6 text-sm text-slate-600 dark:text-theme-text-secondary">
              {t('weather_needs_connection', { defaultValue: 'Weather comes from NASA POWER, so it needs a connection, and a new field has to reach the server first.' })}
            </p>
          ) : (
            <FieldWeatherPanel fieldId={field.id} hasLocation={hasLocation} />
          )}
        </div>
      </div>
    </Dialog>
  );
};
