import React from 'react';
import { History, Loader2 } from 'lucide-react';
import { getLogContent, getLogTypeColor } from '../farmerLogFormat';


export const HistoryTabContent = ({
  interactions,
  isLoadingHistory,
  radiusClass,
}: {
  interactions: Array<Record<string, unknown>>;
  isLoadingHistory: boolean;
  radiusClass: string;
}) => (
  <section className="space-y-6">
    <div className="flex items-center justify-between">
      <h3
        className={`text-sm font-medium flex items-center gap-2 text-gray-400`}
      >
        <History className={`w-4 h-4 text-primary-500`} />
        Recent Interactions
      </h3>
    </div>
    <div className="space-y-4">
      {isLoadingHistory ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : interactions.length > 0 ? (
        interactions.map((log, i: number) => (
          <div
            key={(log.id as string) || `${log.type}-${i}`}
            className={`p-4 ${radiusClass} border bg-gray-50/50 dark:bg-theme-bg-tertiary/30 border-gray-100 dark:border-white/[0.08]`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${getLogTypeColor(log.type as string)}`}
                >
                  {log.type as string}
                </span>
                <span className="text-xxs text-gray-400">{log.date as string}</span>
              </div>
              <span className="text-xs font-medium text-emerald-500">
                {log.status as string}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-theme-text-secondary leading-relaxed">
              {getLogContent(log)}
            </p>
          </div>
        ))
      ) : (
        <div className="text-center py-10 text-gray-500 text-xs font-normal">
          No interaction history found
        </div>
      )}
    </div>
  </section>
);
