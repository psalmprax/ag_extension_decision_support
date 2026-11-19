import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, History, Loader2 } from 'lucide-react';
import { getDiagnosisHistory, type DiagnosisHistoryEntry } from '@/api/diseaseService';

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatSource = (source: string) => source.replace(/_/g, ' ');

const HistoryRow = ({ entry }: { entry: DiagnosisHistoryEntry }) => (
  <li className="py-3 flex items-start justify-between gap-4">
    <div className="min-w-0">
      <p className="text-xs font-medium text-white truncate">{entry.diseaseLabel}</p>
      <p className="text-xxs text-slate-400 mt-0.5">
        {[entry.crop, entry.district].filter(Boolean).join(' · ') || 'Location not recorded'}
        {entry.source ? ` · ${formatSource(entry.source)}` : ''}
      </p>
    </div>
    <div className="text-right shrink-0">
      <p className="text-xs font-mono tabular-nums text-emerald-400">
        {entry.confidence === null ? 'n/a' : `${(entry.confidence * 100).toFixed(1)}%`}
      </p>
      <p className="text-xxs text-slate-500 font-mono tabular-nums mt-0.5">{formatWhen(entry.createdAt)}</p>
    </div>
  </li>
);

/**
 * The caller's own diagnosis history: what was concluded, on which crop, and
 * with what match strength. Rows are written server-side on every diagnosis,
 * so this panel never needs its own write path.
 */
export function DiagnosisHistoryPanel() {
  const { data: entries, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai', 'diseases', 'history'],
    queryFn: async () => {
      const res = await getDiagnosisHistory(20);
      return res.success ? res.data.items : [];
    },
  });

  return (
    <section className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          Your recent diagnoses
        </h2>
        {!!entries?.length && (
          <span className="text-xxs font-mono tabular-nums text-slate-400">
            {entries.length} recorded
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : isError ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs text-rose-300 flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Diagnosis history could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : !entries?.length ? (
        <p className="py-6 text-xs text-slate-400">
          No diagnoses recorded yet. A symptom or image analysis you run will be listed here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {entries.map(entry => (
            <HistoryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
