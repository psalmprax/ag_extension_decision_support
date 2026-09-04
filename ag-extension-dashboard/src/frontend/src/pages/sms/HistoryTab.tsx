import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import type { SMSMessage } from './types';

export function SMSComposerHistoryTab({
  history,
  radiusClass,
}: {
  history: SMSMessage[];
  radiusClass: string;
}) {
  const { t } = useLanguage();
  return (
    <motion.div
      key="history"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Clock className="w-12 h-12 mb-4 opacity-20" />
          <p>{t('common_no_data')}</p>
        </div>
      ) : (
        history.map(msg => (
          <div
            key={msg.id}
            className={`p-4 bg-slate-50 dark:bg-slate-800/50 ${radiusClass} border border-slate-100 dark:border-slate-800 flex items-start justify-between`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`mt-1 p-2 rounded-lg ${msg.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}
              >
                {msg.status === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{msg.to}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {msg.message}
                </p>
                <span className="text-xxs uppercase font-bold text-slate-400 mt-2 inline-block">
                  {msg.timestamp.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
}
