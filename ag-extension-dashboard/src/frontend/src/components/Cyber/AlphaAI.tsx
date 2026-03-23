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
    Terminal
} from 'lucide-react';
import ActionableAI from './ActionableAI';
import AlphaAgentOps from './AlphaAgentOps';

const AlphaAI = () => {
    const [activeMode, setActiveMode] = React.useState<'actionable' | 'ops'>('actionable');

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
                                onClick={() => setActiveMode(mode.id as any)}
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
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Neural Link Active</span>
                    </div>
                    <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all">
                        <Terminal className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Mode Specific Legend / Status */}
            <div className="grid grid-cols-4 gap-4 mb-12">
                {[
                    { label: 'Compute Power', value: '42.8 TFLOPS', icon: Cpu, trend: '+12%' },
                    { label: 'Sync Fidelity', value: '99.98%', icon: ShieldCheck, trend: 'Stable' },
                    { label: 'Active Agents', value: '03', icon: Brain, trend: 'Optimal' },
                    { label: 'Data Throughput', value: '1.2 GB/s', icon: LineChart, trend: '+4.2%' },
                ].map((stat, i) => (
                    <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-3xl group hover:border-white/10 transition-all cursor-default relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <stat.icon className="w-12 h-12" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">{stat.label}</span>
                            <span className="text-[9px] font-bold text-green-400 uppercase">{stat.trend}</span>
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

            {/* Global Footer Quick Controls if any */}
            <div className="fixed bottom-8 right-8 z-50">
                <button className="p-5 bg-primary-500 rounded-2xl shadow-2xl shadow-primary-500/40 text-black hover:bg-primary-400 hover:scale-105 active:scale-95 transition-all outline outline-8 outline-primary-500/10">
                    <Search className="w-6 h-6 stroke-[3]" />
                </button>
            </div>
        </div>
    );
};

export default AlphaAI;
