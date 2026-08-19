import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wrench, Play, CheckCircle, Terminal } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { fetchMCPTools, callMCPTool, fetchMCPHealth, type MCPTool } from '../api/mcpService';
import { MetricCard } from '@/components/MetricCard';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';

import { MCPToolsHealthCard } from '@/components/mcp/HealthCard';
import { MCPToolsToolListSidebar } from '@/components/mcp/ToolListSidebar';
import { MCPToolsToolExecutionForm } from '@/components/mcp/ToolExecutionForm';
import { MCPToolsExecutionHistory } from '@/components/mcp/ExecutionHistory';
import type { MCPHealth, ExecutionResult, ExecutionHistoryEntry, InputSchema } from '@/types/mcp';

const HISTORY_LIMIT = 10; // Number of past executions retained in the in-memory history.

// Sensible default values per schema introspection, used when the user selects a tool.
function getDefaultArgs(tool: MCPTool): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  if (!tool.inputSchema.properties) return defaults;

  for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
    const schemaTyped = schema as InputSchema;
    if (key === 'location') {
      defaults[key] = 'Kampala, Uganda';
    } else if (key === 'days' && schemaTyped.type === 'number') {
      defaults[key] = 3;
    } else if (key === 'limit' && schemaTyped.type === 'number') {
      defaults[key] = 10;
    } else if (key === 'crop' || key === 'cropName') {
      defaults[key] = 'Maize';
    } else if (key === 'region') {
      defaults[key] = 'Central Region';
    }
  }
  return defaults;
}

export function MCPTools() {
  const { t } = useLanguage();
  const { headingClass, radiusClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();

  // State
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [health, setHealth] = useState<MCPHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, unknown>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryEntry[]>([]);

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        const [toolsRes, healthRes] = await Promise.all([fetchMCPTools(), fetchMCPHealth()]);

        if (toolsRes.success) setTools(toolsRes.data);
        if (healthRes.success) setHealth(healthRes.data);
      } catch (error) {
        console.error('Failed to load MCP data:', error);
        addNotification({
          type: 'error',
          message: t('mcp_tools_failed_load'),
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [addNotification, t]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => loadData(true);

  const handleSelectTool = (tool: MCPTool) => {
    setSelectedTool(tool);
    setToolArgs(getDefaultArgs(tool));
    setExecutionResult(null);
  };

  const handleExecuteTool = async () => {
    if (!selectedTool) return;

    // Validate required parameters
    const required = selectedTool.inputSchema.required || [];
    const missing = required.filter(param => {
      const value = toolArgs[param];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      addNotification({
        type: 'error',
        message: `Please fill in the required parameters: ${missing.join(', ')}`,
      });
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const argsToSend = Object.keys(toolArgs).length > 0 ? toolArgs : undefined;
      const res = await callMCPTool(selectedTool.name, argsToSend);
      if (res.success) {
        setExecutionResult(res.data);
        setExecutionHistory(prev => [
          {
            tool: selectedTool.name,
            args: toolArgs,
            result: res.data,
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, HISTORY_LIMIT - 1),
        ]);

        if (res.data.isError) {
          addNotification({ type: 'error', message: t('mcp_tools_execution_failed') });
        } else {
          addNotification({ type: 'success', message: t('mcp_tools_executed_success') });
        }
      } else {
        addNotification({ type: 'error', message: 'Failed to execute tool' });
      }
    } catch (error) {
      console.error('Tool execution error:', error);
      addNotification({ type: 'error', message: 'Failed to execute tool' });
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingHeaderSkeleton
        title="MCP Tools Browser"
        description="Explore and execute Model Context Protocol tools"
      />
    );
  }

  const executionsToday = executionHistory.filter(
    h => new Date(h.timestamp).toDateString() === new Date().toDateString()
  ).length;
  const successCount = executionHistory.filter(h => !h.result?.isError).length;
  const successRate =
    executionHistory.length > 0
      ? `${Math.round((successCount / executionHistory.length) * 100)}%`
      : '100%';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl ${headingClass}`}>System Tools</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('mcp_tools_subtitle')}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {health && <MCPToolsHealthCard health={health} t={t} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title={t('mcp_tools_available_tools')}
          value={tools.length}
          icon={Wrench}
          color="blue"
        />
        <MetricCard
          title={t('mcp_tools_executed_today')}
          value={executionsToday}
          icon={Play}
          color="green"
        />
        <MetricCard
          title={t('mcp_tools_success_rate')}
          value={successRate}
          icon={CheckCircle}
          color="purple"
        />
        <MetricCard
          title={t('mcp_tools_total_executions')}
          value={executionHistory.length}
          icon={Terminal}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MCPToolsToolListSidebar
          tools={tools}
          selectedTool={selectedTool}
          onSelect={handleSelectTool}
          radiusClass={radiusClass}
          t={t}
        />

        {selectedTool ? (
          <MCPToolsToolExecutionForm
            tool={selectedTool}
            args={toolArgs}
            isExecuting={isExecuting}
            executionResult={executionResult}
            onArgsChange={setToolArgs}
            onExecute={handleExecuteTool}
            t={t}
            radiusClass={radiusClass}
            btnClass={btnClass}
          />
        ) : (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t('mcp_tools_tool_execution')}
            </h3>
            <div className="text-center py-12">
              <Wrench className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Select a Tool
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose a tool from the list to execute
              </p>
            </div>
          </div>
        )}
      </div>

      <MCPToolsExecutionHistory history={executionHistory} radiusClass={radiusClass} t={t} />
    </div>
  );
}

export default MCPTools;
