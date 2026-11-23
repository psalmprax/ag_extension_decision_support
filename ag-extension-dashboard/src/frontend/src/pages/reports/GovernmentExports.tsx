import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { fieldIntelService, type MisDataset } from '@/api/fieldIntelService';
import { SECONDARY_BUTTON } from '@/components/ui/controlStyles';
import { useLanguage } from '@/lib/LanguageContext';
import { saveBlob } from '@/lib/saveBlob';

const DATASETS: Array<{ key: MisDataset; label: string }> = [
  { key: 'farmers', label: 'Farmers CSV' },
  { key: 'visits', label: 'Visits CSV' },
  { key: 'outcomes', label: 'Outcomes CSV' },
];

/**
 * CSV files in the column layout national extension systems import. Each holds only the
 * records the signed-in person may see, with farmers as reference numbers, not names.
 */
export function GovernmentExports({ onError }: { onError: (message: string) => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<MisDataset | null>(null);

  const download = async (dataset: MisDataset) => {
    setBusy(dataset);
    try {
      saveBlob(await fieldIntelService.downloadMisExport(dataset), `gpexts_${dataset}.csv`);
    } catch {
      onError(t('reports_export_failed', { defaultValue: 'The export could not be downloaded. Try again.' }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-labelledby="government-exports"
      className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5"
    >
      <h2 id="government-exports" className="text-base font-medium text-slate-900 dark:text-white">
        {t('reports_exports_title', { defaultValue: 'Exports for government systems' })}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-theme-text-muted max-w-2xl">
        {t('reports_exports_body', {
          defaultValue: 'CSV files in the layout national extension systems import. They hold only the farmers you can see, by reference number rather than name.',
        })}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {DATASETS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => download(key)} disabled={busy !== null} className={SECONDARY_BUTTON}>
            {busy === key ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
            {t(`reports_export_${key}`, { defaultValue: label })}
          </button>
        ))}
      </div>
    </section>
  );
}
