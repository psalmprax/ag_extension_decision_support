import React from 'react';
import { motion } from 'framer-motion';
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
    AlertCircle
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const AlphaAgentOps = () => {
    const { t } = useLanguage();
    const [activeAgent, setActiveAgent] = React.useState<'agent-zero' | 'crew-ai' | 'openclaw'>('agent-zero');

    const agents = [
        { 
            id: 'agent-zero', 
            name: 'Agent Zero', 
            status: 'online', 
            icon: Cpu, 
            description: 'Autonomous task execution & tool calling',
            capabilities: ['Farmer Outreach', 'Data Collection', 'Weather Monitoring'],
            load: 42
        },
        { 
            id: 'crew-ai', 
            name: 'Crew AI', 
            status: 'idle', 
            icon: Layers, 
            description: 'Multi-agent orchestration workflows',
            capabilities: ['Market Analysis', 'Crop Disease Diagnosis', 'Policy Research'],
            load: 0
        },
        { 
            id: 'openclaw', 
            name: 'OpenClaw', 
            status: 'online', 
            icon: Terminal, 
            description: 'Automated code & system refactoring',
            capabilities: ['Bug Fixes', 'Unit Testing', 'Doc Gen'],
            load: 12
        }
    ];

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
                    <p className="text-[10px] font-bold text-primary-400/60 uppercase tracking-widest pl-12">
                        Neural Orchestration & Autonomous Logistics
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-3 h-3 text-secondary-400" />
                            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">System Load</span>
                        </div>
                        <div className="text-lg font-black text-white">18.4 <span className="text-xs text-white/40">GFLOPs</span></div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-8 mt-8">
                {/* Agent Selection Sidebar */}
                <div className="col-span-4 space-y-4">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Instance Registry</h3>
                    {agents.map((agent) => (
                        <button
                            key={agent.id}
                            onClick={() => setActiveAgent(agent.id as any)}
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
                                    <agent.icon className={`w-5 h-5 ${activeAgent === agent.id ? 'text-primary-400' : 'text-white/40'}`} />
                                </div>
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                    agent.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/40'
                                }`}>
                                    <div className={`w-1 h-1 rounded-full ${agent.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                                    {agent.status}
                                </div>
                            </div>
                            <div className="font-black text-white uppercase tracking-wider mb-1">{agent.name}</div>
                            <div className="text-[10px] text-white/40 font-medium leading-relaxed">{agent.description}</div>
                            
                            {/* Simple Load Indicator */}
                            {agent.load > 0 && (
                                <div className="mt-3 space-y-1">
                                    <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-white/20">
                                        <span>Allocated Compute</span>
                                        <span>{agent.load}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary-400/40" style={{ width: `${agent.load}%` }} />
                                    </div>
                                </div>
                            )}
                        </button>
                    ))}
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
                                <button className="p-3 bg-primary-500/20 border border-primary-500/30 rounded-xl text-primary-400 hover:bg-primary-500/30 transition-all">
                                    <Play className="w-5 h-5" />
                                </button>
                                <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:bg-white/10 transition-all">
                                    <Square className="w-5 h-5" />
                                </button>
                                <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:bg-white/10 transition-all">
                                    <RefreshCcw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Capability Matrix */}
                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="space-y-4">
                                <h5 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Active Capabilities</h5>
                                <div className="space-y-2">
                                    {agents.find(a => a.id === activeAgent)?.capabilities.map((cap) => (
                                        <div key={cap} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-default">
                                            <div className="w-2 h-2 rounded-full bg-primary-400/40" />
                                            <span className="text-xs font-bold text-white/80">{cap}</span>
                                            <ChevronRight className="w-3 h-3 ml-auto text-white/20" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-primary-500/5 rounded-3xl border border-primary-500/10 p-6 flex flex-col justify-center items-center text-center">
                                <CloudLightning className="w-12 h-12 text-primary-400/20 mb-4" />
                                <div className="text-[10px] font-black text-primary-400 uppercase tracking-[0.2em] mb-2">Neural Link Status</div>
                                <div className="text-2xl font-black text-white">99.9% <span className="text-sm text-white/40">Sync</span></div>
                                <p className="text-[9px] text-white/40 mt-2 uppercase tracking-tight">LATENCY: 14ms | BANDWIDTH: 4.2GB/s</p>
                            </div>
                        </div>

                        {/* Recent Activity Log */}
                        <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                            <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Runtime History</span>
                                <Terminal className="w-3 h-3 text-white/40" />
                            </div>
                            <div className="p-4 space-y-3 font-mono text-[10px]">
                                <div className="flex gap-3">
                                    <span className="text-white/20">16:42:10</span>
                                    <span className="text-primary-400">[SYSTEM]</span>
                                    <span className="text-white/60">Initialized {activeAgent} instance v2.4.1</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-white/20">16:42:45</span>
                                    <span className="text-green-400">[QUERY]</span>
                                    <span className="text-white/60">Regional market price database queried for Maize/Oromo</span>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-white/20">16:43:02</span>
                                    <span className="text-secondary-400">[AUTH]</span>
                                    <span className="text-white/60">Extension Officer (ID: 4421) authorized for outreach</span>
                                </div>
                                <div className="flex gap-3 animate-pulse">
                                    <span className="text-white/20">16:43:20</span>
                                    <span className="text-primary-400">[PROC]</span>
                                    <span className="text-white/60">Processing autonomous decision tree for harvest logistics...</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Banner */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-black/40 border border-white/10 rounded-2xl flex items-center gap-4">
                            <div className="p-2 bg-secondary-500/20 rounded-lg">
                                <Database className="w-5 h-5 text-secondary-400" />
                            </div>
                            <div>
                                <div className="text-[8px] font-black text-white/40 uppercase tracking-widest">Knowledge Base</div>
                                <div className="text-sm font-black text-white">12.4K <span className="text-[10px] text-white/40">Docs</span></div>
                            </div>
                        </div>
                        <div className="p-4 bg-black/40 border border-white/10 rounded-2xl flex items-center gap-4">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <Search className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <div className="text-[8px] font-black text-white/40 uppercase tracking-widest">Active Discovery</div>
                                <div className="text-sm font-black text-white">4 <span className="text-[10px] text-white/40">Nodes</span></div>
                            </div>
                        </div>
                        <div className="p-4 bg-black/40 border border-orange-500/20 rounded-2xl flex items-center gap-4">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <div className="text-[8px] font-black text-white/40 uppercase tracking-widest">Anomalies</div>
                                <div className="text-sm font-black text-white">0 <span className="text-[10px] text-white/40">Detected</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlphaAgentOps;
