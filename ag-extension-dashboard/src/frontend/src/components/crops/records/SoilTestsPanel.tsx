import React, { useState } from 'react';
import { appLocale } from '@/lib/appLocale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { fieldRecordsService, type SoilTest, type SoilTestInput } from '@/api/fieldRecordsService';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { getApiErrorMessage } from '@/lib/apiError';
import { SECONDARY_BUTTON } from '@/components/ui/controlStyles';
import { formatNumber } from '@/components/charts/chartFormat';
import { SoilCarbonChart } from './SoilCarbonChart';
import { SoilTestForm } from './SoilTestForm';

const formatDate = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const value = (n: number | null, suffix = '') => (n === null ? '—' : `${formatNumber(n, 2)}${suffix}`);

/** A field's soil test results: the organic carbon trend, every result, and a form to add one. */
export const SoilTestsPanel: React.FC<{ fieldId: string; fieldName: string }> = ({ fieldId, fieldName }) => {
  const { t } = useLanguage();
  const notify = useAppStore(state => state.addNotification);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const queryKey = ['field-soil-tests', fieldId];
  const { data: tests = [], isLoading, isError } = useQuery({ queryKey, queryFn: () => fieldRecordsService.soilTests(fieldId) });

  const add = useMutation({
    mutationFn: (input: SoilTestInput) => fieldRecordsService.addSoilTest(fieldId, input),
    onSuccess: () => {
      setAdding(false);
      notify({ type: 'success', message: t('soil_test_saved', { defaultValue: 'Soil test saved' }) });
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: error => notify({ type: 'error', message: getApiErrorMessage(error, t('soil_test_save_failed', { defaultValue: 'The soil test was not saved. Try again.' })) }),
  });
  const remove = useMutation({
    mutationFn: (test: SoilTest) => fieldRecordsService.deleteSoilTest(fieldId, test.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: error => notify({ type: 'error', message: getApiErrorMessage(error, t('soil_test_delete_failed', { defaultValue: 'The soil test was not deleted. Try again.' })) }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10" role="status">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" aria-label={t('loading', { defaultValue: 'Loading' })} />
      </div>
    );
  }
  if (isError) {
    return <p className="py-6 text-sm text-slate-600 dark:text-theme-text-secondary">{t('soil_tests_unavailable', { defaultValue: 'Soil tests could not be loaded. Try again in a moment.' })}</p>;
  }

  return (
    <div className="space-y-4">
      <SoilCarbonChart tests={tests} />

      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
          {t('soil_tests_all', { defaultValue: 'All results ({count})', count: tests.length })}
        </h4>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={SECONDARY_BUTTON}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t('soil_test_add', { defaultValue: 'Add a lab result' })}
          </button>
        )}
      </div>

      {adding && <SoilTestForm saving={add.isPending} onSave={input => add.mutate(input)} onCancel={() => setAdding(false)} />}

      {tests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('soil_tests_caption', { defaultValue: 'Soil test results for {field}', field: fieldName })}</caption>
            <thead>
              <tr className="border-b border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-500 dark:text-theme-text-muted">
                <th className="py-2 pe-3 text-start font-normal">{t('soil_test_date', { defaultValue: 'Tested' })}</th>
                <th className="py-2 pe-3 text-start font-normal">{t('soil_test_lab', { defaultValue: 'Lab' })}</th>
                <th className="py-2 pe-3 text-end font-normal">pH</th>
                <th className="py-2 pe-3 text-end font-normal">{t('soil_organic_carbon_short', { defaultValue: 'Org. carbon' })}</th>
                <th className="py-2 pe-3 text-end font-normal">{t('soil_organic_matter_short', { defaultValue: 'Org. matter' })}</th>
                <th className="py-2 pe-3 text-end font-normal">{t('soil_npk_ppm', { defaultValue: 'N / P / K (ppm)' })}</th>
                <th className="py-2"><span className="sr-only">{t('common_actions', { defaultValue: 'Actions' })}</span></th>
              </tr>
            </thead>
            <tbody>
              {tests.toReversed().map(test => (
                <tr key={test.id} className="border-b border-slate-900/[0.06] dark:border-white/[0.06] text-slate-800 dark:text-theme-text-primary">
                  <td className="py-2 pe-3 whitespace-nowrap">{formatDate(test.testedAt)}</td>
                  <td className="py-2 pe-3">{test.labName || '—'}</td>
                  <td className="py-2 pe-3 text-end tabular-nums">{value(test.ph)}</td>
                  <td className="py-2 pe-3 text-end tabular-nums">{value(test.organicCarbonPct, '%')}</td>
                  <td className="py-2 pe-3 text-end tabular-nums">{value(test.organicMatterPct, '%')}</td>
                  <td className="py-2 pe-3 text-end tabular-nums whitespace-nowrap">{`${value(test.nitrogenPpm)} / ${value(test.phosphorusPpm)} / ${value(test.potassiumPpm)}`}</td>
                  <td className="py-2 text-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('soil_test_delete_confirm', { defaultValue: 'Delete the soil test from {date}?', date: formatDate(test.testedAt) }))) remove.mutate(test);
                      }}
                      disabled={remove.isPending}
                      aria-label={t('soil_test_delete', { defaultValue: 'Delete the result from {date}', date: formatDate(test.testedAt) })}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
