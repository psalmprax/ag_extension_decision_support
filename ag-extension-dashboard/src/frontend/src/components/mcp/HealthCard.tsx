import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { MCPHealth } from '@/types/mcp';

export function MCPToolsHealthCard({
    health,
    t,
}: {
    health: MCPHealth;
    t: (key: string) => string;
}) {
    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('mcp_tools_server_status')}</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    health.status === 'healthy'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                }`}>
                    {health.status === 'healthy' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                    {health.status}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{health.toolsAvailable}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tools Available</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{health.protocol}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Protocol Version</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{health.version}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Server Version</div>
                </div>
            </div>
        </div>
    );
}
