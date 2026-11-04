import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, BarChart3 } from 'lucide-react';
import type { SMSMessage } from './types';
import { getQuotaPercent } from './quota';

export function QuotaSummary({ quota, isLoadingQuota, radiusClass }: { quota: { current: number; limit: number }; isLoadingQuota: boolean; radiusClass: string }) {
  const usedPercent = getQuotaPercent(quota.current, quota.limit);
  return <div className={`p-4 bg-slate-100/50 dark:bg-slate-800/50 ${radiusClass}`}>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
        {isLoadingQuota ? <Loader2 className="w-8 h-8 animate-spin inline" /> : quota.limit > 0 ? quota.current.toLocaleString() : '—'}
      </span>
      <span className="text-sm font-medium font-mono tabular-nums text-slate-500">{quota.limit > 0 ? `/ ${quota.limit.toLocaleString()}` : 'Quota unavailable'}</span>
    </div>
    <div className="h-2 w-full mt-4 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${usedPercent}%` }} className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full" />
    </div>
  </div>;
}

export function MessageStats({ history, t, radiusClass }: { history: SMSMessage[]; t: (key: string) => string; radiusClass: string }) {
  const sent = history.filter(message => message.status === 'success').length;
  const failed = history.filter(message => message.status === 'failed').length;
  return <div className={`p-4 bg-slate-100/50 dark:bg-slate-800/50 ${radiusClass}`}>
    <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('sms_stats_title')}</span><BarChart3 className="w-4 h-4 text-slate-500 dark:text-slate-400" /></div>
    <div className="grid grid-cols-2 gap-4"><div><p className="text-xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{sent}</p><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('sms_stats_sent')}</p></div><div><p className="text-xl font-semibold font-mono tabular-nums text-rose-600 dark:text-rose-400">{failed}</p><p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('sms_stats_failed')}</p></div></div>
  </div>;
}

export function TemplateList({ templates, applyTemplate, radiusClass }: { templates: { id: string; title: string; content: string; icon: React.ElementType; color: string }[]; applyTemplate: (content: string) => void; radiusClass: string }) {
  return <div className="space-y-3">{templates.map(tpl => <button key={tpl.id} onClick={() => applyTemplate(tpl.content)} className={`w-full group p-3 text-left border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 ${radiusClass} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-[0.98]`}><div className="flex items-center gap-3 mb-1.5"><div className={`p-1.5 rounded-lg ${tpl.color}`}><tpl.icon className="w-4 h-4" /></div><span className="text-sm font-medium text-slate-800 dark:text-slate-200">{tpl.title}</span></div><p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed italic">"{tpl.content}"</p></button>)}</div>;
}
