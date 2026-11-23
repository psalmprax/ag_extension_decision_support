import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Copy, Link2 } from 'lucide-react';
import { checkAuditChain, type AuditChainCheck } from '@/api/auditService';
import { useLanguage } from '@/lib/LanguageContext';
import { getApiErrorMessage } from '@/lib/apiError';
import { SECONDARY_BUTTON } from '@/components/ui/controlStyles';
import { formatNumber } from '@/components/charts/chartFormat';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Verdict({ check }: { check: AuditChainCheck }) {
  const { t } = useLanguage();
  if (check.status === 'empty') {
    return <p className="text-sm text-slate-700 dark:text-theme-text-secondary">{t('audit_chain_empty', { defaultValue: 'No entries are chained yet. The next audited action starts the chain.' })}</p>;
  }
  if (check.status === 'intact') {
    return (
      <p className="flex items-start gap-2 text-sm text-slate-800 dark:text-theme-text-primary">
        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        {t('audit_chain_intact', { defaultValue: 'Intact: all {count} entries since {date} match their hashes and links.', count: formatNumber(check.checkedEntries, 0), date: check.firstChainedAt ? when(check.firstChainedAt) : '—' })}
      </p>
    );
  }
  const problem = check.problem!;
  return (
    <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200" role="alert">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      {problem.kind === 'missing'
        ? t('audit_chain_missing', { defaultValue: 'Broken: entries are missing just before entry {seq} ({date}).', seq: formatNumber(problem.seq, 0), date: when(problem.at) })
        : t('audit_chain_changed', { defaultValue: 'Broken: entry {seq} ({date}), or the one just before it, was changed after it was written.', seq: formatNumber(problem.seq, 0), date: when(problem.at) })}
    </p>
  );
}

/**
 * Checks the audit log's hash chain on demand. A changed entry, or entries removed from the
 * middle or start, break the chain. The newest hash is shown so an administrator can note it
 * elsewhere: a later chain without it was rewritten or cut short.
 */
export const AuditIntegrityPanel: React.FC = () => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const { data, error, isFetching, refetch } = useQuery({ queryKey: ['audit-chain-check'], queryFn: checkAuditChain, enabled: false, retry: false });

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
    } catch (copyError) {
      console.error('Could not copy the audit hash:', copyError);
    }
  };

  return (
    <section aria-labelledby="audit-chain-title" className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 id="audit-chain-title" className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
            {t('audit_chain_title', { defaultValue: 'Audit log integrity' })}
          </h3>
          <p className="text-xs text-slate-600 dark:text-theme-text-muted max-w-prose">
            {t('audit_chain_explainer', { defaultValue: 'Each audit entry stores a hash of itself and of the entry before it, so an entry that is later changed or removed shows up here.' })}
          </p>
        </div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className={SECONDARY_BUTTON}>
          {isFetching ? t('audit_chain_checking', { defaultValue: 'Checking…' }) : t('audit_chain_check', { defaultValue: 'Check the audit log' })}
        </button>
      </div>

      {error && <p className="text-sm text-red-800 dark:text-red-200" role="alert">{getApiErrorMessage(error, t('audit_chain_failed', { defaultValue: 'The check could not run. Try again.' }))}</p>}

      {data && (
        <div className="space-y-3">
          <Verdict check={data} />
          {data.unchainedEntries > 0 && (
            <p className="text-xs text-slate-600 dark:text-theme-text-muted">
              {t('audit_chain_unchained', { defaultValue: '{count} older entries were written before the chain began and cannot be checked.', count: formatNumber(data.unchainedEntries, 0) })}
            </p>
          )}
          {data.head && (
            <div className="rounded-md border border-slate-900/[0.08] dark:border-white/[0.08] p-3 space-y-2">
              <p className="text-xs text-slate-600 dark:text-theme-text-muted">
                {t('audit_chain_head', { defaultValue: 'Newest hash (entry {seq}, {date}). Keep a copy outside this system: if a later check shows a chain that does not contain it, the log was rewritten or its newest entries removed.', seq: formatNumber(data.head.seq, 0), date: when(data.head.at) })}
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 break-all text-xs text-slate-800 dark:text-theme-text-primary">{data.head.hash}</code>
                <button type="button" onClick={() => void copyHash(data.head!.hash)} aria-label={t('audit_chain_copy', { defaultValue: 'Copy the newest hash' })} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]">
                  <Copy className="w-4 h-4" aria-hidden="true" />
                </button>
                {copied && <span className="text-xs text-slate-600 dark:text-theme-text-muted" role="status">{t('common_copied', { defaultValue: 'Copied' })}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
