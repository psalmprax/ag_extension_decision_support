import React from 'react';
import { Bot, ChevronRight, Cpu, Loader2, Play, RefreshCcw, Sparkles, Square, Terminal, Workflow, Zap } from 'lucide-react';
import type { AgentData, AutonomousScenario } from './useAgentOpsController';

interface AgentOpsViewProps {
  t: (key: string, values?: Record<string, unknown>) => string;
  fleet: AgentData[];
  mcpTools?: string[];
  knowledgeCount?: number;
  farmerCount?: number;
  alertsCount?: number;
  agentsLoading: boolean;
  agentsError: boolean;
  activeAgent: string;
  setActiveAgent: (id: string) => void;
  isExecuting: boolean;
  executionMode: 'supervised' | 'autonomous' | 'edge';
  setExecutionMode: React.Dispatch<React.SetStateAction<'supervised' | 'autonomous' | 'edge'>>;
  consoleOutput: string[];
  activeAgentData?: AgentData;
  avgLoad: number | null;
  reachable: number;
  scenarios: AutonomousScenario[];
  handleRunScenario: (scenario: AutonomousScenario) => void;
  handlePlay: () => void;
  handleStop: () => void;
  handleRefresh: () => void;
  topology: React.ReactNode;
}

function statusClass(status: AgentData['status']): string {
  if (status === 'running') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (status === 'online') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  if (status === 'unhealthy') return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  return 'bg-white/5 text-white/40 border-white/10';
}

function logClass(line: string): string {
  if (line.includes('[ERROR]') || line.includes('[ERR]')) return 'text-rose-400 font-bold';
  if (line.includes('[OK]')) return 'text-emerald-400 font-bold';
  if (line.includes('[EXEC]') || line.includes('[DISPATCH]')) return 'text-cyan-300 font-bold';
  if (line.includes('[HANDOFF]')) return 'text-purple-400 font-bold';
  return 'text-white/70';
}

export const AgentOpsView: React.FC<AgentOpsViewProps> = ({
  t, fleet, mcpTools, knowledgeCount, farmerCount, alertsCount, agentsLoading, agentsError,
  activeAgent, setActiveAgent, isExecuting, executionMode, setExecutionMode, consoleOutput,
  activeAgentData, avgLoad, reachable, scenarios, handleRunScenario, handlePlay, handleStop,
  handleRefresh, topology,
}) => (
  <div className="max-w-7xl mx-auto space-y-6 pb-20">
    <section className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 sm:p-6 shadow-2xl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400"><Bot className="w-6 h-6 animate-pulse" /></div>
          <div>
            <div className="flex items-center gap-2.5"><h1 className="text-xl sm:text-2xl font-bold text-white">Agent Fleet Command</h1><span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-black uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20"><Sparkles className="w-2.5 h-2.5" /> LIVE REGISTRY</span></div>
            <p className="text-xs text-white/60 mt-0.5">Autonomous multi-agent orchestration mesh for agricultural decision support.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xxs font-mono">
          <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5"><span className="text-white/70">{t('agentops_fleet')} </span><span className="text-emerald-300 font-bold">{agentsLoading ? t('agentops_loading') : agentsError ? t('agentops_unavailable') : t('agentops_reachable', { reachable, total: fleet.length })}</span>{avgLoad !== null && <span className="text-white/50"> · LOAD {avgLoad}%</span>}</div>
          <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-cyan-300">{knowledgeCount ?? '—'} KB · {farmerCount ?? '—'} FARMERS · {alertsCount ?? '—'} ALERTS</div>
          <div className="flex bg-white/[0.04] p-1 rounded-xl border border-white/10">
            <button type="button" onClick={() => setExecutionMode('supervised')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${executionMode === 'supervised' ? 'bg-purple-600 text-white' : 'text-white/50'}`}>Supervised</button>
            <button type="button" onClick={() => setExecutionMode('autonomous')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${executionMode === 'autonomous' ? 'bg-emerald-600 text-white' : 'text-white/50'}`}>Autonomous</button>
          </div>
        </div>
      </div>
    </section>

    <section className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-xl p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between"><span className="text-xxs font-mono font-bold tracking-widest text-purple-400 uppercase">Instant Autonomous Dispatches</span><span className="text-[10px] font-mono text-amber-300/80">Illustrative previews — no live task is created</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {scenarios.map(scenario => <button type="button" key={scenario.id} onClick={() => handleRunScenario(scenario)} disabled={isExecuting} className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-purple-500/10 border border-white/5 text-left disabled:opacity-50"><div className="flex items-center justify-between mb-1.5"><span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300">{scenario.tag}</span><Zap className="w-3 h-3 text-purple-400" /></div><h4 className="text-xs font-bold text-white line-clamp-1">{scenario.title}</h4><p className="text-[11px] text-white/50 line-clamp-2 mt-1">{scenario.desc}</p><span className="text-[10px] text-purple-400 flex items-center gap-1 font-mono pt-2">Dispatch Pipeline <ChevronRight className="w-3 h-3" /></span></button>)}
      </div>
    </section>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-4 space-y-3"><div className="flex items-center justify-between px-1"><span className="text-xxs font-mono font-bold tracking-widest text-white/50 uppercase">{t('agentops_registry_title', { count: fleet.length })}</span><span className="text-xxs font-mono text-amber-300">{reachable}/{fleet.length}</span></div><div className="space-y-2.5">{!agentsLoading && fleet.length === 0 && <div className="p-4 rounded-xl border border-white/10 bg-slate-950/50 text-xs text-white/50 font-mono">{t('agentops_registry_empty')}</div>}{fleet.map(agent => <button type="button" key={agent.id} onClick={() => setActiveAgent(agent.id)} className={`w-full p-4 rounded-xl border text-left ${activeAgent === agent.id ? 'bg-slate-900/90 border-purple-500/50' : 'bg-slate-950/50 border-white/5'}`}><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-300" /><div><h4 className="text-xs font-bold text-white">{agent.name}</h4><p className="text-[10px] text-white/40 font-mono">{agent.role}</p></div></div><span className={`px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold uppercase ${statusClass(agent.status)}`}>{agent.status}</span></div><p className="text-[11px] text-white/50 line-clamp-2 mb-3">{agent.description}</p><div className="flex justify-between text-[10px] font-mono text-white/50"><span>Load {agent.load === null ? '—' : `${agent.load}%`}</span><span>{agent.lastActive ? new Date(agent.lastActive).toLocaleTimeString() : '—'}</span></div></button>)}</div></section>

      <section className="lg:col-span-8 space-y-4"><div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 shadow-2xl space-y-3"><div className="flex items-center justify-between text-xs font-mono text-white/70"><span className="flex items-center gap-2"><Workflow className="w-4 h-4 text-purple-400" /> AGENT TOPOLOGY</span><span className="text-emerald-400">Registry-derived</span></div>{topology}</div><div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 sm:p-6 shadow-2xl space-y-4"><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10"><div className="flex items-center gap-3"><Terminal className="w-5 h-5 text-purple-300" /><div><h3 className="text-sm font-bold text-white">{activeAgentData ? t('agentops_console_title', { name: activeAgentData.name }) : t('agentops_console_none')}</h3><p className="text-[11px] font-mono text-white/50">{activeAgentData?.role || 'Agent registry unavailable'}</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={handlePlay} disabled={isExecuting} className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40">{isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Step Run</button><button type="button" onClick={handleStop} disabled={isExecuting} className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"><Square className="w-3.5 h-3.5" /> Pause</button><button type="button" onClick={handleRefresh} disabled={isExecuting} className="p-1.5 rounded-xl bg-white/5 text-white/60 border border-white/10 disabled:opacity-40" title="Resync fleet"><RefreshCcw className="w-4 h-4" /></button></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div className="p-3 rounded-xl bg-slate-950/60 border border-white/5"><span className="text-[10px] font-mono font-bold text-white/40 uppercase">Autonomous Capabilities</span><div className="flex flex-wrap gap-1.5 mt-2">{activeAgentData?.capabilities.map(capability => <span key={capability} className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 text-[10px] font-mono">{capability}</span>)}</div></div><div className="p-3 rounded-xl bg-slate-950/60 border border-white/5"><span className="text-[10px] font-mono font-bold text-white/40 uppercase">{t('agentops_tools_title')}</span><div className="flex flex-wrap gap-1.5 mt-2">{(mcpTools ?? []).map(tool => <span key={tool} className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 text-[10px] font-mono">{tool}()</span>)}</div></div></div><div className="rounded-xl bg-slate-950 border border-white/10 overflow-hidden font-mono text-xs"><div className="px-4 py-2 border-b border-white/5 flex justify-between text-[10px] text-white/40"><span>OPERATIONS LOG</span><span>{consoleOutput.length} entries</span></div><div className="p-4 space-y-2 max-h-56 overflow-y-auto text-xxs">{consoleOutput.map((line, index) => <div key={`${line}-${index}`} className="flex gap-2"><span className="text-white/30">{line.slice(0, 8)}</span><span className={logClass(line)}>{line.slice(9)}</span></div>)}</div></div></div></section>
    </div>
  </div>
);
