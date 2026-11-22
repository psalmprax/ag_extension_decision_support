import { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import type { ThreadHistory } from './threadProps';

/** At the top of a thread: loads the page of messages before the oldest one shown. */
export function EarlierMessagesButton({ history }: { history: ThreadHistory }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  if (!history.hasEarlier) return null;
  const load = async () => {
    setLoading(true);
    try {
      await history.loadEarlier();
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex justify-center">
      <button type="button" disabled={loading} onClick={() => { void load(); }}
        className="h-8 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] text-xs text-slate-700 dark:text-white/70 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-60">
        {loading ? t('chat_loading_earlier', { defaultValue: 'Loading earlier messages…' }) : t('chat_show_earlier', { defaultValue: 'Show earlier messages' })}
      </button>
    </div>
  );
}
