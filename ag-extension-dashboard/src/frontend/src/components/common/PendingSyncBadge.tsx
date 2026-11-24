import React from 'react';
import { UploadCloud } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/** Marks a record saved on this device that has not reached the server yet. */
export const PendingSyncBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-600/20 whitespace-nowrap ${className}`}
      title={t('pending_sync_hint', { defaultValue: 'Saved on this device. It is sent when there is a connection.' })}
    >
      <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
      {t('pending_sync_badge', { defaultValue: 'Waiting to sync' })}
    </span>
  );
};
