import React, { useState } from 'react';
import { Map } from 'lucide-react';
import { motion } from 'framer-motion';
import { Field, CropCycle } from '@/api/fieldService';
import { useLanguage } from '@/lib/LanguageContext';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';
import { FieldCard } from './FieldCard';
import { FieldRecordsDialog, type FieldRecordsTab } from './records/FieldRecordsDialog';

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
  const [records, setRecords] = useState<{ field: Field; tab: FieldRecordsTab } | null>(null);
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
          {fields.map(field => (
            <FieldCard
              key={field.id}
              field={field}
              cardClass={cardClass}
              onEdit={handleOpenEditField}
              onDelete={handleDeleteField}
              onStartCycle={handleOpenStartCycle}
              onHarvest={handleOpenHarvest}
              onOpenRecords={(next, tab) => setRecords({ field: next, tab })}
            />
          ))}
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
      {records && (
        <FieldRecordsDialog
          field={records.field}
          tab={records.tab}
          onTabChange={tab => setRecords(current => (current ? { ...current, tab } : current))}
          onClose={() => setRecords(null)}
        />
      )}
    </motion.div>
  );
};
