import React, { useState, useEffect, useCallback } from 'react';
import { appLocale } from '@/lib/appLocale';
import { QueueStats } from './agents/QueueStats';
import {
  Server,
  RefreshCw,
  Send,
  Zap,
  Radio,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import {
  fetchAgentStatus,
  fetchQueueStatus,
  fetchHandoffLog,
  dispatchTask,
  AgentStatus,
  QueueStatus,
} from '../api/agentService';
import toast from 'react-hot-toast';
import { AgentActivityPanels } from './agents/AgentActivityPanels';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';

function Agents() {
  const { t } = useLanguage();
  const { headingClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();

  // State
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [handoffLog, setHandoffLog] = useState<
    Array<{ from: string; to: string; taskId: string; reason: string; timestamp: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDispatching, setIsDispatching] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        const [agentsResponse, queueResponse, handoffResponse] = await Promise.all([
          fetchAgentStatus(),
          fetchQueueStatus(),
          fetchHandoffLog(),
        ]);

        setAgents(agentsResponse.data);
        setQueueStatus(queueResponse.data);
        setHandoffLog(handoffResponse.data);
      } catch (error) {
        console.error('Failed to load agent data:', error);
        setAgents([]);
        setQueueStatus(null);
        setHandoffLog([]);
        addNotification({
          type: 'error',
          message: t('agents_failed_load') || 'Failed to load agent orchestration status',
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
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleDispatch = async (agentId: string) => {
    setIsDispatching(agentId);
    try {
      const res = await dispatchTask({
        type: 'health-check',
        payload: { targetAgent: agentId },
        priority: 'normal',
        agentId,
      });

      if (res.success) {
        toast.success(`Task dispatched successfully to ${agentId}`);
        loadData(true);
      } else {
        toast.error('Dispatch failed');
      }
    } catch (err) {
      console.error('Dispatch error:', err);
      toast.error('Failed to dispatch task');
    } finally {
      setIsDispatching(null);
    }
  };

  if (isLoading) {
    return (
      <LoadingHeaderSkeleton
        title="Agent Orchestration Status"
        description="Monitor and manage AI agents"
      />
    );
  }


  return (
    <div className="space-y-8">
      {/* Header & Status Ribbons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {t('ui_agents_autonomous_mesh_fleet')}
            </span>
          </div>
          <h1 className={`text-2xl font-medium text-slate-900 dark:text-white tracking-tight ${headingClass}`}>
            {t('ui_agents_agent_orchestration')}
          </h1>
          <p className="text-slate-600 dark:text-white/60 text-sm mt-1">
            {t('ui_agents_real_time_telemetry_auto_handoff_coo')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {agents.length > 0 && (
            <div className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono">
              <Radio className="w-3.5 h-3.5" />
              <span>{t('ui_agents_nodes_healthy', { length: agents.filter(a => a.health === 'healthy').length, length2: agents.length })}</span>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-theme-bg-secondary border border-slate-200 dark:border-white/[0.1] text-slate-800 dark:text-white hover:border-slate-300 dark:hover:border-white/20 text-xs font-medium transition-colors disabled:opacity-50 shadow-sm ${btnClass}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
            <span>{t('ui_farmer_detail_panel_refresh')}</span>
          </button>
        </div>
      </div>

      {queueStatus && <QueueStats status={queueStatus} />}

      {/* Agent Status Grid (KnockKnock Bento Style) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/[0.06]">
          <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('ui_agents_active_agent_nodes')}</span>
          </div>
        </div>
        {agents.length === 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-sm text-amber-700 dark:text-amber-200">
            {t('ui_agents_agent_status_is_unavailable_refresh')}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => {
            const isHealthy = agent.health === 'healthy';
            const isDegraded = agent.health === 'degraded';
            const loadPercent = Math.round((agent.currentLoad / agent.maxConcurrentTasks) * 100);

            return (
              <motion.div
                key={agent.agentId}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="p-6 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.1] hover:border-emerald-500/30 hover:bg-white dark:hover:bg-theme-bg-secondary/90 hover: dark:shadow-none transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Status Strip */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-theme-bg-primary border border-slate-200 dark:border-white/[0.08] text-emerald-600 dark:text-emerald-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white text-base leading-tight">{agent.name}</h4>
                        <p className="text-[10px] font-mono text-slate-500 dark:text-white/40 mt-0.5">ID: {agent.agentId}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium font-mono capitalize ${
                        isHealthy
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          : isDegraded
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isHealthy ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                        }`}
                      />
                      {agent.health}
                    </span>
                  </div>

                  {/* Load Progress Bar */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-theme-bg-primary/80 border border-slate-200/80 dark:border-white/[0.06] space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-600 dark:text-white/50">{t('ui_agents_concurrency_load')}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium font-mono tabular-nums">
                        {agent.currentLoad} / {agent.maxConcurrentTasks} ({loadPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-theme-bg-tertiary rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Capabilities Chips */}
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500 dark:text-white/40">{t('ui_agents_capabilities')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.capabilities.map(cap => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded-lg text-xs font-mono bg-slate-100 dark:bg-theme-bg-primary text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/[0.06]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dispatch Trigger Button */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/[0.06] space-y-2">
                  <div className="text-xs font-mono tabular-nums text-slate-400 dark:text-white/30 truncate">
                    {t('ui_agents_heartbeat')} {new Date(agent.lastHeartbeat).toLocaleTimeString(appLocale())}
                  </div>
                  <button
                    onClick={() => handleDispatch(agent.agentId)}
                    disabled={isDispatching === agent.agentId || agent.health === 'offline'}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                  >
                    {isDispatching === agent.agentId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{t('ui_agents_dispatch_probe')}</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AgentActivityPanels queueStatus={queueStatus} handoffs={handoffLog} />
    </div>
  );
}

export default Agents;
