import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Send,
  Zap,
  Sparkles,
  Radio,
  ArrowRight,
  ShieldCheck,
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
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import { CH_COLORS } from '@/lib/colors';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';

export function Agents() {
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

  const queueData = queueStatus
    ? [
        { name: 'Queued', value: queueStatus.queued, color: CH_COLORS.warning },
        { name: 'Active', value: queueStatus.active, color: CH_COLORS.blue },
        { name: 'Completed', value: queueStatus.completed, color: CH_COLORS.success },
        { name: 'Failed', value: queueStatus.failed, color: CH_COLORS.error },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header & Status Ribbons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
              Autonomous Mesh Fleet
            </span>
          </div>
          <h1 className={`text-3xl font-extrabold text-white tracking-tight ${headingClass}`}>
            Agent Orchestration
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Real-time telemetry, auto-handoff coordination, and execution matrix.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {agents.length > 0 && (
            <div className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <Radio className="w-3.5 h-3.5" />
              <span>{agents.length} NODES ONLINE</span>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/[0.1] text-white hover:border-emerald-500/40 hover:bg-slate-800 text-xs font-bold transition-all disabled:opacity-50 ${btnClass}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Queue Stats Bento Strip */}
      {queueStatus && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
            <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Queued Tasks</span>
            </div>
            <div className="text-xl font-bold text-amber-400 flex items-baseline gap-2">
              {queueStatus.queued}
              <span className="text-xxs font-normal text-white/40">In Buffer</span>
            </div>
          </div>

          <div className="p-4 rounded-xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
            <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>Active Workers</span>
            </div>
            <div className="text-xl font-bold text-sky-400 flex items-baseline gap-2">
              {queueStatus.active}
              <span className="text-xxs font-normal text-white/40">Executing</span>
            </div>
          </div>

          <div className="p-4 rounded-xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
            <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Completed Total</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 flex items-baseline gap-2">
              {queueStatus.completed}
              <span className="text-xxs font-normal text-emerald-400/80">98.5% Pass</span>
            </div>
          </div>

          <div className="p-4 rounded-xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-1">
            <div className="flex items-center gap-2 text-white/40 text-xxs uppercase tracking-wider font-mono">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Failed / Retried</span>
            </div>
            <div className="text-xl font-bold text-rose-400 flex items-baseline gap-2">
              {queueStatus.failed}
              <span className="text-xxs font-normal text-white/40">Auto-Handed Off</span>
            </div>
          </div>
        </div>
      )}

      {/* Agent Status Grid (KnockKnock Bento Style) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Active Agent Nodes</span>
          </div>
          <span className="text-xxs font-mono text-white/40">CLUSTER: PROD-EAST-AFRICA</span>
        </div>
        {agents.length === 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-sm text-amber-200">
            Agent status is unavailable. Refresh to retry the live orchestration service.
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
                className="p-6 rounded-xl backdrop-blur-xl bg-slate-900/70 border border-white/[0.1] hover:border-emerald-500/30 hover:bg-slate-900/90 hover:shadow-2xl hover:shadow-emerald-950/30 transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Status Strip */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-slate-950 border border-white/[0.08] text-emerald-400">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base leading-tight">{agent.name}</h4>
                        <p className="text-[10px] font-mono text-white/40 mt-0.5">ID: {agent.agentId}</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                        isHealthy
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : isDegraded
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isHealthy ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                        }`}
                      />
                      {agent.health}
                    </span>
                  </div>

                  {/* Load Progress Bar */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-2">
                    <div className="flex justify-between text-xxs font-mono">
                      <span className="text-white/50 uppercase">Concurrency Load</span>
                      <span className="text-emerald-400 font-bold">
                        {agent.currentLoad} / {agent.maxConcurrentTasks} ({loadPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-amber-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${loadPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Capabilities Chips */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-white/40">Capabilities</div>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.capabilities.map(cap => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-slate-950 text-white/70 border border-white/[0.06]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dispatch Trigger Button */}
                <div className="pt-4 border-t border-white/[0.06] space-y-2">
                  <div className="text-[9px] font-mono text-white/30 truncate">
                    HEARTBEAT: {new Date(agent.lastHeartbeat).toLocaleTimeString()}
                  </div>
                  <button
                    onClick={() => handleDispatch(agent.agentId)}
                    disabled={isDispatching === agent.agentId || agent.health === 'offline'}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  >
                    {isDispatching === agent.agentId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Dispatch Probe</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Analytics & Handoff Logs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Queue Distribution */}
        <div className="p-6 rounded-xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Queue Status Telemetry</span>
            </h3>
            <span className="text-xxs font-mono text-white/40">REAL-TIME DENSITY</span>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={queueData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={4}
              >
                {queueData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Handoff Log Terminal */}
        <div className="p-6 rounded-xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Autonomous Handoff Stream</span>
            </h3>
            <span className="text-xxs font-mono text-emerald-400">0 ERRORS</span>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto font-mono text-xs pr-1">
            {handoffLog.map((handoff, index) => (
              <div
                key={index}
                className="p-3 rounded-xl bg-slate-950/80 border border-white/[0.06] flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-white/90 flex items-center gap-1.5 truncate">
                    <span className="text-emerald-400">{handoff.from}</span>
                    <ArrowRight className="w-3 h-3 text-white/40 shrink-0" />
                    <span className="text-sky-400">{handoff.to}</span>
                  </div>
                  <div className="text-[10px] text-white/50 truncate">
                    TASK: {handoff.taskId} • {handoff.reason}
                  </div>
                </div>

                <div className="text-[9px] text-white/30 shrink-0">
                  {new Date(handoff.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Agents;
