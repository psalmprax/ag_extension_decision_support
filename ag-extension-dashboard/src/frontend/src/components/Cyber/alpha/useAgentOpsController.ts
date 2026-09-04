import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';
import { searchKnowledge } from '@/api/knowledgeService';
import { fetchFarmers } from '@/api/farmerService';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';

export interface ApiAgent {
  id: string;
  name: string;
  url?: string;
  description?: string;
  capabilities?: string[];
  providerType?: string;
  status?: 'online' | 'running' | 'idle' | 'offline' | 'unhealthy' | string;
  load?: number;
  lastActive?: string;
}

export interface AgentData {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'running' | 'idle' | 'offline' | 'unhealthy';
  load: number | null;
  description: string;
  capabilities: string[];
  lastActive?: string;
  providerType?: string;
}

export interface AutonomousScenario {
  id: string;
  title: string;
  desc: string;
  tag: string;
  agent: string;
  initialLog: string;
}

export const AUTONOMOUS_SCENARIOS: AutonomousScenario[] = [
  { id: 'outbreak_triage', title: 'Emergency Fall Armyworm Region-Wide Sweep', desc: 'Orchestrates vision models, queries FAO IPM rules, and drafts SMS alerts.', tag: 'ENTOMOLOGY', agent: 'crew-ai', initialLog: 'Initiating regional pest triage... Processing 142 smallholder scout reports.' },
  { id: 'soil_batch', title: 'Batch Soil Acidity & Liming Prescription Engine', desc: 'Runs SoilGrids v2 NPK analysis and computes CaCO3 neutralizing requirements.', tag: 'AGRONOMY', agent: 'crew-ai', initialLog: 'Ingesting ISRIC SoilGrids v2 layer... Calculating CaCO3 requirement for 28 registered plots.' },
  { id: 'nasa_anomaly', title: 'NASA Satellite Precipitation Anomaly Sweep', desc: 'Fetches 14-day rainfall anomalies and detects drought/waterlogging risk zones.', tag: 'CLIMATOLOGY', agent: 'agent-zero', initialLog: 'Syncing NASA POWER surface meteorology... 14-day rainfall anomaly: +18.4% above median.' },
  { id: 'followup_loop', title: 'Automated WhatsApp Advisory Follow-Up Loop', desc: 'Translates agronomic prescriptions to Swahili/Luganda and triggers dispatch.', tag: 'DISPATCH', agent: 'agent-zero', initialLog: 'Queueing multi-lingual advisory dispatches: 86 SMS, 42 WhatsApp audio notes.' },
];

const KNOWN_STATUSES = new Set(['online', 'running', 'idle', 'offline', 'unhealthy']);

function normalizeAgent(agent: ApiAgent): AgentData {
  const status = KNOWN_STATUSES.has(String(agent.status)) ? (agent.status as AgentData['status']) : 'offline';
  return {
    id: agent.id,
    name: agent.name,
    role: agent.providerType ? `${agent.providerType} runtime` : 'agent runtime',
    status,
    load: typeof agent.load === 'number' && Number.isFinite(agent.load) ? Math.max(0, Math.min(100, agent.load)) : null,
    description: agent.description || '',
    capabilities: Array.isArray(agent.capabilities) ? agent.capabilities : [],
    lastActive: agent.lastActive,
    providerType: agent.providerType,
  };
}

function isReachable(agent: AgentData): boolean {
  return agent.status === 'online' || agent.status === 'running';
}

function buildBootLines(fleet: AgentData[], tools: string[] | undefined): string[] {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const reachable = fleet.filter(isReachable).length;
  const agentLines = fleet.map(agent => {
    const lastSeen = agent.lastActive ? ` · last seen ${new Date(agent.lastActive).toLocaleTimeString()}` : '';
    return `${timestamp} [${agent.id.toUpperCase().replace(/-/g, '_')}] ${agent.status}${lastSeen}`;
  });
  const toolStatus = tools?.length ? `${tools.length} MCP tools registered.` : 'MCP tool registry not loaded.';
  return [`${timestamp} [SYSTEM] Agent registry loaded: ${fleet.length} agent(s), ${reachable} reachable.`, ...agentLines, `${timestamp} [SYSTEM] ${toolStatus}`];
}

function scenarioTool(agent: string): string {
  if (agent === 'crew-ai') return 'calc_liming_dosage';
  if (agent === 'pathology-agent') return 'get_fao_ipm_thresholds';
  return 'compute_moisture_deficit';
}

function actionMessage(agent: string, action: 'start' | 'success' | 'error', error?: unknown): string {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  if (action === 'start') return `${timestamp} [EXEC] Starting ${agent} task execution...`;
  if (action === 'success') return `${timestamp} [OK] Agent ${agent} task dispatched successfully`;
  return `${timestamp} [ERROR] ${error instanceof Error ? error.message : 'Agent execution unavailable'}`;
}

function useAgentOpsData() {
  const agentsQuery = useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: ApiAgent[] }>('/ai/agents');
      return (data.data || []).map(normalizeAgent);
    },
    refetchInterval: 30000,
    retry: 2,
  });
  const fleet = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const toolsQuery = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Array<{ name: string }> }>('/mcp/tools');
      return (data.data || []).map(tool => tool.name);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const knowledgeQuery = useQuery({ queryKey: ['knowledge-count'], queryFn: async () => (await searchKnowledge('')).data?.total || 0, staleTime: 60_000 });
  const farmerQuery = useQuery({ queryKey: ['farmer-count'], queryFn: async () => (await fetchFarmers()).data?.total || 0, staleTime: 60_000 });
  const alertsQuery = useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const { data } = await apiClient.get('/alerts');
      const alerts = data?.data || data || [];
      return Array.isArray(alerts) ? alerts.length : 0;
    },
    staleTime: 60_000,
  });
  return { agentsQuery, fleet, mcpTools: toolsQuery.data, knowledgeCount: knowledgeQuery.data, farmerCount: farmerQuery.data, alertsCount: alertsQuery.data };
}

function useAgentOpsActions(
  fleet: AgentData[],
  mcpTools: string[] | undefined,
  agentsLoading: boolean,
  agentsError: boolean,
  executionMode: 'supervised' | 'autonomous' | 'edge'
) {
  const { addNotification } = useAppStore();
  const [activeAgent, setActiveAgent] = useState('agent-zero');
  const [isExecuting, setIsExecuting] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => setConsoleOutput(previous => [...previous, line]), []);

  useEffect(() => {
    if (fleet.length > 0 && !fleet.some(agent => agent.id === activeAgent)) setActiveAgent(fleet[0].id);
  }, [activeAgent, fleet]);

  useEffect(() => {
    if (agentsLoading) return;
    if (agentsError) {
      setConsoleOutput([`${new Date().toLocaleTimeString('en-US', { hour12: false })} [ERROR] Agent registry unavailable (GET /api/ai/agents failed).`]);
      return;
    }
    setConsoleOutput(buildBootLines(fleet, mcpTools));
  }, [agentsError, agentsLoading, fleet, mcpTools]);

  const activeAgentData = fleet.find(agent => agent.id === activeAgent) || fleet[0];

  const handleRunScenario = useCallback((scenario: AutonomousScenario) => {
    setActiveAgent(scenario.agent);
    setIsExecuting(true);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setConsoleOutput(previous => [...previous, `${timestamp} [DISPATCH] Triggering Autonomous Scenario: "${scenario.title}"`, `${timestamp} [HANDOFF] Routing task to ${scenario.agent.toUpperCase()}...`, `${timestamp} [DEMO] ${scenario.initialLog}`]);
    window.setTimeout(() => {
      const completionTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      setConsoleOutput(previous => [...previous, `${completionTime} [REASONING] Evaluating biophysical constraints and FAO/CIMMYT guidelines...`, `${completionTime} [DEMO] Illustrative tool sequence: ${scenarioTool(scenario.agent)}`, `${completionTime} [DEMO] Scenario preview complete. No live task or telemetry was changed.`]);
      setIsExecuting(false);
      toast.success(`Demo scenario previewed: ${scenario.title}`);
    }, 1200);
  }, []);

  const executeAction = useCallback(async (agent: string, endpoint: string, action: 'execute' | 'stop' | 'refresh') => {
    if (action !== 'refresh' && !activeAgentData) return;
    setIsExecuting(true);
    appendLog(actionMessage(agent, 'start'));
    try {
      const response = action === 'execute' ? await apiClient.post(endpoint, { agent, mode: executionMode }) : await apiClient.post(endpoint);
      if (action === 'execute' && response.data.success) {
        appendLog(actionMessage(agent, 'success'));
        addNotification({ type: 'success', message: `Agent ${agent} started successfully` });
      }
      if (action === 'refresh') appendLog(actionMessage(agent, 'success'));
    } catch (error) {
      appendLog(actionMessage(agent, 'error', error));
      const message = action === 'stop' ? 'Agent stop control is unavailable' : action === 'refresh' ? 'Agent fleet refresh is unavailable' : 'Agent execution is unavailable';
      addNotification({ type: 'error', message });
    } finally {
      setIsExecuting(false);
    }
  }, [activeAgentData, addNotification, appendLog, executionMode]);

  return {
    activeAgent,
    setActiveAgent,
    isExecuting,
    consoleOutput,
    handleRunScenario,
    handlePlay: useCallback(() => executeAction(activeAgent, '/ai/execute', 'execute'), [activeAgent, executeAction]),
    handleStop: useCallback(() => executeAction(activeAgent, `/ai/stop/${activeAgent}`, 'stop'), [activeAgent, executeAction]),
    handleRefresh: useCallback(() => executeAction('system', '/ai/agents', 'refresh'), [executeAction]),
  };
}

export function useAgentOpsController() {
  const { t } = useLanguage();
  const data = useAgentOpsData();
  const [executionMode, setExecutionMode] = useState<'supervised' | 'autonomous' | 'edge'>('supervised');
  const actions = useAgentOpsActions(
    data.fleet,
    data.mcpTools,
    data.agentsQuery.isLoading,
    data.agentsQuery.isError,
    executionMode
  );
  const selectedAgentData = data.fleet.find(agent => agent.id === actions.activeAgent) || data.fleet[0];
  const loads = data.fleet.flatMap(agent => (agent.load === null ? [] : [agent.load]));
  const avgLoad = loads.length ? Math.round(loads.reduce((sum, load) => sum + load, 0) / loads.length) : null;
  const reachable = data.fleet.filter(isReachable).length;
  return {
    t,
    ...data,
    agentsLoading: data.agentsQuery.isLoading,
    agentsError: data.agentsQuery.isError,
    ...actions,
    activeAgentData: selectedAgentData,
    executionMode,
    setExecutionMode,
    avgLoad,
    reachable,
    scenarios: AUTONOMOUS_SCENARIOS,
  };
}
