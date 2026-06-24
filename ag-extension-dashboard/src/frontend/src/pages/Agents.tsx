import React, { useState, useEffect, useCallback } from 'react';
import {
    Server, Activity, CheckCircle, AlertTriangle,
    XCircle, Clock,
    Users, RefreshCw, Send
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { fetchAgentStatus, fetchQueueStatus, fetchHandoffLog, dispatchTask, AgentStatus, QueueStatus } from '../api/agentService';
import { withRealFallback } from '../lib/realFirst';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import { MetricCard } from '@/components/MetricCard';
import { CH_COLORS } from '@/lib/colors';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';

export function Agents() {
    const { t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass } = useThemeClasses();
    const { addNotification } = useAppStore();

    // State
    const [agents, setAgents] = useState<AgentStatus[]>([]);
    const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
    const [handoffLog, setHandoffLog] = useState<Array<{ from: string; to: string; taskId: string; reason: string; timestamp: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isDispatching, setIsDispatching] = useState<string | null>(null);

    // Load data
    const loadData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const fallbackAgents: AgentStatus[] = [
                { agentId: 'ag-001', name: 'Alpha-Analytic', capabilities: ['diagnosis', 'soil-analysis'], maxConcurrentTasks: 10, currentLoad: 3, health: 'healthy', lastHeartbeat: new Date().toISOString() },
                { agentId: 'ag-002', name: 'Beta-Synthesizer', capabilities: ['synthesis', 'reporting'], maxConcurrentTasks: 5, currentLoad: 1, health: 'healthy', lastHeartbeat: new Date().toISOString() },
                { agentId: 'ag-003', name: 'Gamma-Optimizer', capabilities: ['irrigation', 'weather-pivoting'], maxConcurrentTasks: 8, currentLoad: 5, health: 'degraded', lastHeartbeat: new Date().toISOString() }
            ];

            const fallbackQueue: QueueStatus = { queued: 5, active: 9, completed: 1547, failed: 23 };
            const fallbackHandoffs = [
                { from: 'Alpha-Analytic', to: 'Beta-Synthesizer', taskId: 'task-882', reason: 'Synthesis required', timestamp: new Date().toISOString() }
            ];

            const [agentsData, queueData, handoffData] = await Promise.all([
                withRealFallback(fetchAgentStatus(), fallbackAgents),
                withRealFallback(fetchQueueStatus(), fallbackQueue),
                withRealFallback(fetchHandoffLog(), fallbackHandoffs)
            ]);

            setAgents(agentsData);
            setQueueStatus(queueData);
            setHandoffLog(handoffData);
            
        } catch (error) {
            console.error('Failed to load agent data:', error);
            addNotification({
                type: 'error',
                message: t('agents_failed_load')
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [addNotification, t]);

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
                agentId
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

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'healthy': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
            case 'degraded': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
            case 'offline': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
            default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
        }
    };

    const getHealthIcon = (health: string) => {
        switch (health) {
            case 'healthy': return CheckCircle;
            case 'degraded': return AlertTriangle;
            case 'offline': return XCircle;
            default: return Clock;
        }
    };


    if (isLoading) {
        return <LoadingHeaderSkeleton title="Agent Orchestration Status" description="Monitor and manage AI agents" />;
    }

    const queueData = queueStatus ? [
        { name: 'Queued', value: queueStatus.queued, color: CH_COLORS.warning },
        { name: 'Active', value: queueStatus.active, color: CH_COLORS.blue },
        { name: 'Completed', value: queueStatus.completed, color: CH_COLORS.success },
        { name: 'Failed', value: queueStatus.failed, color: CH_COLORS.error }
    ] : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-2xl ${headingClass}`}>{isModern ? 'Autonomous Orchestration' : 'Agent Manager'}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('agents_subtitle')}</p>
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

            {/* Queue Stats */}
            {queueStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                        title={t('agents_queued_tasks')}
                        value={queueStatus.queued}
                        icon={Clock}
                        color="yellow"
                    />
                    <MetricCard
                        title={t('agents_active_tasks')}
                        value={queueStatus.active}
                        icon={Activity}
                        color="blue"
                    />
                    <MetricCard
                        title={t('agents_completed')}
                        value={queueStatus.completed}
                        icon={CheckCircle}
                        color="green"
                    />
                    <MetricCard
                        title={t('agents_failed')}
                        value={queueStatus.failed}
                        icon={XCircle}
                        color="red"
                    />
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Queue Status Pie Chart */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('agents_task_queue_status')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={queueData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, value }) => `${name}: ${value}`}
                            >
                                {queueData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Agent Load Chart */}
                <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('agents_agent_load_distribution')}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={agents.map(agent => ({
                            name: agent.name,
                            load: agent.currentLoad,
                            max: agent.maxConcurrentTasks
                        }))}>
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="load" fill={CH_COLORS.blue} />
                            <Bar dataKey="max" fill="var(--color-primary-500)" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Agent Status Grid */}
            <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('agents_agent_status')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {agents.map((agent) => {
                        const HealthIcon = getHealthIcon(agent.health);
                        return (
                            <motion.div
                                key={agent.agentId}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`p-6 border border-gray-200 dark:border-gray-700 ${radiusClass} bg-white dark:bg-gray-800 flex flex-col justify-between`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <Server className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                                            <div>
                                                <h4 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">ID: {agent.agentId}</p>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getHealthColor(agent.health)}`}>
                                            <HealthIcon className="w-4 h-4 inline mr-1" />
                                            {agent.health}
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Load</span>
                                            <span className="font-medium">{agent.currentLoad}/{agent.maxConcurrentTasks}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-primary-600 h-2 rounded-full"
                                                style={{ width: `${(agent.currentLoad / agent.maxConcurrentTasks) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Capabilities</span>
                                            <span className="font-medium">{agent.capabilities.length}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Last heartbeat: {new Date(agent.lastHeartbeat).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDispatch(agent.agentId)}
                                    disabled={isDispatching === agent.agentId || agent.health === 'offline'}
                                    className={`w-full flex items-center justify-center gap-2 py-2 bg-slate-100 dark:bg-gray-700 text-gray-900 dark:text-white ${btnClass} hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 font-bold uppercase tracking-tight text-xs`}
                                >
                                    {isDispatching === agent.agentId ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                    Dispatch Health Check
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Handoff Log */}
            <div className="card p-6">

                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('agents_recent_handoffs')}</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {handoffLog.slice(0, 10).map((handoff, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 ${radiusClass}`}
                        >
                            <div className="flex items-center gap-4">
                                <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {handoff.from} → {handoff.to}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Task: {handoff.taskId} • Reason: {handoff.reason}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {new Date(handoff.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Agents;