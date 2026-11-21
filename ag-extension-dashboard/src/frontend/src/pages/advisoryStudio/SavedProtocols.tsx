import React from 'react';
import { FileText } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useSavedProtocols, type SavedProtocol } from './savedProtocols';

/** The list in the side panel: open a saved protocol to keep working on it. */
export const SavedProtocols: React.FC<{ activeId: string | null; onOpen: (protocol: SavedProtocol) => void }> = ({ activeId, onOpen }) => {
  const { t } = useLanguage();
  const { data: protocols = [], isLoading, isError } = useSavedProtocols();
  return (
    <section aria-labelledby="saved-protocols-heading">
      <h3 id="saved-protocols-heading" className="text-sm font-medium text-slate-900 dark:text-white mb-2">
        {t('advisory_saved_title', { defaultValue: 'Saved protocols' })}
      </h3>
      {isLoading ? null : isError ? (
        <p className="text-sm text-slate-500 dark:text-white/60">{t('advisory_saved_error', { defaultValue: 'Saved protocols could not be loaded.' })}</p>
      ) : protocols.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-white/60">{t('advisory_saved_none', { defaultValue: 'Nothing saved yet. Save a draft to keep it here.' })}</p>
      ) : (
        <ul className="space-y-1">
          {protocols.map(protocol => (
            <li key={protocol.id}>
              <button
                type="button"
                onClick={() => onOpen(protocol)}
                aria-current={protocol.id === activeId ? 'true' : undefined}
                className={`w-full text-start px-2.5 py-2 rounded-md text-sm flex items-start gap-2 ${
                  protocol.id === activeId
                    ? 'bg-emerald-50 dark:bg-emerald-400/[0.1] text-emerald-900 dark:text-emerald-100'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05]'
                }`}
              >
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate">{protocol.title}</span>
                  <span className="block text-xs text-slate-500 dark:text-white/50">
                    {protocol.status === 'published'
                      ? t('advisory_status_published', { version: protocol.version, defaultValue: 'Published, version {version}' })
                      : t('advisory_status_draft', { defaultValue: 'Draft' })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
