import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Cpu, 
    Zap, 
    Brain, 
    LineChart, 
    ShieldCheck, 
    Search,
    ChevronRight,
    Terminal,
    X,
    Loader2,
    Activity,
    Database,
    Clock
} from 'lucide-react';
import ActionableAI from './ActionableAI';
import AlphaAgentOps from './AlphaAgentOps';
import { useAppStore } from '@/store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

const AlphaAI = () => {
    const setActiveTab = useAppStore((s) => s.setActiveTab);
    const [activeMode, setActiveMode] = React.useState<'actionable' | 'ops'>('actionable');
    const [showTerminal, setShowTerminal] = React.useState(false);
    const [terminalInput, setTerminalInput] = React.useState('');
    const [terminalOutput, setTerminalOutput] = React.useState<string[]>(['Alpha AI Terminal v4.2 — Type "help" for commands']);
    const [isTerminalLoading, setIsTerminalLoading] = React.useState(false);

    const { data: healthData, isLoading: healthLoading } = useQuery({
        queryKey: ['system-health'],
        queryFn: async () => {
            const { data } = await apiClient.get('/health');
            return data;
        },
        refetchInterval: 30000,
        enabled: !!localStorage.getItem('token'),
    });

    const modes = [
        { 
            id: 'actionable', 
            name: 'Actionable Intel', 
            icon: Zap, 
            description: 'Strategic decision support & yield optimization',
            color: 'text-primary-400',
            bg: 'bg-primary-500/10'
        },
        { 
            id: 'ops', 
            name: 'Agent Operations', 
            icon: Cpu, 
            description: 'Autonomous execution & multi-agent orchestration',
            color: 'text-secondary-400',
            bg: 'bg-secondary-500/10'
        }
    ];

    const handleTerminalCommand = async (cmd: string) => {
        const trimmed = cmd.trim().toLowerCase();
        setTerminalOutput(prev => [...prev, `> ${cmd}`]);
        
        if (trimmed === 'help') {
            setTerminalOutput(prev => [...prev, 'Commands: help, status, health, agents, uptime, clear']);
        } else if (trimmed === 'status' || trimmed === 'health') {
            setIsTerminalLoading(true);
            try {
                const { data } = await apiClient.get('/health');
                const lines = [
                    `Status: ${data.status}`,
                    `Uptime: ${formatUptime(data.uptime)}`,
                    `Database: ${data.services?.database || 'unknown'}`,
                    `Cache: ${data.services?.cache || 'unknown'}`,
                    `Environment: ${data.environment}`,
                    `Checked: ${new Date(data.timestamp).toLocaleTimeString()}`
                ];
                setTerminalOutput(prev => [...prev, ...lines]);
            } catch {
                setTerminalOutput(prev => [...prev, 'Error: Unable to reach backend health endpoint']);
            }
            setIsTerminalLoading(false);
        } else if (trimmed === 'agents') {
            setIsTerminalLoading(true);
            try {
                const { data } = await apiClient.get('/ai/status');
                if (data.success && data.data?.agents) {
                    data.data.agents.forEach((a: { name: string; status: string }) => {
                        setTerminalOutput(prev => [...prev, `${a.name}: ${a.status}`]);
                    });
                } else {
                    setTerminalOutput(prev => [...prev, 'Agent status: 3 registered (Agent Zero, Crew AI, OpenClaw)']);
                }
            } catch {
                setTerminalOutput(prev => [...prev, 'Agent status endpoint unavailable — agents registered but status unknown']);
            }
            setIsTerminalLoading(false);
        } else if (trimmed === 'uptime') {
            if (healthData?.uptime) {
                setTerminalOutput(prev => [...prev, `System uptime: ${formatUptime(healthData.uptime)}`]);
            } else {
                setTerminalOutput(prev => [...prev, 'Uptime data unavailable — health endpoint not responding']);
            }
        } else if (trimmed === 'clear') {
            setTerminalOutput(['Alpha AI Terminal v4.2']);
        } else if (trimmed) {
            setTerminalOutput(prev => [...prev, `Unknown command: "${trimmed}". Type "help" for available commands.`]);
        }
        setTerminalInput('');
    };

    const systemStats = [
        { 
            label: 'System Uptime', 
            value: healthLoading ? '...' : (healthData?.uptime ? formatUptime(healthData.uptime) : 'N/A'), 
            icon: Clock, 
            trend: healthData?.status === 'healthy' ? 'Healthy' : 'Check' 
        },
        { 
            label: 'Database', 
            value: healthLoading ? '...' : (healthData?.services?.database || 'Unknown'), 
            icon: Database, 
            trend: healthData?.services?.database === 'connected' ? 'Online' : 'Offline' 
        },
        { 
            label: 'Cache Layer', 
            value: healthLoading ? '...' : (healthData?.services?.cache || 'Unknown'), 
            icon: ShieldCheck, 
            trend: healthData?.services?.cache === 'connected' ? 'Active' : 'Down' 
        },
        { 
            label: 'System Status', 
            value: healthLoading ? '...' : (healthData?.status || 'Unknown'), 
            icon: Activity, 
            trend: healthData?.environment || '—' 
        },
    ];

    return (
        <div className="min-h-screen bg-black text-white p-8 custom-scrollbar">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-[0.2em] leading-none">Alpha AI</h1>
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1">Core Intelligence Core v4.2</p>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="flex gap-2">
                        {modes.map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setActiveMode(mode.id as 'actionable' | 'ops')}
                                className={`px-6 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                    activeMode === mode.id
                                        ? 'bg-white/10 border-white/20 text-white shadow-xl'
                                        : 'bg-transparent border-transparent text-white/40 hover:text-white/60'
                                }`}
                            >
                                <mode.icon className={`w-4 h-4 ${activeMode === mode.id ? mode.color : 'text-white/20'}`} />
                                {mode.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${healthData?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                            {healthData?.status === 'healthy' ? 'System Online' : healthLoading ? 'Checking...' : 'Status Unknown'}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowTerminal(!showTerminal)}
                        className={`p-2.5 border rounded-xl transition-all ${showTerminal ? 'bg-primary-500/20 border-primary-500/30 text-primary-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
                    >
                        <Terminal className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Terminal Panel */}
            <AnimatePresence>
                {showTerminal && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-8 bg-black/60 border border-white/10 rounded-2xl overflow-hidden"
                    >
                        <div className="p-3 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Terminal</span>
                            <button onClick={() => setShowTerminal(false)} className="text-white/40 hover:text-white">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="p-3 max-h-40 overflow-y-auto font-mono text-[10px] space-y-1">
                            {terminalOutput.map((line, i) => (
                                <div key={i} className={line.startsWith('>') ? 'text-primary-400' : 'text-white/60'}>
                                    {line}
                                </div>
                            ))}
                            {isTerminalLoading && (
                                <div className="flex items-center gap-2 text-white/40">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Fetching...</span>
                                </div>
                            )}
                        </div>
                        <div className="p-2 border-t border-white/5">
                            <input
                                type="text"
                                value={terminalInput}
                                onChange={(e) => setTerminalInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleTerminalCommand(terminalInput); }}
                                placeholder="Type a command (help, status, agents, uptime, clear)..."
                                className="w-full bg-transparent text-white/80 text-[10px] font-mono outline-none placeholder-white/20 px-2"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Real System Health Stats */}
            <div className="grid grid-cols-4 gap-4 mb-12">
                {systemStats.map((stat, i) => (
                    <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-3xl group hover:border-white/10 transition-all cursor-default relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <stat.icon className="w-12 h-12" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{stat.label}</span>
                            <span className={`text-[9px] font-bold uppercase ${
                                stat.trend === 'Healthy' || stat.trend === 'Online' || stat.trend === 'Active' 
                                    ? 'text-green-400' 
                                    : stat.trend === 'Check' || stat.trend === 'Offline' || stat.trend === 'Down'
                                        ? 'text-orange-400'
                                        : 'text-white/40'
                            }`}>{stat.trend}</span>
                        </div>
                        <div className="text-xl font-black">{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Dynamic Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeMode}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {activeMode === 'actionable' ? <ActionableAI /> : <AlphaAgentOps />}
                </motion.div>
            </AnimatePresence>

            {/* Global Footer Quick Controls */}
            <div className="fixed bottom-8 right-8 z-50">
                <button
                    onClick={() => setActiveTab('knowledge')}
                    className="p-5 bg-primary-500 rounded-2xl shadow-2xl shadow-primary-500/40 text-black hover:bg-primary-400 hover:scale-105 active:scale-95 transition-all outline outline-8 outline-primary-500/10"
                >
                    <Search className="w-6 h-6 stroke-[3]" />
                </button>
            </div>
        </div>
    );
};

export default AlphaAI;
