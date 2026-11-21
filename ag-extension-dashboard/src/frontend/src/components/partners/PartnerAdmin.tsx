import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getApiErrorMessage } from '@/lib/apiError';
import { addPartner, importLibrary, listOrganisations, listPartners, setGrant, type ContentPartner, type ImportReport } from './partnersApi';

const LABEL = 'block text-xs font-medium text-slate-700 dark:text-white/70 mb-1';

/** Import one zip into a partner's library and show what was skipped, and why. */
function ImportForm({ partner, columns, maxMb, onImported }: { partner: ContentPartner; columns: string[]; maxMb: number; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importLibrary(partner.id, file);
      setReport(result);
      toast.success(`Imported ${result.imported} recording${result.imported === 1 ? '' : 's'}. Transcription runs in the background.`);
      onImported();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not import the archive.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600 dark:text-white/60">
        A zip (up to {maxMb} MB) with the audio files and a <code>manifest.csv</code> with the columns{' '}
        {columns.map((column, index) => <span key={column}><code>{column}</code>{index < columns.length - 1 ? ', ' : ''}</span>)}.
        Separate several crops or regions with a semicolon. Rows without a speaker, licence or consent are not imported.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".zip,application/zip" aria-label={`Archive for ${partner.name}`} onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        <Button size="sm" disabled={!file || busy} onClick={() => void run()}>{busy ? 'Importing…' : 'Import'}</Button>
      </div>
      {report && report.skipped.length > 0 && (
        <details className="text-xs text-slate-700 dark:text-white/70">
          <summary>{report.skipped.length} file{report.skipped.length === 1 ? '' : 's'} not imported</summary>
          <ul className="mt-1 space-y-0.5">{report.skipped.map(s => <li key={s.file}><code>{s.file}</code>: {s.reason}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

/** System administrator: add partners, choose which organisations may use each library, import recordings. */
export function PartnerAdmin({ onChanged }: { onChanged: () => void }) {
  const [partners, setPartners] = useState<ContentPartner[] | null>(null);
  const [meta, setMeta] = useState({ columns: [] as string[], maxMb: 300 });
  const [organisations, setOrganisations] = useState<Array<{ id: string; name: string }>>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', website: '', contactEmail: '' });

  const load = useCallback(async () => {
    try {
      const [list, orgs] = await Promise.all([listPartners(), listOrganisations()]);
      setPartners(list.partners);
      setMeta({ columns: list.manifestColumns, maxMb: list.maxArchiveMb });
      setOrganisations(orgs);
      setFailed(null);
    } catch (error) {
      setFailed(getApiErrorMessage(error, 'Could not load content partners.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    try {
      await addPartner(form);
      setForm({ name: '', website: '', contactEmail: '' });
      toast.success('Partner added. Choose which organisations may use its library.');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not add the partner.'));
    }
  };

  const toggle = async (partner: ContentPartner, organisation: { id: string; name: string }, granted: boolean) => {
    try {
      await setGrant(partner.id, organisation.id, granted);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not change who may use the library.'));
    }
  };

  if (failed) return <p className="text-sm text-red-700 dark:text-red-300" role="alert">{failed}</p>;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-2">
        <div><label className={LABEL} htmlFor="partner-name">Partner name</label><Input id="partner-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className={LABEL} htmlFor="partner-site">Website</label><Input id="partner-site" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" /></div>
        <div><label className={LABEL} htmlFor="partner-email">Contact email</label><Input id="partner-email" type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
      </div>
      <Button size="sm" disabled={form.name.trim().length < 2} onClick={() => void add()}>Add partner</Button>
      {!partners && <p className="text-sm text-slate-500 dark:text-white/60">Loading partners…</p>}
      {partners?.length === 0 && <p className="text-sm text-slate-500 dark:text-white/60">No content partners yet.</p>}
      <ul className="divide-y divide-slate-900/[0.08] dark:divide-white/[0.08]">
        {partners?.map(partner => (
          <li key={partner.id} className="py-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{partner.name}</p>
              <p className="text-xs text-slate-600 dark:text-white/60 tabular-nums">{partner.recordings} recordings, {partner.approved} approved</p>
            </div>
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-slate-700 dark:text-white/70">Organisations that may use this library</legend>
              {organisations.map(organisation => (
                <label key={organisation.id} className="flex items-center gap-2 text-sm text-slate-800 dark:text-white/80">
                  <input type="checkbox" className="w-4 h-4" checked={partner.organisations.includes(organisation.name)}
                    onChange={e => void toggle(partner, organisation, e.target.checked)} />
                  {organisation.name}
                </label>
              ))}
            </fieldset>
            <ImportForm partner={partner} columns={meta.columns} maxMb={meta.maxMb} onImported={() => { void load(); onChanged(); }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
