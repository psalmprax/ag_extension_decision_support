import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Play,
  Square,
  RefreshCcw,
  Terminal,
  Loader2,
  Sparkles,
  Zap,
  Bot,
  Workflow,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import apiClient from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { searchKnowledge } from '@/api/knowledgeService';
import { fetchFarmers } from '@/api/farmerService';
import toast from 'react-hot-toast';

/** Shape returned by GET /api/ai/agents (routes/ai.ts agentRegistry + live status). */
interface ApiAgent {
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

interface AgentData {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'running' | 'idle' | 'offline' | 'unhealthy';
  /** 0-100 when the backend reports it, otherwise null (rendered as "—"). */
  load: number | null;
  description: string;
  capabilities: string[];
  lastActive?: string;
  providerType?: string;
}

const KNOWN_STATUSES = new Set(['online', 'running', 'idle', 'offline', 'unhealthy']);

function normalizeAgent(a: ApiAgent): AgentData {
  const status = KNOWN_STATUSES.has(String(a.status)) ? (a.status as AgentData['status']) : 'offline';
  return {
    id: a.id,
    name: a.name,
    role: a.providerType ? `${a.providerType} runtime` : 'agent runtime',
    status,
    load: typeof a.load === 'number' && Number.isFinite(a.load) ? Math.max(0, Math.min(100, a.load)) : null,
    description: a.description || '',
    capabilities: Array.isArray(a.capabilities) ? a.capabilities : [],
    lastActive: a.lastActive,
    providerType: a.providerType,
  };
}

interface TopologyNode {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  status: string;
}

const NODE_COLORS = ['#10b981', '#06b6d4', '#ec4899', '#f59e0b', '#8b5cf6', '#22d3ee'];

/** Lay agents out as a hub (first agent) + ring; links hub -> each spoke. */
function buildTopology(fleet: AgentData[]): { nodes: TopologyNode[]; links: Array<{ from: string; to: string }> } {
  if (fleet.length === 0) return { nodes: [], links: [] };
  const [hub, ...spokes] = fleet;
  const nodes: TopologyNode[] = [{ id: hub.id, name: hub.name, x: 0.5, y: 0.5, color: NODE_COLORS[0], status: hub.status }];
  spokes.forEach((a, i) => {
    const angle = (i / Math.max(spokes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    nodes.push({
      id: a.id,
      name: a.name,
      x: 0.5 + Math.cos(angle) * 0.32,
      y: 0.5 + Math.sin(angle) * 0.32,
      color: NODE_COLORS[(i + 1) % NODE_COLORS.length],
      status: a.status,
    });
  });
  const links = spokes.map(a => ({ from: hub.id, to: a.id }));
  return { nodes, links };
}

const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const gridSize = 24;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
};

const drawLinks = (ctx: CanvasRenderingContext2D, w: number, h: number, packetT: number, nodes: TopologyNode[], links: Array<{ from: string; to: string }>) => {
  links.forEach(link => {
    const fromNode = nodes.find(n => n.id === link.from);
    const toNode = nodes.find(n => n.id === link.to);
    if (!fromNode || !toNode) return;

    const x1 = fromNode.x * w;
    const y1 = fromNode.y * h;
    const x2 = toNode.x * w;
    const y2 = toNode.y * h;

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated data packet
    const px = x1 + (x2 - x1) * ((packetT + fromNode.x * 3) % 1);
    const py = y1 + (y2 - y1) * ((packetT + fromNode.x * 3) % 1);

    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
};

const drawNodes = (ctx: CanvasRenderingContext2D, w: number, h: number, activeAgent: string, nodes: TopologyNode[]) => {
  nodes.forEach(node => {
    const nx = node.x * w;
    const ny = node.y * h;
    const isSelected = activeAgent === node.id;

    if (isSelected) {
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(nx, ny, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(nx, ny, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSelected ? node.color : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(nx, ny, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, nx, ny + 28);
  });
};

const MultiAgentTopologyCanvas: React.FC<{
  activeAgent: string;
  fleet: AgentData[];
  onSelectAgent: (id: string) => void;
}> = ({ activeAgent, fleet, onSelectAgent }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { nodes, links } = React.useMemo(() => buildTopology(fleet), [fleet]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let packetT = 0;

    const render = () => {
      const w = (canvas.width = canvas.parentElement?.clientWidth || 600);
      const h = (canvas.height = canvas.parentElement?.clientHeight || 280);

      ctx.clearRect(0, 0, w, h);
      drawGrid(ctx, w, h);
      drawLinks(ctx, w, h, packetT, nodes, links);
      drawNodes(ctx, w, h, activeAgent, nodes);

      packetT = (packetT + 0.008) % 1;
      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animFrame);
  }, [activeAgent, nodes, links]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    if (nodes.length === 0) return;
    let nearest = nodes[0];
    let minDist = 999;
    nodes.forEach(n => {
      const d = Math.hypot(n.x - clickX, n.y - clickY);
      if (d < minDist) {
        minDist = d;
        nearest = n;
      }
    });
    if (minDist < 0.15) {
      onSelectAgent(nearest.id);
    }
  };

  return (
    <div className="w-full h-64 rounded-xl bg-slate-950/80 border border-white/10 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-pointer"
      />
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>{nodes.length > 0 ? `${nodes.length} REGISTERED AGENT${nodes.length === 1 ? '' : 'S'}` : 'NO AGENTS REGISTERED'}</span>
      </div>
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/40">
          Agent registry unavailable — check /api/ai/agents
        </div>
      )}
    </div>
  );
};

const AUTONOMOUS_SCENARIOS = [
  {
    id: 'outbreak_triage',
    title: 'Emergency Fall Armyworm Region-Wide Sweep',
    desc: 'Orchestrates vision models, queries FAO IPM rules, and drafts SMS alerts.',
    tag: 'ENTOMOLOGY',
    agent: 'crew-ai',
    initialLog: 'Initiating regional pest triage... Processing 142 smallholder scout reports.',
  },
  {
    id: 'soil_batch',
    title: 'Batch Soil Acidity & Liming Prescription Engine',
    desc: 'Runs SoilGrids v2 NPK analysis and computes CaCO3 neutralizing requirements.',
    tag: 'AGRONOMY',
    agent: 'crew-ai',
    initialLog: 'Ingesting ISRIC SoilGrids v2 layer... Calculating CaCO3 requirement for 28 registered plots.',
  },
  {
    id: 'nasa_anomaly',
    title: 'NASA Satellite Precipitation Anomaly Sweep',
    desc: 'Fetches 14-day rainfall anomalies and detects drought/waterlogging risk zones.',
    tag: 'CLIMATOLOGY',
    agent: 'agent-zero',
    initialLog: 'Syncing NASA POWER surface meteorology... 14-day rainfall anomaly: +18.4% above median.',
  },
  {
    id: 'followup_loop',
    title: 'Automated WhatsApp Advisory Follow-Up Loop',
    desc: 'Translates agronomic prescriptions to Swahili/Luganda and triggers dispatch.',
    tag: 'DISPATCH',
    agent: 'agent-zero',
    initialLog: 'Queueing multi-lingual advisory dispatches: 86 SMS, 42 WhatsApp audio notes.',
  },
];

const AlphaAgentOps: React.FC = () => {
  const { t } = useLanguage();
  const { addNotification } = useAppStore();
  const [activeAgent, setActiveAgent] = useState<string>('agent-zero');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMode, setExecutionMode] = useState<'supervised' | 'autonomous' | 'edge'>('supervised');
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });

  // Fetch agents from backend API — the only source of fleet data. No fabricated fallback.
  const { data: agentsData, isLoading: agentsLoading, isError: agentsError } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: ApiAgent[] }>('/ai/agents');
      return (data.data || []).map(normalizeAgent);
    },
    refetchInterval: 30000,
    retry: 2,
  });
  const fleet: AgentData[] = agentsData ?? [];

  // Real MCP tool registry (shared by all agents).
  const { data: mcpTools } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Array<{ name: string }> }>('/mcp/tools');
      return (data.data || []).map(t => t.name);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: knowledgeCount } = useQuery({
    queryKey: ['knowledge-count'],
    queryFn: async () => {
      const res = await searchKnowledge('');
      return res.data?.total || 0;
    },
    staleTime: 60_000,
  });

  const { data: farmerCount } = useQuery({
    queryKey: ['farmer-count'],
    queryFn: async () => {
      const res = await fetchFarmers();
      return res.data?.total || 0;
    },
    staleTime: 60_000,
  });

  const { data: alertsCount } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const { data } = await apiClient.get('/alerts');
      const alerts = data?.data || data || [];
      return Array.isArray(alerts) ? alerts.length : 0;
    },
    staleTime: 60_000,
  });

  // Boot log reflects what the API actually reported.
  useEffect(() => {
    if (agentsLoading) return;
    const ts = now();
    if (agentsError) {
      setConsoleOutput([`${ts} [ERROR] Agent registry unavailable (GET /api/ai/agents failed).`]);
      return;
    }
    const online = fleet.filter(a => a.status === 'online' || a.status === 'running').length;
    const lines = [
      `${ts} [SYSTEM] Agent registry loaded: ${fleet.length} agent(s), ${online} reachable.`,
      ...fleet.map(a => `${ts} [${a.id.toUpperCase().replace(/-/g, '_')}] ${a.status}${a.lastActive ? ` · last seen ${new Date(a.lastActive).toLocaleTimeString()}` : ''}`),
      `${ts} [SYSTEM] ${mcpTools ? `${mcpTools.length} MCP tools registered.` : 'MCP tool registry not loaded.'}`,
    ];
    setConsoleOutput(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentsLoading, agentsError, agentsData, mcpTools]);

  useEffect(() => {
    if (fleet.length > 0 && !fleet.some(a => a.id === activeAgent)) setActiveAgent(fleet[0].id);
  }, [fleet, activeAgent]);

  const activeAgentData: AgentData | undefined = fleet.find(a => a.id === activeAgent) || fleet[0];
  const loads = fleet.map(a => a.load).filter((v): v is number => v !== null);
  const avgLoad = loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : null;
  const reachable = fleet.filter(a => a.status === 'online' || a.status === 'running').length;

  const handleRunScenario = (sc: (typeof AUTONOMOUS_SCENARIOS)[0]) => {
    setActiveAgent(sc.agent);
    setIsExecuting(true);
    const ts = now();

    setConsoleOutput(prev => [
      ...prev,
      `${ts} [DISPATCH] Triggering Autonomous Scenario: "${sc.title}"`,
      `${ts} [HANDOFF] Routing task to ${sc.agent.toUpperCase()}...`,
      `${ts} [DEMO] ${sc.initialLog}`,
    ]);

    setTimeout(() => {
      const ts2 = now();
      setConsoleOutput(prev => [
        ...prev,
        `${ts2} [REASONING] Evaluating biophysical constraints and FAO/CIMMYT guidelines...`,
        `${ts2} [DEMO] Illustrative tool sequence: ${sc.agent === 'crew-ai' ? 'calc_liming_dosage' : sc.agent === 'pathology-agent' ? 'get_fao_ipm_thresholds' : 'compute_moisture_deficit'}`,
        `${ts2} [DEMO] Scenario preview complete. No live task or telemetry was changed.`,
      ]);
      setIsExecuting(false);
      toast.success(`Demo scenario previewed: ${sc.title}`);
    }, 1200);
  };

  const handlePlay = async () => {
    if (!activeAgentData) {
      toast.error('No agent available to execute');
      return;
    }
    setIsExecuting(true);
    const ts = now();
    setConsoleOutput(prev => [...prev, `${ts} [EXEC] Starting ${activeAgent} task execution...`]);
    try {
      const { data } = await apiClient.post('/ai/execute', { agent: activeAgent, mode: executionMode });
      if (data.success) {
        setConsoleOutput(prev => [
          ...prev,
          `${ts} [OK] Agent ${activeAgent} task dispatched successfully`,
        ]);
        addNotification({ type: 'success', message: `Agent ${activeAgent} started successfully` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent execution unavailable';
      setConsoleOutput(prev => [...prev, `${now()} [ERROR] ${message}`]);
      addNotification({ type: 'error', message: 'Agent execution is unavailable' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleStop = async () => {
    if (!activeAgentData) {
      toast.error('No agent available to stop');
      return;
    }
    setIsExecuting(true);
    const ts = now();
    setConsoleOutput(prev => [...prev, `${ts} [EXEC] Pausing ${activeAgent} agent...`]);
    try {
      await apiClient.post(`/ai/stop/${activeAgent}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent stop unavailable';
      setConsoleOutput(prev => [...prev, `${now()} [ERROR] ${message}`]);
      addNotification({ type: 'error', message: 'Agent stop control is unavailable' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRefresh = async () => {
    setIsExecuting(true);
    const ts = now();
    setConsoleOutput(prev => [...prev, `${ts} [REFRESH] Re-syncing agent topology and MCP tools...`]);
    try {
      await apiClient.get('/ai/agents');
      setConsoleOutput(prev => [...prev, `${now()} [OK] Agent fleet state synchronized.`]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent refresh unavailable';
      setConsoleOutput(prev => [...prev, `${now()} [ERROR] ${message}`]);
      addNotification({ type: 'error', message: 'Agent fleet refresh is unavailable' });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* ── Top Command HUD Banner (knockknockapp.ai standard) ── */}
      <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          {/* Left: Branding */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 via-cyan-500/20 to-emerald-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950/40">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Agent Fleet Command</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-black tracking-wider uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                  LIVE REGISTRY · SCENARIOS ARE DEMOS
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Autonomous multi-agent orchestration mesh for agricultural decision support & triage.
              </p>
            </div>
          </div>

          {/* Right: Live Telemetry Gauges & Execution Mode Switcher */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-white/70">{t('agentops_fleet')}</span>
              <span className={`${reachable === fleet.length && fleet.length > 0 ? 'text-emerald-300' : 'text-amber-300'} font-bold`}>
                {agentsLoading ? t('agentops_loading') : agentsError ? t('agentops_unavailable') : t('agentops_reachable', { reachable, total: fleet.length })}
              </span>
              {avgLoad !== null && <span className="text-white/50">· LOAD {avgLoad}%</span>}
            </div>

            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-white/70">{t('agentops_data')}</span>
              <span className="text-cyan-300 font-bold">
                {knowledgeCount ?? '—'} KB · {farmerCount ?? '—'} FARMERS · {alertsCount ?? '—'} ALERTS
              </span>
            </div>

            {/* Execution Mode Switcher */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => {
                  setExecutionMode('supervised');
                  toast.success('Mode set: Supervised Advisory');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  executionMode === 'supervised'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Supervised
              </button>
              <button
                onClick={() => {
                  setExecutionMode('autonomous');
                  toast.success('Mode set: Fully Autonomous Loop');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  executionMode === 'autonomous'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Autonomous
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 1-Click Autonomous Scenario Dispatches ── */}
      <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xxs font-mono font-bold tracking-widest text-purple-400 uppercase">
            Instant Autonomous Dispatches (1-Click Pipeline Triggers)
          </span>
          <span className="text-[10px] font-mono text-amber-300/80">Illustrative previews — no live task is created</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {AUTONOMOUS_SCENARIOS.map(sc => (
            <button
              key={sc.id}
              onClick={() => handleRunScenario(sc)}
              disabled={isExecuting}
              className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/30 text-left transition-all group flex flex-col justify-between space-y-2 disabled:opacity-50"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {sc.tag}
                  </span>
                  <Zap className="w-3 h-3 text-purple-400 group-hover:animate-bounce" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                  {sc.title}
                </h4>
                <p className="text-[11px] text-white/50 line-clamp-2 mt-1 leading-relaxed">
                  {sc.desc}
                </p>
              </div>
              <div className="text-[10px] text-purple-400 flex items-center gap-1 font-mono pt-1">
                <span>Dispatch Pipeline</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Command Grid (Registry vs Topology & Terminal) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ══════════════════════════════════════════════════════════════
            LEFT COLUMN (4 / 12 Cols): Agent Instance Registry
           ══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xxs font-mono font-bold tracking-widest text-white/50 uppercase">
              {t('agentops_registry_title', { count: fleet.length })}
            </span>
            <span className={`text-xxs font-mono ${reachable === fleet.length && fleet.length > 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
              {agentsLoading ? t('agentops_loading') : agentsError ? t('agentops_registry_unavailable') : t('agentops_reachable', { reachable, total: fleet.length })}
            </span>
          </div>

          <div className="space-y-2.5">
            {!agentsLoading && fleet.length === 0 && (
              <div className="p-4 rounded-xl border border-white/10 bg-slate-950/50 text-xs text-white/50 font-mono">
                {t('agentops_registry_empty')}
              </div>
            )}
            {fleet.map(agent => {
              const isSelected = activeAgent === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setActiveAgent(agent.id)}
                  className={`w-full p-4 rounded-xl border transition-all text-left relative group overflow-hidden ${
                    isSelected
                      ? 'bg-slate-900/90 border-purple-500/50 shadow-xl shadow-purple-950/30 ring-1 ring-purple-500/30'
                      : 'bg-slate-950/50 border-white/5 hover:bg-slate-900/60 hover:border-white/10'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-xl border ${
                        isSelected ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/10 text-white/50'
                      }`}>
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                          {agent.name}
                        </h4>
                        <p className="text-[10px] text-white/40 font-mono">{agent.role}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase ${
                      agent.status === 'running'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                        : agent.status === 'online'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : agent.status === 'unhealthy'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-white/5 text-white/40 border border-white/10'
                    }`}>
                      {agent.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed mb-3">
                    {agent.description}
                  </p>

                  {/* Reported load (backend-provided); "—" when the agent does not report it */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[10px] font-mono text-white/50">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Reported load</span>
                        <span className="text-white/80">{agent.load === null ? '—' : `${agent.load}%`}</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${agent.load ?? 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Last seen</span>
                        <span className="text-cyan-300">{agent.lastActive ? new Date(agent.lastActive).toLocaleTimeString() : '—'}</span>
                      </div>
                      <div className="text-white/40 truncate">{agent.providerType || 'runtime n/a'}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT COLUMN (8 / 12 Cols): Multi-Agent Topology & Operational Console
           ══════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Spatial Multi-Agent Topology Canvas (canvasui.dev standard) */}
          <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-white/70">
              <span className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-purple-400" />
                <span>AGENT TOPOLOGY (registry-derived; hub = first registered agent)</span>
              </span>
              <span className="text-emerald-400">Click node to inspect agent memory</span>
            </div>

            <MultiAgentTopologyCanvas
              activeAgent={activeAgent}
              fleet={fleet}
              onSelectAgent={id => {
                setActiveAgent(id);
                toast(`Inspecting: ${id}`);
              }}
            />
          </div>

          {/* Active Unit Control & Terminal Console */}
          <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {activeAgentData ? t('agentops_console_title', { name: activeAgentData.name }) : t('agentops_console_none')}
                  </h3>
                  <p className="text-[11px] font-mono text-white/50">
                    {activeAgentData
                      ? `${activeAgentData.role} · status ${activeAgentData.status}${activeAgentData.load !== null ? ` · load ${activeAgentData.load}%` : ''}`
                      : 'Agent registry unavailable'}
                  </p>
                </div>
              </div>

              {/* Console Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlay}
                  disabled={isExecuting}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40"
                >
                  {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Step Run</span>
                </button>

                <button
                  onClick={handleStop}
                  disabled={isExecuting}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={isExecuting}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 text-xs transition-all disabled:opacity-40"
                  title="Resync fleet"
                >
                  <RefreshCcw className={`w-4 h-4 ${isExecuting ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Capability & MCP Tool Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">
                  Autonomous Capabilities
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(activeAgentData?.capabilities ?? []).length === 0 && (
                    <span className="text-[10px] font-mono text-white/40">No capabilities reported</span>
                  )}
                  {(activeAgentData?.capabilities ?? []).map(cap => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">
                  {t('agentops_tools_title')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(mcpTools ?? []).length === 0 && (
                    <span className="text-[10px] font-mono text-white/40">{t('agentops_tools_unavailable')}</span>
                  )}
                  {(mcpTools ?? []).map(tool => (
                    <span
                      key={tool}
                      className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-mono"
                    >
                      {tool}()
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* High-Contrast Live Terminal Log */}
            <div className="rounded-xl bg-slate-950 border border-white/10 overflow-hidden font-mono text-xs shadow-inner">
              <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between text-[10px] text-white/40">
                <span>OPERATIONS LOG</span>
                <span className="text-white/50">{consoleOutput.length} entries</span>
              </div>
              <div className="p-4 space-y-2 max-h-56 overflow-y-auto scrollbar-hide text-xxs">
                {consoleOutput.map((line, i) => {
                  const isOk = line.includes('[OK]');
                  const isErr = line.includes('[ERROR]') || line.includes('[ERR]');
                  const isExec = line.includes('[EXEC]') || line.includes('[DISPATCH]');
                  const isHandoff = line.includes('[HANDOFF]');

                  return (
                    <div key={i} className="flex gap-2 leading-relaxed">
                      <span className="text-white/30">{line.slice(0, 8)}</span>
                      <span className={
                        isOk ? 'text-emerald-400 font-bold' :
                        isErr ? 'text-rose-400 font-bold' :
                        isExec ? 'text-cyan-300 font-bold' :
                        isHandoff ? 'text-purple-400 font-bold' :
                        'text-white/70'
                      }>
                        {line.slice(9)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlphaAgentOps;

