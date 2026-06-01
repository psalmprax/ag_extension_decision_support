import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Leaf, BarChart3, Users, MapPin, Brain, Shield,
    ChevronRight, ArrowRight, Zap, Globe, Smartphone,
    Play, Search, CheckCircle, Database, FileText,
    Sun, CloudRain, Sparkles, RefreshCw, Cpu, Layers,
    Activity, ArrowUpRight
} from 'lucide-react';

// Define theme types
type DesignTheme = 'neo-saas' | 'african-harvest' | 'minimalist-tech';

interface FeatureItem {
    icon: React.ComponentType<any>;
    title: string;
    desc: string;
    metric: string;
}

export function LandingPage() {
    const navigate = useNavigate();
    const [theme, setTheme] = useState<DesignTheme>('neo-saas');

    // RAG Simulator States
    const [ragTab, setRagTab] = useState<'rag' | 'telemetry' | 'synthesis'>('rag');
    const [ragQuery, setRagQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [ragStep, setRagStep] = useState<number>(0); // 0: idle, 1: searching, 2: retrieving, 3: typing response
    const [simulatedResponse, setSimulatedResponse] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

    // Audio synthesis states
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [synthesisOutput, setSynthesisOutput] = useState<any>(null);

    // Telemetry log list
    const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
        '[15:47:01] Fetching NASA POWER Solar Radiation data... OK',
        '[15:47:02] SoilGrids v2: Clay density (fine earth) = 380 g/kg',
        '[15:47:04] Fetching current precipitation coefficients... 4.2mm/day',
        '[15:47:05] Synced 4 offline field visits to main extension store'
    ]);

    // Active farmer interactive simulation
    const [activeFarmers, setActiveFarmers] = useState(472);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveFarmers(prev => prev + (Math.random() > 0.6 ? 1 : 0));
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    // Preset questions for RAG Sandbox
    const presets = [
        {
            query: 'How do I diagnose and treat Maize Rust?',
            response: 'Common Maize Rust (Puccinia sorghi) is recognized by powdery golden-brown pustules on both leaf surfaces. \n\nTreatment: Apply triazole or strobilurin-based fungicides if incidence levels exceed 10% before silking. \n\nCultural practices: Rotate crops with non-gramineous hosts like soybeans, and manage soil nitrogen balance.',
            citations: ['FAO Technical Note 28B', 'NASA POWER Weather Index', 'IITA Diagnostic Manual']
        },
        {
            query: 'Recommend soil recovery plan for high acidity (pH 4.8).',
            response: 'A pH of 4.8 indicates severe acidity causing aluminum toxicity. \n\nRecovery Plan: 1. Apply calcitic or dolomitic agricultural lime at 2.5 tonnes/ha. 2. Incorporate green manure (e.g. Mucuna pruriens) to increase organic matter. 3. Transition to acid-tolerant cultivars (e.g., specific cassava clones or finger millet).',
            citations: ['Sub-Saharan SoilGrids v2', 'IFDC Fertilizer Strategy Report', 'CIMMYT Crop Guide']
        },
        {
            query: 'What is the rainfall forecast impact on Cassava planting in Eastern region?',
            response: 'NASA POWER model indicates a delayed start to the wet season. Soil moisture saturation currently stands at 22% (Moderate deficit). \n\nActionable Advice: Delay cassava planting by 10-14 days. Treat cuttings with agricultural ash to protect against early stem rot. Prioritize micro-dosing phosphorus during planting.',
            citations: ['NASA POWER satellite models', 'FAOSTAT Saturation Indices']
        }
    ];

    const runRagSimulation = async (index: number) => {
        if (isTyping) return;
        setSelectedPreset(index);
        setRagQuery(presets[index].query);
        setIsTyping(true);
        setSimulatedResponse('');

        // Step 1: Searching knowledge graphs
        setRagStep(1);
        await new Promise(resolve => setTimeout(resolve, 900));

        // Step 2: Retrieving chunks
        setRagStep(2);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 3: Typing response
        setRagStep(3);
        const fullResponse = presets[index].response;
        let typed = '';
        for (let i = 0; i < fullResponse.length; i += 3) {
            typed += fullResponse.substring(i, i + 3);
            setSimulatedResponse(typed);
            await new Promise(resolve => setTimeout(resolve, 15));
        }

        setIsTyping(false);
    };

    const triggerAudioSynthesis = async () => {
        if (isSynthesizing) return;
        setIsPlayingAudio(true);
        await new Promise(resolve => setTimeout(resolve, 3000));
        setIsPlayingAudio(false);
        setIsSynthesizing(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSynthesizing(false);
        setSynthesisOutput({
            crop: 'Maize & Beans',
            status: 'Alert (Nitrogen Deficit)',
            farmer: 'Emmanuel Mwangi (Machakos)',
            action: 'Dispatched automated SMS recommendation: "Apply top-dressing nitrogen urea fertilizer before next Tuesday rains."'
        });
    };

    // Style configs based on visual switcher
    const themeStyles = {
        'neo-saas': {
            bg: 'bg-slate-950 text-slate-100 selection:bg-cyan-500/30',
            font: 'font-headline tracking-tight',
            h1: 'text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500',
            buttonPrimary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-[0_0_25px_rgba(6,182,212,0.4)]',
            buttonSecondary: 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/50 text-white',
            card: 'backdrop-blur-xl bg-slate-900/40 border border-white/10 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-all duration-300',
            iconColor: 'text-cyan-400',
            subtext: 'text-slate-400',
            glow: 'shadow-[0_0_15px_rgba(6,182,212,0.35)]',
            accentText: 'text-cyan-400'
        },
        'african-harvest': {
            bg: 'bg-[#FAF6F0] text-[#2F2721] selection:bg-emerald-600/20 dark:bg-[#110D0A] dark:text-[#EFE7E0]',
            font: 'font-sans tracking-normal',
            h1: 'text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-emerald-600 to-green-700 dark:from-amber-400 dark:via-emerald-400 dark:to-green-500',
            buttonPrimary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_6px_20px_rgba(16,185,129,0.35)]',
            buttonSecondary: 'bg-white dark:bg-[#1E1714] border border-[#E3D6C9] dark:border-[#2C211C] hover:bg-[#FAF6F0] dark:hover:bg-[#2C211C] text-[#2F2721] dark:text-white',
            card: 'bg-white dark:bg-[#17120F] border border-[#ECE0D2] dark:border-[#2A201A] rounded-2xl hover:border-emerald-500/40 hover:shadow-xl transition-all duration-300',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            subtext: 'text-slate-600 dark:text-[#C5B8AC]',
            glow: 'shadow-lg',
            accentText: 'text-emerald-700 dark:text-emerald-400'
        },
        'minimalist-tech': {
            bg: 'bg-white text-black dark:bg-black dark:text-white selection:bg-neutral-800 dark:selection:bg-neutral-200',
            font: 'font-mono tracking-tighter',
            h1: 'text-5xl md:text-7xl font-bold uppercase text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500',
            buttonPrimary: 'bg-black text-white hover:bg-neutral-900 border-2 border-black dark:bg-white dark:text-black dark:border-white dark:hover:bg-neutral-100 rounded-none transition-none shadow-none',
            buttonSecondary: 'bg-transparent border-2 border-black dark:border-white text-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black rounded-none transition-none',
            card: 'bg-white dark:bg-black border-2 border-black dark:border-neutral-800 rounded-none shadow-none hover:translate-x-1.5 hover:translate-y-1.5 transition-all duration-150',
            iconColor: 'text-black dark:text-white',
            subtext: 'text-neutral-600 dark:text-neutral-400',
            glow: 'shadow-none',
            accentText: 'underline decoration-black dark:decoration-white decoration-2'
        }
    }[theme];

    const features: FeatureItem[] = [
        {
            icon: Users,
            title: 'Farmer Portfolio',
            desc: 'Aggregate crop cycles, coordinates, and fertilizer telemetry across your entire rural network.',
            metric: '482 Active Portfolios'
        },
        {
            icon: Brain,
            title: 'RAG v2 Agronomic Assistant',
            desc: 'Type diagnostic queries to search our database synced with FAO, IITA, and local extension reports.',
            metric: '98.4% Diagnostic Precision'
        },
        {
            icon: MapPin,
            title: 'Field Visit Tracker',
            desc: 'Schedule site visits, geotag soil metrics, and auto-generate follow-up advisory notes.',
            metric: 'Offline Synced Visits'
        },
        {
            icon: Activity,
            title: 'Offline Telemetry Queue',
            desc: 'Submit crop metrics offline during remote field visits; automatically uploads when connection returns.',
            metric: 'Auto-sync enabled'
        },
        {
            icon: Layers,
            title: 'SoilGrids Saturation',
            desc: 'Instantly view bulk soil density, coarse fragments, organic carbon content, and pH metrics.',
            metric: 'NASA POWER models'
        },
        {
            icon: Shield,
            title: 'Leaderboard & Analytics',
            desc: 'Compare performance matrices, yield forecasts, and report outputs across regions.',
            metric: 'PDF/Excel Ready'
        }
    ];

    return (
        <div className={`min-h-screen ${themeStyles.bg} transition-colors duration-500 overflow-x-hidden`}>
            {/* Ambient Background Glows (For SaaS and Harvest designs) */}
            {theme === 'neo-saas' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
            )}
            {theme === 'african-harvest' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-amber-500/5 via-emerald-500/5 to-transparent rounded-full blur-[100px] pointer-events-none z-0" />
            )}

            {/* Nav */}
            <nav className="relative z-20 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme === 'african-harvest' ? 'from-amber-600 to-emerald-600' : theme === 'minimalist-tech' ? 'from-neutral-900 to-neutral-400' : 'from-cyan-400 to-indigo-500'} flex items-center justify-center text-white font-bold`}>
                        <Leaf className="w-5 h-5" />
                    </div>
                    <span className={`text-xl font-bold tracking-tight ${theme === 'minimalist-tech' ? 'uppercase font-mono' : ''}`}>
                        AgExtension
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/login')}
                        className={`text-sm font-semibold transition-colors ${theme === 'minimalist-tech' ? 'font-mono hover:underline' : 'hover:text-cyan-400'}`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => navigate('/register')}
                        className={`px-5 py-2.5 text-sm font-bold ${themeStyles.buttonPrimary}`}
                    >
                        Get Started
                    </button>
                </div>
            </nav>

            {/* AESTHETIC SANDBOX BANNER */}
            <div className="relative z-20 max-w-5xl mx-auto mt-8 px-6">
                <div className="p-4 rounded-2xl glass-panel bg-white/5 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className={`w-5 h-5 ${themeStyles.iconColor} animate-pulse`} />
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider opacity-60">Aesthetic Preview Console</p>
                            <p className="text-sm">AgExtension serves diverse regions. Toggle brand themes below:</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
                        <button
                            onClick={() => setTheme('neo-saas')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${theme === 'neo-saas' ? 'bg-cyan-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
                        >
                            🌌 Neo-SaaS
                        </button>
                        <button
                            onClick={() => setTheme('african-harvest')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${theme === 'african-harvest' ? 'bg-emerald-600 text-white' : 'text-[#8e857b] hover:text-[#2F2721] dark:hover:text-white'}`}
                        >
                            🌾 Harvest Warm
                        </button>
                        <button
                            onClick={() => setTheme('minimalist-tech')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${theme === 'minimalist-tech' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}
                        >
                            🔳 Grid Tech
                        </button>
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-6 space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        <span className={`text-xs font-semibold tracking-wider uppercase opacity-80 ${theme === 'minimalist-tech' ? 'font-mono' : ''}`}>
                            v2.4 Production-Hardened
                        </span>
                    </div>

                    <h1 className={`${themeStyles.h1} leading-[1.05]`}>
                        Agricultural
                        <br />
                        Decision Support.
                        <br />
                        <span className="italic">AI-Empowered.</span>
                    </h1>

                    <p className={`text-lg leading-relaxed ${themeStyles.subtext}`}>
                        AgExtension bridges the gap between scientific remote sensing and local field expertise. 
                        Empower agricultural agents with live NASA Power metrics, SoilGrids analytics, and RAG v2 diagnostic engines — optimized for low-bandwidth zones.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={() => navigate('/register')}
                            className={`px-8 py-4 text-base font-bold flex items-center justify-center gap-2 group ${themeStyles.buttonPrimary}`}
                        >
                            Start Offline Trial
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className={`px-8 py-4 text-base font-bold flex items-center justify-center gap-2 ${themeStyles.buttonSecondary}`}
                        >
                            Review Developer Docs
                            <ArrowUpRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/5">
                        <div>
                            <p className="text-3xl font-bold font-mono tracking-tight">{activeFarmers}</p>
                            <p className="text-xs uppercase opacity-60">Farmers Enrolled</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold font-mono tracking-tight">98.4%</p>
                            <p className="text-xs uppercase opacity-60">RAG Diagnostic F1</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold font-mono tracking-tight">100%</p>
                            <p className="text-xs uppercase opacity-60">Local DB Parity</p>
                        </div>
                    </div>
                </div>

                {/* INTERACTIVE DASHBOARD & RAG SANDBOX COMPONENT */}
                <div className="lg:col-span-6">
                    <div className={`p-6 rounded-3xl glass-panel ${theme === 'minimalist-tech' ? 'border-2 border-black dark:border-white rounded-none bg-white text-black dark:bg-black dark:text-white' : 'bg-slate-900/60 border border-white/10'} relative overflow-hidden`}>
                        {/* Tab header */}
                        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-500" />
                                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                                <div className="h-3 w-3 rounded-full bg-green-500" />
                            </div>
                            <span className="text-xs font-mono opacity-50">sandbox@agextension.io</span>
                        </div>

                        {/* Interactive Tabs */}
                        <div className="flex gap-2 mb-6 bg-black/35 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setRagTab('rag')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${ragTab === 'rag' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Brain className="w-3.5 h-3.5 text-purple-400" />
                                RAG Assistant
                            </button>
                            <button
                                onClick={() => setRagTab('synthesis')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${ragTab === 'synthesis' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                                Visit Voice Synthesizer
                            </button>
                            <button
                                onClick={() => setRagTab('telemetry')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${ragTab === 'telemetry' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Database className="w-3.5 h-3.5 text-cyan-400" />
                                Soil Telemetry
                            </button>
                        </div>

                        {/* Tab Content 1: RAG Assistant Sandbox */}
                        {ragTab === 'rag' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase opacity-60">Select Agronomic Scenario:</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {presets.map((preset, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => runRagSimulation(idx)}
                                                className={`p-2.5 text-xs text-left rounded-xl transition-all border ${selectedPreset === idx ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'}`}
                                            >
                                                {preset.query}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={`p-4 rounded-2xl min-h-[160px] flex flex-col justify-between ${theme === 'minimalist-tech' ? 'bg-slate-100 text-black dark:bg-neutral-900 dark:text-white' : 'bg-black/50 border border-white/5'}`}>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                            <Sparkles className="w-4 h-4 text-purple-400 animate-spin-slow" />
                                            <span className="text-xs font-bold font-mono">Simulated RAG v2 Assistant Response:</span>
                                        </div>
                                        
                                        {ragStep === 0 && (
                                            <p className="text-xs text-slate-400 italic">Click one of the scenario queries above to test RAG assistant retrieval speeds and structural diagnosis output.</p>
                                        )}

                                        {ragStep === 1 && (
                                            <div className="flex items-center gap-2 text-xs text-cyan-400 animate-pulse">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Parsing Query Graph & Searching FAO Soil Knowledge Store...</span>
                                            </div>
                                        )}

                                        {ragStep === 2 && (
                                            <div className="flex items-center gap-2 text-xs text-purple-400 animate-pulse">
                                                <Layers className="w-3.5 h-3.5 animate-bounce" />
                                                <span>Retrieving RAG Vector Fragments & Index Rankings...</span>
                                            </div>
                                        )}

                                        {ragStep === 3 && (
                                            <p className="text-xs font-mono leading-relaxed whitespace-pre-line text-slate-200 dark:text-neutral-200">
                                                {simulatedResponse}
                                                {isTyping && <span className="animate-pulse">▮</span>}
                                            </p>
                                        )}
                                    </div>

                                    {ragStep === 3 && !isTyping && (
                                        <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex gap-2">
                                                {presets[selectedPreset || 0].citations.map((cite, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded bg-white/5 text-[9px] font-mono text-slate-400 border border-white/5">
                                                        {cite}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-green-400 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                Source Verified
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tab Content 2: Voice Synthesis Sandbox */}
                        {ragTab === 'synthesis' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-center space-y-4">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-mono text-slate-400">Audio Note Transcript Preview:</span>
                                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono text-[9px]">Offline Recorded</span>
                                    </div>
                                    <p className="text-sm font-serif italic text-slate-300">
                                        "Checked Emmanuel Mwangi's farm in Machakos. The beans look stable, but the maize leaves show significant light green discoloration. Recommended immediate check for nitrogen deficit. Dispatched a guidance advice to prepare fertilizer dressings."
                                    </p>

                                    <div className="flex justify-center gap-3">
                                        <button
                                            onClick={triggerAudioSynthesis}
                                            disabled={isPlayingAudio || isSynthesizing}
                                            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${isPlayingAudio ? 'bg-yellow-500 text-slate-900 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                                        >
                                            {isPlayingAudio ? (
                                                <>
                                                    <Activity className="w-4 h-4 animate-bounce" />
                                                    Playing Recorded Note...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4" />
                                                    Play Recorded Note
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={triggerAudioSynthesis}
                                            disabled={isPlayingAudio || isSynthesizing}
                                            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center gap-2"
                                        >
                                            {isSynthesizing ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    Synthesizing Insights...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                                    Synthesize to Dashboard
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {synthesisOutput && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3"
                                        >
                                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                                <CheckCircle className="w-4 h-4" />
                                                Synthesized Visit Entry Dispatched to Dashboard
                                            </p>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <p className="opacity-50 font-mono text-[9px] uppercase">Farmer</p>
                                                    <p className="font-semibold">{synthesisOutput.farmer}</p>
                                                </div>
                                                <div>
                                                    <p className="opacity-50 font-mono text-[9px] uppercase">Soil Assessment</p>
                                                    <p className="font-semibold text-amber-400">{synthesisOutput.status}</p>
                                                </div>
                                            </div>
                                            <div className="p-2.5 rounded bg-black/40 text-[11px] text-slate-300 font-mono">
                                                {synthesisOutput.action}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Tab Content 3: Telemetry Sandbox */}
                        {ragTab === 'telemetry' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                                        <span className="text-[10px] uppercase font-mono opacity-50 block">Bulk Density</span>
                                        <span className="text-2xl font-bold font-mono tracking-tight text-cyan-400">1.25 kg/dm³</span>
                                        <span className="text-[9px] text-emerald-400 block mt-1">Optimal aeration tier</span>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                                        <span className="text-[10px] uppercase font-mono opacity-50 block">Organic Carbon</span>
                                        <span className="text-2xl font-bold font-mono tracking-tight text-amber-500">22 g/kg</span>
                                        <span className="text-[9px] text-amber-400 block mt-1">Slight deficit (Target: 30)</span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-black/50 border border-white/5 space-y-2">
                                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                                        <span className="font-mono text-slate-400">NASA POWER Live Stream Data:</span>
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    </div>
                                    <div className="space-y-1.5 font-mono text-[10px] text-cyan-500/90 leading-relaxed">
                                        {telemetryLogs.map((log, idx) => (
                                            <p key={idx}>{log}</p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Core Features Grid */}
            <section className="max-w-7xl mx-auto px-6 py-24 relative z-10">
                <div className="text-center mb-16 space-y-4">
                    <h2 className={`text-4xl font-bold tracking-tight ${theme === 'minimalist-tech' ? 'uppercase font-mono' : ''}`}>
                        Advanced Agronomic Architecture
                    </h2>
                    <p className={`text-lg max-w-xl mx-auto ${themeStyles.subtext}`}>
                        AgExtension delivers sub-meter satellite insights and offline-first database parity inside a simple, bulletproof dashboard.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feat, idx) => (
                        <div
                            key={idx}
                            className={`p-8 rounded-3xl ${themeStyles.card} flex flex-col justify-between h-[240px]`}
                        >
                            <div className="space-y-4">
                                <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${themeStyles.glow}`}>
                                    <feat.icon className={`w-6 h-6 ${themeStyles.iconColor}`} />
                                </div>
                                <h3 className="text-lg font-bold">{feat.title}</h3>
                                <p className={`text-sm leading-relaxed opacity-75 ${themeStyles.subtext}`}>{feat.desc}</p>
                            </div>
                            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs opacity-60 font-mono">
                                <span>Status: Active</span>
                                <span>{feat.metric}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Sub-section details (How it Works) */}
            <section className="max-w-7xl mx-auto px-6 py-20 border-t border-white/5 relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <h2 className={`text-3xl font-extrabold tracking-tight ${theme === 'minimalist-tech' ? 'uppercase font-mono' : ''}`}>
                            Guaranteed Offline Synchronization.
                        </h2>
                        <p className={`text-base leading-relaxed ${themeStyles.subtext}`}>
                            Most rural extension agents work outside cellular coverage grids. AgExtension integrates a localized SQLite schema directly with browser IndexedDB, saving every report, photo, and advice request locally.
                        </p>
                        
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-sm font-semibold">
                                <CheckCircle className={`w-5 h-5 ${themeStyles.iconColor}`} />
                                Bidirectional conflict resolution strategies.
                            </li>
                            <li className="flex items-center gap-3 text-sm font-semibold">
                                <CheckCircle className={`w-5 h-5 ${themeStyles.iconColor}`} />
                                Low-bandwidth background photo compression (10x smaller uploads).
                            </li>
                            <li className="flex items-center gap-3 text-sm font-semibold">
                                <CheckCircle className={`w-5 h-5 ${themeStyles.iconColor}`} />
                                Cryptographically secure local databases with SHA-256 integrity validation.
                            </li>
                        </ul>
                    </div>

                    <div className="p-8 rounded-3xl glass-panel bg-white/5 border border-white/10 flex flex-col justify-center space-y-6">
                        <div className="flex justify-between items-center text-xs opacity-60 border-b border-white/5 pb-2">
                            <span className="font-mono">Sync Status Monitor</span>
                            <span className="text-green-400 flex items-center gap-1 font-mono">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
                                Sync Completed
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">Local SQLite Buffer Size:</span>
                                <span className="font-mono">0.0 KB (Clean)</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-2">
                                <div className="bg-cyan-500 h-2 rounded-full w-full" />
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">Last Cloud Convergence:</span>
                                <span className="font-mono">1 minute ago</span>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">Transaction Integrity:</span>
                                <span className="font-mono text-green-400">100% Validated</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Premium CTA Panel */}
            <section className="max-w-7xl mx-auto px-6 py-20 relative z-10">
                <div className={`p-12 rounded-3xl text-center space-y-8 relative overflow-hidden ${theme === 'minimalist-tech' ? 'border-2 border-black dark:border-white rounded-none bg-white text-black dark:bg-black dark:text-white' : 'bg-gradient-to-br from-slate-900 to-indigo-950/80 border border-white/10'}`}>
                    <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
                    
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight max-w-2xl mx-auto">
                        Elevate Rural Farming.
                        <br />
                        Deploy Decision Intelligence.
                    </h2>
                    
                    <p className={`text-base max-w-xl mx-auto opacity-75 ${themeStyles.subtext}`}>
                        AgExtension is ready for deployment across national agricultural agencies, non-profits, and research institutes. Sign up for a free pilot team account today.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/register')}
                            className={`px-8 py-4 text-base font-bold flex items-center justify-center gap-2 ${themeStyles.buttonPrimary}`}
                        >
                            Create Pilot Account
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className={`px-8 py-4 text-base font-bold bg-transparent border-2 border-slate-700 hover:border-slate-500 text-white rounded-2xl flex items-center justify-center gap-2`}
                        >
                            Talk to Ag-Advisors
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/5 py-12 opacity-80">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold tracking-tight">AgExtension Decision Support System</span>
                    </div>
                    <div className="text-xs opacity-60">
                        &copy; {new Date().getFullYear()} AgExtension Inc. Structured agronomic guidance, synchronized globally.
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
