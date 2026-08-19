import React from 'react';
import {
  Cpu,
  Layers,
  Activity,
  Play,
  Square,
  RefreshCcw,
  ChevronRight,
  Search,
  Database,
  CloudLightning,
  Terminal,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import apiClient from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { searchKnowledge } from '@/api/knowledgeService';
import { fetchFarmers } from '@/api/farmerService';

interface AgentData {
  id: string;
  name: string;
  status: string;
  load: number;
  description: string;
  capabilities: string[];
  lastActive?: string;
}

const iconMap: Record<string, React.ElementType> = {
  'agent-zero': Cpu,
  'crew-ai': Layers,
  openclaw: Terminal,
};

const getTagColor = (tag: string) => {
  switch (tag) {
    case 'SYSTEM':
      return 'text-primary-400';
    case 'OK':
    case 'QUERY':
      return 'text-green-400';
    case 'ERR':
      return 'text-red-400';
    case 'WARN':
      return 'text-orange-400';
    case 'EXEC':
    case 'REFRESH':
      return 'text-yellow-400';
    default:
      return 'text-white/60';
  }
};

const ConsoleLogViewer = ({
  consoleOutput,
  activeAgentData,
  activeAgent,
  now,
}: {
  consoleOutput: string[];
  activeAgentData: Record<string, unknown> | undefined;
  activeAgent: string;
  now: () => string;
}) => (
  <div className="p-4 space-y-3 font-mono text-xxs min-h-[80px]">
    {consoleOutput.length === 0 ? (
      <div className="text-white/20 text-center py-4">
        System initialized. Awaiting agent commands.
      </div>
    ) : (
      consoleOutput.map((line: string, i: number) => {
        const parts = line.match(/^(\d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/);
        if (!parts)
          return (
            <div key={i} className="text-white/60">
              {line}
            </div>
          );
        const [, time, tag, msg] = parts;
        return (
          <div key={i} className="flex gap-3">
            <span className="text-white/20">{time}</span>
            <span className={getTagColor(tag)}>[{tag}]</span>
            <span className="text-white/60">{msg}</span>
          </div>
        );
      })
    )}
    {activeAgentData?.['status'] === 'running' && (
      <div className="flex gap-3 animate-pulse">
        <span className="text-white/20">{now()}</span>
        <span className="text-primary-400">[PROC]</span>
        <span className="text-white/60">
          Agent {activeAgent} maintaining active orchestration...
        </span>
      </div>
    )}
  </div>
);

const AlphaAgentOps = () => {
  const { t: _t } = useLanguage();
  const { addNotification } = useAppStore();
  const [activeAgent, setActiveAgent] = React.useState<string>('agent-zero');
  const [isRunning, setIsRunning] = React.useState(false);
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [consoleOutput, setConsoleOutput] = React.useState<string[]>([]);

  const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });

  // Fetch real health data
  const { data: healthData } = useQuery({
    queryKey: ['agent-health'],
    queryFn: async () => {
      const { data } = await apiClient.get('/health');
      return data;
    },
    refetchInterval: 30000,
    enabled: !!localStorage.getItem('token'),
  });

  // Fetch real agent data from backend
  const { data: agentsData, refetch: refetchAgents } = useQuery<AgentData[]>({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const { data } = await apiClient.get('/ai/agents');
      return data.data || [];
    },
    enabled: !!localStorage.getItem('token'),
  });

  // Fetch real knowledge count
  const { data: knowledgeTotal } = useQuery({
    queryKey: ['knowledge-count'],
    queryFn: async () => {
      const res = await searchKnowledge('');
      return res.data?.total || 0;
    },
    enabled: !!localStorage.getItem('token'),
  });

  // Fetch real farmer count
  const { data: farmerCount } = useQuery({
    queryKey: ['farmer-count'],
    queryFn: async () => {
      const res = await fetchFarmers();
      return res.data?.total || 0;
    },
    enabled: !!localStorage.getItem('token'),
  });

  // Fetch real alerts count
  const { data: alertsCount } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/alerts');
        const alerts = data?.data || data || [];
        return Array.isArray(alerts) ? alerts.length : 0;
      } catch {
        return 0;
      }
    },
    enabled: !!localStorage.getItem('token'),
  });

  const agents = (agentsData || []).map(a => ({
    ...a,
    icon: iconMap[a.id] || Cpu,
  }));

  const handlePlay = async () => {
    setIsExecuting(true);
    const ts = now();
    setConsoleOutput(prev => [...prev, `${ts} [EXEC] Starting ${activeAgent} agent execution...`]);
    try {
      const { data } = await apiClient.post('/ai/execute', { agent: activeAgent });
      if (data.success) {
        setConsoleOutput(prev => [
          ...prev,
          `${ts} [OK] Agent ${activeAgent} task dispatched successfully`,
        ]);
        addNotification({ type: 'success', message: `Agent ${activeAgent} started successfully` });
        refetchAgents();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const errorMsg = err.response?.data?.error || 'Backend or Agent service unavailable';
      setConsoleOutput(prev => [...prev, `${ts} [ERR] ${errorMsg}`]);
      addNotification({ type: 'error', message: `Failed to start ${activeAgent}: ${errorMsg}` });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleStop = async () => {
    setIsExecuting(true);
    const ts = now();
    setConsoleOutput(prev => [...prev, `${ts} [EXEC] Stopping ${activeAgent} agent...`]);
    try {
      const { data } = await apiClient.post(`/ai/stop/${activeAgent}`);
      if (data.success) {
        setIsRunning(false);
        setConsoleOutput(prev => [...prev, `${ts} [OK] Agent ${activeAgent} stopped`]);
        addNotification({ type: 'info', message: `Agent ${activeAgent} stopped` });
        refetchAgents();
      }
    } catch {
      setIsRunning(false);
      setConsoleOutput(prev => [
        ...prev,
        `${ts} [ERR] Stop request failed — agent state reset locally`,
      ]);
      addNotification({
        type: 'error',
        message: `Failed to communicate with backend for ${activeAgent}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRefresh = async () => {
    setIsExecuting(true);
    const ts = now();
    setConsoleOutput(prev => [...prev, `${ts} [REFRESH] Refreshing agent status...`]);
    try {
      await refetchAgents();
      setConsoleOutput(prev => [...prev, `${ts} [OK] Agent status refreshed from backend`]);
      addNotification({ type: 'success', message: 'Agent status refreshed' });
    } catch {
      setConsoleOutput(prev => [...prev, `${ts} [ERR] Failed to refresh agent status`]);
      addNotification({ type: 'error', message: 'Failed to refresh agent status' });
    } finally {
      setIsExecuting(false);
    }
  };

  const activeAgentData = agents.find(a => a.id === activeAgent);

  return (
    <div className="w-full space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-[0.3em] mb-2 flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg border border-primary-500/30">
              <Cpu className="w-6 h-6 text-primary-400" />
            </div>
            Alpha Agent Ops
          </h2>
          <p className="text-xxs font-bold text-primary-400/60 uppercase tracking-widest pl-12">
            Agent Orchestration & Task Management
          </p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3 h-3 text-secondary-400" />
              <span className="text-xs font-black text-white/40 uppercase tracking-widest">
                System Status
              </span>
            </div>
            <div className="text-lg font-black text-white">
              {healthData?.status || 'Unknown'}{' '}
              <span className="text-xs text-white/40">{healthData?.environment || ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-8 mt-8">
        {/* Agent Selection Sidebar */}
        <div className="col-span-4 space-y-4">
          <h3 className="text-xxs font-black text-white/40 uppercase tracking-[0.2em] mb-4">
            Instance Registry
          </h3>
          {agents.length > 0 ? (
            agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setActiveAgent(agent.id)}
                className={`w-full p-4 rounded-2xl border transition-all text-left relative group overflow-hidden ${
                  activeAgent === agent.id
                    ? 'bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/20 shadow-lg shadow-primary-500/5'
                    : 'bg-black/20 border-white/5 hover:bg-black/40 hover:border-white/10'
                }`}
              >
                {activeAgent === agent.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-white/20">
                    <agent.icon
                      className={`w-5 h-5 ${activeAgent === agent.id ? 'text-primary-400' : 'text-white/40'}`}
                    />
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-black uppercase tracking-widest ${
                      agent.status === 'online' || agent.status === 'running'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-white/5 text-white/40'
                    }`}
                  >
                    <div
                      className={`w-1 h-1 rounded-full ${agent.status === 'online' || agent.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}
                    />
                    {agent.status}
                  </div>
                </div>
                <div className="font-black text-white uppercase tracking-wider mb-1">
                  {agent.name}
                </div>
                <div className="text-xxs text-white/40 font-medium leading-relaxed">
                  {agent.description}
                </div>

                {agent.load > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs font-black uppercase tracking-tighter text-white/20">
                      <span>Allocated Compute</span>
                      <span>{agent.load}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-400/40"
                        style={{ width: `${agent.load}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-white/40 text-xs font-bold uppercase">
              No agents registered
            </div>
          )}
        </div>

        {/* Control Panel Section */}
        <div className="col-span-8 flex flex-col space-y-6">
          <div className="bg-black/40 border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden flex-1">
            <div className="absolute inset-0 cyber-grid-premium opacity-5 pointer-events-none" />

            <div className="flex items-center justify-between mb-8">
              <h4 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                <Terminal className="w-6 h-6 text-primary-400" />
                Operational Console
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={handlePlay}
                  disabled={isExecuting || isRunning}
                  className="p-3 bg-primary-500/20 border border-primary-500/30 rounded-xl text-primary-400 hover:bg-primary-500/30 transition-all disabled:opacity-40"
                >
                  {isExecuting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleStop}
                  disabled={isExecuting || !isRunning}
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:bg-white/10 transition-all disabled:opacity-40"
                >
                  <Square className="w-5 h-5" />
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={isExecuting}
                  className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:bg-white/10 transition-all disabled:opacity-40"
                >
                  <RefreshCcw className={`w-5 h-5 ${isExecuting ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Capability Matrix */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <h5 className="text-xxs font-black text-white/40 uppercase tracking-[0.2em]">
                  Active Capabilities
                </h5>
                <div className="space-y-2">
                  {(activeAgentData?.capabilities || []).map(cap => (
                    <div
                      key={cap}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-default"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary-400/40" />
                      <span className="text-xs font-bold text-white/80">{cap}</span>
                      <ChevronRight className="w-3 h-3 ml-auto text-white/20" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-primary-500/5 rounded-3xl border border-primary-500/10 p-6 flex flex-col justify-center items-center text-center">
                <CloudLightning className="w-12 h-12 text-primary-400/20 mb-4" />
                <div className="text-xxs font-black text-primary-400 uppercase tracking-[0.2em] mb-2">
                  System Health
                </div>
                <div className="text-2xl font-black text-white">
                  {healthData?.status === 'healthy' ? 'Online' : healthData?.status || 'Unknown'}
                </div>
                <p className="text-micro text-white/40 mt-2 uppercase tracking-tight">
                  DB: {healthData?.services?.database || '\u2014'} | Cache:{' '}
                  {healthData?.services?.cache || '\u2014'}
                </p>
              </div>
            </div>

            {/* Recent Activity Log */}
            <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <span className="text-micro font-black text-white/40 uppercase tracking-[0.2em]">
                  Runtime History
                </span>
                <Terminal className="w-3 h-3 text-white/40" />
              </div>
              <ConsoleLogViewer
                consoleOutput={consoleOutput}
                activeAgentData={activeAgentData}
                activeAgent={activeAgent}
                now={now}
              />
            </div>
          </div>

          {/* Quick Stats Banner — Real Data */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-black/40 border border-white/10 rounded-2xl flex items-center gap-4">
              <div className="p-2 bg-secondary-500/20 rounded-lg">
                <Database className="w-5 h-5 text-secondary-400" />
              </div>
              <div>
                <div className="text-xs font-black text-white/40 uppercase tracking-widest">
                  Knowledge Base
                </div>
                <div className="text-sm font-black text-white">
                  {knowledgeTotal ?? '\u2014'}{' '}
                  <span className="text-xxs text-white/40">Articles</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-black/40 border border-white/10 rounded-2xl flex items-center gap-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Search className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-xs font-black text-white/40 uppercase tracking-widest">
                  Active Farmers
                </div>
                <div className="text-sm font-black text-white">
                  {farmerCount ?? '\u2014'}{' '}
                  <span className="text-xxs text-white/40">Registered</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-black/40 border border-orange-500/20 rounded-2xl flex items-center gap-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-xs font-black text-white/40 uppercase tracking-widest">
                  Active Alerts
                </div>
                <div className="text-sm font-black text-white">
                  {alertsCount ?? '\u2014'} <span className="text-xxs text-white/40">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlphaAgentOps;
