import React from 'react';
import { BookOpen, MessageSquare, Save } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { KnowledgeSearchStats } from '@/api/knowledgeService';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { RankedBars, type RankedBarRow } from '@/components/charts/RankedBars';
import { formatNumber } from '@/components/charts/chartFormat';
import { formatLabel } from '@/lib/formatLabel';

interface KnowledgeStatsProps {
  data: KnowledgeSearchStats;
}

function toRows<T>(items: T[] | undefined, labelOf: (item: T) => string | null, countOf: (item: T) => string | number): RankedBarRow[] {
  return (items ?? [])
    .map(item => ({ label: formatLabel(labelOf(item) ?? ''), value: Number(countOf(item)) || 0 }))
    .filter(row => row.label !== '');
}

const Tile: React.FC<{ label: string; value: string; icon: typeof MessageSquare }> = ({ label, value, icon: Icon }) => (
  <div className="flex items-center gap-4 rounded-lg border border-slate-900/[0.08] bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
    <Icon className="h-[18px] w-[18px] text-slate-500 dark:text-theme-text-muted" strokeWidth={1.5} aria-hidden="true" />
    <div>
      <p className="text-xs text-slate-600 dark:text-theme-text-muted">{label}</p>
      <p className="text-2xl font-medium text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

/** What farmers and officers ask the knowledge base about, from the search log. */
export const KnowledgeStats: React.FC<KnowledgeStatsProps> = ({ data }) => {
  const { t } = useLanguage();
  const crops = toRows(data.crops, item => item.crop, item => item.count);
  const topics = toRows(data.categories, item => item.category, item => item.count);
  const questions = (value: number) => formatNumber(value, 0);
  const articles =
    data.totalArticles !== undefined
      ? t('knowledge_stats_articles_value', {
          defaultValue: '{embedded} of {total}',
          embedded: formatNumber(data.embeddedArticles ?? 0, 0),
          total: formatNumber(data.totalArticles, 0),
        })
      : '—';

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Tile label={t('knowledge_stats_questions', { defaultValue: 'Questions asked' })} value={formatNumber(data.totalQueries ?? 0, 0)} icon={MessageSquare} />
        <Tile label={t('knowledge_stats_saved_answers', { defaultValue: 'Saved answers' })} value={formatNumber(data.cachedQueries ?? 0, 0)} icon={Save} />
        <Tile label={t('knowledge_stats_articles', { defaultValue: 'Articles searchable' })} value={articles} icon={BookOpen} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ChartFrame
          title={t('ui_knowledge_stats_trending_crop_queries', { defaultValue: 'Most asked-about crops' })}
          description={t('knowledge_stats_crops_desc', { defaultValue: 'Questions per crop, top five.' })}
          isEmpty={crops.length === 0}
          empty={{ title: t('knowledge_stats_crops_empty', { defaultValue: 'No questions about a crop yet' }) }}
        >
          <RankedBars rows={crops} label={t('ui_knowledge_stats_trending_crop_queries', { defaultValue: 'Most asked-about crops' })} formatValue={questions} />
        </ChartFrame>
        <ChartFrame
          title={t('ui_knowledge_stats_category_distribution', { defaultValue: 'Questions by topic' })}
          description={t('knowledge_stats_topics_desc', { defaultValue: 'Questions per topic, top five.' })}
          isEmpty={topics.length === 0}
          empty={{ title: t('knowledge_stats_topics_empty', { defaultValue: 'No questions with a topic yet' }) }}
        >
          <RankedBars rows={topics} label={t('ui_knowledge_stats_category_distribution', { defaultValue: 'Questions by topic' })} formatValue={questions} />
        </ChartFrame>
      </div>
    </div>
  );
};
