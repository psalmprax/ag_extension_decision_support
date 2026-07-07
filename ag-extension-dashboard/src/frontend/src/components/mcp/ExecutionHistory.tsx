import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import type { ExecutionHistoryEntry } from '@/types/mcp';

export function MCPToolsExecutionHistory({
  history,
  radiusClass,
  t,
}: {
  history: ExecutionHistoryEntry[];
  radiusClass: string;
  t: (key: string) => string;
}) {
  if (history.length === 0) return null;
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        {t('mcp_tools_recent_executions')}
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {history.map((execution, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 ${radiusClass}`}
          >
            <div className="flex items-center gap-3">
              {execution.result?.isError ? (
                <XCircle className="w-5 h-5 text-red-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{execution.tool}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.keys(execution.args).length > 0
                    ? `${Object.keys(execution.args).length} parameters`
                    : 'No parameters'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(execution.timestamp).toLocaleString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
