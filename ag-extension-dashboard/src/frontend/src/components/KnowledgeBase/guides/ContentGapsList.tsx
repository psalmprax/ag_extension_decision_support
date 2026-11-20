import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { fetchContentGaps, type ContentGapGroup } from './guidesApi';

/**
 * What people asked that no vetted guide answered, so the next guides to license or write
 * are the ones farmers need. Grouped by crop and country; the recurring words hint at topics.
 */
export function ContentGapsList() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<ContentGapGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchContentGaps().then(setGroups).catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="text-sm text-red-700 dark:text-red-300">{t('kb_gaps_failed', { defaultValue: 'Could not load the questions without a guide.' })}</p>;
  if (!groups) return <p className="text-sm text-slate-500 dark:text-white/60">{t('kb_gaps_loading', { defaultValue: 'Loading questions without a guide…' })}</p>;
  if (groups.length === 0) return <p className="text-sm text-slate-500 dark:text-white/60">{t('kb_gaps_none', { defaultValue: 'Every question in the last 90 days had a vetted guide behind its answer.' })}</p>;

  return (
    <ul className="space-y-3">
      {groups.slice(0, 10).map(group => (
        <li key={`${group.crop}|${group.country}`} className="text-sm">
          <p className="text-slate-900 dark:text-white">
            <span className="capitalize">{group.crop ?? t('kb_gaps_no_crop', { defaultValue: 'No crop given' })}</span>
            {group.country ? `, ${group.country}` : ''}
            <span className="text-slate-500 tabular-nums"> {t('kb_gaps_count', { count: group.questions, defaultValue: '({count} questions)' })}</span>
          </p>
          {group.topWords.length > 0 && (
            <p className="text-xs text-slate-600 dark:text-white/70">
              {t('kb_gaps_words', { defaultValue: 'Often mentioned:' })} {group.topWords.map(item => `${item.word} (${item.count})`).join(', ')}
            </p>
          )}
          <ul className="mt-1 ps-4 list-disc text-xs text-slate-500 dark:text-white/60">
            {group.examples.slice(0, 3).map(example => <li key={example}>{example}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}
