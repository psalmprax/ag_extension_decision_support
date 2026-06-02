/**
 * Shared color class mappings for stat cards and data visualizations.
 * Used across Agents, SystemHealth, Telemetry, Memory, EmailWorkflows, MCPTools.
 */

export const STAT_COLORS: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400' },
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-900/30', icon: 'text-cyan-600 dark:text-cyan-400' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/30', icon: 'text-yellow-600 dark:text-yellow-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-400' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-900/30', icon: 'text-gray-600 dark:text-gray-400' },
};

/**
 * Chart color palette for Recharts visualizations.
 * Semantic names → hex values for dark-mode-aware chart fills.
 */
export const CHART_COLORS = {
    primary: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    muted: '#6b7280',
} as const;
