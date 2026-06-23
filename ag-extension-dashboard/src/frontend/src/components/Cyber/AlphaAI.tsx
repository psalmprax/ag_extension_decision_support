import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Cpu,
    Zap, 
    ShieldCheck, 
    Search,
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

const btnClass = 'rounded-xl';
const radiusClass = 'rounded-2xl';

const SystemStatsGrid = ({ systemStats, radiusClass }: { systemStats: Array<{ icon: React.ElementType; label: string; trend: string; value: string | number }>, radiusClass: string }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {systemStats.map((stat, i) => (
            <div key={i} className={`p-6 bg-white/5 border border-white/5 ${radiusClass} group hover:border-white/10 transition-all cursor-default relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <stat.icon className="w-12 h-12" />
                </div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-micro font-black text-white/40 uppercase tracking-widest">{stat.label}</span>
                    <span className={`text-micro font-bold uppercase ${
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
);

const TerminalPanel = ({ showTerminal, setShowTerminal, terminalOutput, isTerminalLoading, terminalInput, setTerminalInput, handleTerminalCommand, radiusClass }: { showTerminal: boolean, setShowTerminal: (s: boolean) => void, terminalOutput: string[], isTerminalLoading: boolean, terminalInput: string, setTerminalInput: (s: string) => void, handleTerminalCommand: (c: string) => void, radiusClass: string }) => (
    <AnimatePresence>
        {showTerminal && (
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`mb-8 bg-black/60 border border-white/10 ${radiusClass} overflow-hidden`}
            >
                <div className="p-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-micro font-black text-white/40 uppercase tracking-widest">Terminal</span>
                    <button onClick={() => setShowTerminal(false)} className="text-white/40 hover:text-white">
                        <X className="w-3 h-3" />
                    </button>
                </div>
                <div className="p-3 max-h-40 overflow-y-auto font-mono text-xxs space-y-1">
                    {terminalOutput.map((line: string, i: number) => (
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
                        className="w-full bg-transparent text-white/80 text-xxs font-mono outline-none placeholder-white/20 px-2"
                    />
                </div>
            </motion.div>
        )}
    </AnimatePresence>
);

const useTerminal = (healthData: Record<string, unknown> | undefined) => {
    const [showTerminal, setShowTerminal] = React.useState(false);
    const [terminalInput, setTerminalInput] = React.useState('');
    const [terminalOutput, setTerminalOutput] = React.useState<string[]>(['Alpha AI Terminal v4.2 — Type "help" for commands']);
    const [isTerminalLoading, setIsTerminalLoading] = React.useState(false);

    const handleStatusCmd = async () => {
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
    };

    const handleAgentsCmd = async () => {
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
    };

    const handleTerminalCommand = async (cmd: string) => {
        const trimmed = cmd.trim().toLowerCase();
        setTerminalOutput(prev => [...prev, `> ${cmd}`]);
        
        switch (trimmed) {
            case 'help':
                setTerminalOutput(prev => [...prev, 'Commands: help, status, health, agents, uptime, clear']);
                break;
            case 'status':
            case 'health':
                await handleStatusCmd();
                break;
            case 'agents':
                await handleAgentsCmd();
                break;
            case 'uptime':
                if (healthData?.uptime) {
                    setTerminalOutput(prev => [...prev, `System uptime: ${formatUptime(healthData.uptime as number)}`]);
                } else {
                    setTerminalOutput(prev => [...prev, 'Uptime data unavailable — health endpoint not responding']);
                }
                break;
            case 'clear':
                setTerminalOutput(['Alpha AI Terminal v4.2']);
                break;
            default:
                if (trimmed) {
                    setTerminalOutput(prev => [...prev, `Unknown command: "${trimmed}". Type "help" for available commands.`]);
                }
        }
        setTerminalInput('');
    };

    return { showTerminal, setShowTerminal, terminalInput, setTerminalInput, terminalOutput, isTerminalLoading, handleTerminalCommand };
};

const TopNavigationBar = ({ modes, activeMode, setActiveMode, healthData, healthLoading, showTerminal, setShowTerminal, radiusClass, btnClass }: { modes: Array<{ id: string; name: string; icon: React.ElementType; color: string }>, activeMode: string, setActiveMode: (m: string) => void, healthData: Record<string, unknown> | undefined, healthLoading: boolean, showTerminal: boolean, setShowTerminal: (s: boolean) => void, radiusClass: string, btnClass: string }) => {
    const isHealthy = healthData?.status === 'healthy';
    const statusDotClass = isHealthy ? 'bg-green-500' : 'bg-yellow-500';

    return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-12">
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-lg shadow-lg" />
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex gap-2">
                {modes.map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => setActiveMode(mode.id as 'actionable' | 'ops')}
                        className={`px-6 py-2.5 ${btnClass} border text-xxs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
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
            <div className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 ${radiusClass}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${statusDotClass}`} />
                <span className="text-xxs font-black text-white/60 uppercase tracking-widest">
                    {isHealthy && 'System Online'}
                    {!isHealthy && healthLoading && 'Checking...'}
                    {!isHealthy && !healthLoading && 'Status Unknown'}
                </span>
            </div>
            <button
                onClick={() => setShowTerminal(!showTerminal)}
                className={`p-2.5 border ${radiusClass} transition-all ${showTerminal ? 'bg-primary-500/20 border-primary-500/30 text-primary-400' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
            >
                <Terminal className="w-5 h-5" />
            </button>
        </div>
    </div>
    );
};

const AlphaAI = () => {
    const setActiveTab = useAppStore((s) => s.setActiveTab);
    const [activeMode, setActiveMode] = React.useState<'actionable' | 'ops'>('actionable');

    const { data: healthData, isLoading: healthLoading } = useQuery({
        queryKey: ['system-health'],
        queryFn: async () => {
            const { data } = await apiClient.get('/health');
            return data;
        },
        refetchInterval: 30000,
        enabled: !!localStorage.getItem('token'),
    });

    const { showTerminal, setShowTerminal, terminalInput, setTerminalInput, terminalOutput, isTerminalLoading, handleTerminalCommand } = useTerminal(healthData);

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
            <TopNavigationBar 
                modes={modes}
                activeMode={activeMode}
                setActiveMode={setActiveMode}
                healthData={healthData}
                healthLoading={healthLoading}
                showTerminal={showTerminal}
                setShowTerminal={setShowTerminal}
                radiusClass={radiusClass}
                btnClass={btnClass}
            />

            {/* Terminal Panel */}
            <TerminalPanel
                showTerminal={showTerminal}
                setShowTerminal={setShowTerminal}
                terminalOutput={terminalOutput}
                isTerminalLoading={isTerminalLoading}
                terminalInput={terminalInput}
                setTerminalInput={setTerminalInput}
                handleTerminalCommand={handleTerminalCommand}
                radiusClass={radiusClass}
            />

            {/* Real System Health Stats */}
            <SystemStatsGrid systemStats={systemStats} radiusClass={radiusClass} />

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
                    className={`p-5 bg-primary-500 ${radiusClass} shadow-2xl shadow-primary-500/40 text-black hover:bg-primary-400 hover:scale-105 active:scale-95 transition-all outline outline-8 outline-primary-500/10`}
                >
                    <Search className="w-6 h-6 stroke-[3]" />
                </button>
            </div>
        </div>
    );
};

export default AlphaAI;
