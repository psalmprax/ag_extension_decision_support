import { useState } from 'react';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { SUPPORTED_COUNTRIES } from '@/lib/countries';
import { uploadGuide } from './guidesApi';

const FIELD =
  'w-full h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600';

/** Adds a local guide to the knowledge base. An officer's upload waits for review. */
export function GuideUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const { t } = useLanguage();
  const user = useAppStore(state => state.user);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [crops, setCrops] = useState('');
  const [country, setCountry] = useState(user?.country ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const { pendingReview } = await uploadGuide({ file, title, crops, country });
      toast.success(pendingReview
        ? t('kb_guide_sent_for_review', { defaultValue: 'Guide added. A manager will review it before it is used in answers.' })
        : t('kb_guide_added', { defaultValue: 'Guide added and ready to use in answers.' }));
      setFile(null);
      setTitle('');
      setCrops('');
      onUploaded();
    } catch {
      toast.error(t('kb_guide_upload_failed', { defaultValue: 'Could not add the guide. Use a PDF, TXT or MD file with readable text.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-label={t('kb_guide_add', { defaultValue: 'Add a guide' })}>
      <label className="text-sm text-slate-700 dark:text-white/80 sm:col-span-2">
        {t('kb_guide_file', { defaultValue: 'File (PDF, TXT or MD)' })}
        <input
          type="file"
          accept=".pdf,.txt,.md"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-slate-700 dark:text-white/80"
        />
      </label>
      <label className="text-sm text-slate-700 dark:text-white/80">
        {t('kb_guide_title', { defaultValue: 'Title' })}
        <input value={title} onChange={event => setTitle(event.target.value)} className={`${FIELD} mt-1`} />
      </label>
      <label className="text-sm text-slate-700 dark:text-white/80">
        {t('kb_guide_crops', { defaultValue: 'Crops, separated by commas' })}
        <input value={crops} onChange={event => setCrops(event.target.value)} className={`${FIELD} mt-1`} />
      </label>
      <label className="text-sm text-slate-700 dark:text-white/80">
        {t('kb_guide_country', { defaultValue: 'Country it was written for' })}
        <select value={country} onChange={event => setCountry(event.target.value)} className={`${FIELD} mt-1`}>
          <option value="">{t('kb_guide_country_mine', { defaultValue: 'My country' })}</option>
          {SUPPORTED_COUNTRIES.filter(c => c.iso2).map(c => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <Button type="submit" variant="primary" disabled={!file || busy} loading={busy}>
          <Upload className="w-4 h-4" aria-hidden="true" />
          {t('kb_guide_add', { defaultValue: 'Add a guide' })}
        </Button>
      </div>
    </form>
  );
}
