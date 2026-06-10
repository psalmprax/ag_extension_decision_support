import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import {
    Leaf, Users, MapPin, Brain, BarChart3, Shield,
    ArrowRight, CheckCircle, XCircle, Globe,
    Zap, Database, ChevronRight, TrendingUp, FileText,
    Building2, GraduationCap, Heart, Bell, Search,
    CloudRain, Droplets, Thermometer, Activity, Wifi,
    ChevronDown, Play
} from 'lucide-react';

// ─── Animation variants ─────────────────────────────────────────
const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } }
};

const fadeUp = {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
};

const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.8 } }
};

// ─── Data ───────────────────────────────────────────────────────
const painPoints = [
    { problem: 'Paper-based field visit records lost or delayed by weeks', solution: 'Digital visit logs synced in real time, even offline' },
    { problem: 'Guesswork recommendations with no soil or weather data', solution: 'NASA POWER weather + SoilGrids soil data in every decision' },
    { problem: 'No visibility into officer performance or farmer outcomes', solution: 'Live analytics dashboard with per-officer metrics' },
    { problem: 'Crop diseases identified too late, after spread', solution: 'AI disease diagnosis from photos, treatment in minutes' },
];

const features = [
    { icon: Users, title: 'Farmer Portfolio', desc: 'Manage your entire farmer network with real-time vital scores, crop data, and soil analytics in one unified view.', highlight: true },
    { icon: Brain, title: 'AI Assistant', desc: 'Instant agronomic advice powered by RAG with citations, knowledge graphs, and re-ranked results.' },
    { icon: MapPin, title: 'Field Visits', desc: 'Schedule, track, and synthesize field visits with AI-powered note analysis and follow-up automation.' },
    { icon: TrendingUp, title: 'Analytics & Reports', desc: 'Track officer performance, farmer outcomes, and generate executive reports with one click.' },
    { icon: Shield, title: 'Disease Diagnosis', desc: 'AI-powered crop disease identification with treatment recommendations from the knowledge base.' },
    { icon: Database, title: 'Knowledge Base', desc: 'FAOSTAT data, NASA POWER weather, SoilGrids properties — all searchable with AI-powered RAG.' },
];

const steps = [
    { num: '01', title: 'Register Farmers', desc: 'Add farmers with GPS coordinates, crop data, soil info, and contact details. Bulk import supported.' },
    { num: '02', title: 'Track & Visit', desc: 'Schedule field visits, record observations, capture photos, and log follow-up actions from any device.' },
    { num: '03', title: 'Analyze & Act', desc: 'AI surfaces insights, predicts risks, recommends actions, and generates reports for stakeholders.' },
];

const audiences = [
    { icon: Building2, title: 'Government Agencies', desc: 'National and regional agricultural ministries scaling extension services across districts.' },
    { icon: GraduationCap, title: 'NGOs & Development Orgs', desc: 'World Bank, FAO, AGRA, and field partners running agricultural improvement programs.' },
    { icon: Heart, title: 'Cooperatives & Agribusiness', desc: 'Farmer cooperatives and agribusiness companies managing contract farming at scale.' },
];

const africaNodes = [
    { x: 52, y: 28, label: 'Kenya' },
    { x: 42, y: 42, label: 'Nigeria' },
    { x: 55, y: 45, label: 'Tanzania' },
    { x: 48, y: 35, label: 'Uganda' },
    { x: 35, y: 38, label: 'Ghana' },
    { x: 60, y: 55, label: 'Mozambique' },
    { x: 28, y: 32, label: 'Senegal' },
    { x: 50, y: 52, label: 'Zambia' },
];

// ─── Animated counter hook ──────────────────────────────────────
function useCounter(end: number, duration: number = 2000, inView: boolean = false) {
    const [count, setCount] = useState(0);
    const started = useRef(false);

    useEffect(() => {
        if (!inView || started.current) return;
        started.current = true;
        const start = performance.now();
        const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [inView, end, duration]);

    return count;
}

// ─── Sparkline component ────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <defs>
                <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <polygon
                points={`0,${height} ${points} ${width},${height}`}
                fill={`url(#spark-${color})`}
            />
        </svg>
    );
}

// ─── Africa SVG visualization ───────────────────────────────────
function AfricaVisualization() {
    return (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-[0.06] pointer-events-none hidden xl:block">
            <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Simplified Africa outline */}
                <path
                    d="M45,8 C48,7 52,8 54,10 C56,12 57,15 56,18 C55,20 58,22 60,24 C62,26 63,28 62,30 C61,32 63,34 64,36 C65,38 66,42 65,46 C64,50 62,54 60,58 C58,62 56,66 54,70 C52,74 50,78 48,80 C46,82 44,84 42,82 C40,80 38,76 36,72 C34,68 32,64 30,60 C28,56 26,52 25,48 C24,44 24,40 25,36 C26,32 27,28 28,24 C29,20 30,16 32,14 C34,12 38,10 42,9 Z"
                    fill="none"
                    stroke="rgba(16,185,129,0.4)"
                    strokeWidth="0.3"
                />
                {/* Connection lines between nodes */}
                {africaNodes.map((node, i) =>
                    africaNodes.slice(i + 1).map((other, j) => (
                        <line
                            key={`${i}-${j}`}
                            x1={node.x} y1={node.y}
                            x2={other.x} y2={other.y}
                            stroke="rgba(16,185,129,0.15)"
                            strokeWidth="0.15"
                            strokeDasharray="1,1"
                        />
                    ))
                )}
                {/* Pulsing nodes */}
                {africaNodes.map((node, i) => (
                    <g key={i}>
                        <circle cx={node.x} cy={node.y} r="1.5" fill="rgba(16,185,129,0.6)">
                            <animate attributeName="r" values="1.5;3;1.5" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.6;0.2;0.6" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                        </circle>
                        <circle cx={node.x} cy={node.y} r="0.6" fill="rgba(16,185,129,0.9)" />
                    </g>
                ))}
            </svg>
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────
export function LandingPage() {
    const navigate = useNavigate();
    const heroRef = useRef<HTMLDivElement>(null);
    const statsRef = useRef<HTMLDivElement>(null);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springX = useSpring(mouseX, { stiffness: 150, damping: 15 });
    const springY = useSpring(mouseY, { stiffness: 150, damping: 15 });

    const [statsInView, setStatsInView] = useState(false);

    // Scroll-driven transforms
    const { scrollYProgress } = useScroll();
    const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.6]);

    // Animated counters
    const farmerCount = useCounter(2847, 2000, statsInView);
    const visitCount = useCounter(12400, 2000, statsInView);
    const countryCount = useCounter(12, 1500, statsInView);

    // Cursor spotlight
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = heroRef.current?.getBoundingClientRect();
        if (!rect) return;
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
    }, [mouseX, mouseY]);

    // Intersection observer for stats
    useEffect(() => {
        const el = statsRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setStatsInView(true); },
            { threshold: 0.3 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-[#060b08] text-white overflow-x-hidden">
            {/* ── CSS for mesh animation ── */}
            <style>{`
                @keyframes meshShift {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    25% { transform: translate(30px, -20px) scale(1.05); }
                    50% { transform: translate(-20px, 30px) scale(0.95); }
                    75% { transform: translate(10px, 10px) scale(1.02); }
                }
                @keyframes meshShift2 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(-40px, 20px) scale(1.08); }
                    66% { transform: translate(20px, -30px) scale(0.96); }
                }
                @keyframes meshShift3 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(25px, 25px) scale(1.04); }
                }
                .mesh-orb-1 { animation: meshShift 12s ease-in-out infinite; }
                .mesh-orb-2 { animation: meshShift2 15s ease-in-out infinite; }
                .mesh-orb-3 { animation: meshShift3 10s ease-in-out infinite; }
            `}</style>

            {/* ── NAV ── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#060b08]/60 backdrop-blur-2xl border-b border-white/[0.04]">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Leaf className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">AgExtension</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#problem" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Why Us</a>
                        <a href="#features" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="text-sm font-medium text-white/50 hover:text-white transition-colors">How It Works</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/login')} className="text-sm font-medium text-white/60 hover:text-white transition-colors">
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            className="px-4 py-2 text-sm font-semibold bg-white/[0.08] border border-white/[0.08] text-white rounded-lg hover:bg-white/[0.14] transition-all backdrop-blur-sm"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section
                ref={heroRef}
                onMouseMove={handleMouseMove}
                className="relative min-h-screen flex items-center pt-16 overflow-hidden"
            >
                {/* Animated mesh gradient background */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="mesh-orb-1 absolute top-[-30%] left-[-15%] w-[700px] h-[700px] rounded-full bg-emerald-600/[0.08] blur-[150px]" />
                    <div className="mesh-orb-2 absolute bottom-[-25%] right-[-15%] w-[600px] h-[600px] rounded-full bg-amber-500/[0.06] blur-[120px]" />
                    <div className="mesh-orb-3 absolute top-[30%] left-[40%] w-[400px] h-[400px] rounded-full bg-emerald-400/[0.04] blur-[100px]" />
                    <div className="mesh-orb-2 absolute top-[60%] left-[-5%] w-[300px] h-[300px] rounded-full bg-teal-500/[0.04] blur-[80px]" />
                </div>

                {/* Cursor spotlight */}
                <motion.div
                    className="absolute w-[600px] h-[600px] rounded-full pointer-events-none z-[1]"
                    style={{
                        x: springX,
                        y: springY,
                        translateX: '-50%',
                        translateY: '-50%',
                        background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
                    }}
                />

                {/* Grid pattern */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.025]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />

                {/* Africa visualization */}
                <AfricaVisualization />

                <motion.div
                    style={{ y: heroY, opacity: heroOpacity }}
                    className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center relative z-10"
                >
                    {/* Left copy */}
                    <motion.div
                        initial="hidden" animate="visible" variants={stagger}
                        className="space-y-8"
                    >
                        <motion.div variants={fadeUp} className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-white/60">Agricultural decision support platform</span>
                        </motion.div>

                        <motion.h1 variants={fadeUp} className="text-[clamp(2.8rem,5.5vw,4.2rem)] font-bold leading-[1.02] tracking-tight">
                            Smarter Farming
                            <br />
                            Starts with{' '}
                            <span className="relative inline-block">
                                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-400 bg-clip-text text-transparent">
                                    Better Data
                                </span>
                                <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full opacity-40" />
                            </span>
                        </motion.h1>

                        <motion.p variants={fadeUp} className="text-lg text-white/40 leading-relaxed max-w-lg">
                            Empower extension officers with AI-driven insights, real-time farmer tracking, and data-powered decisions across Africa.
                        </motion.p>

                        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => navigate('/register')}
                                className="group px-7 py-3.5 text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                            >
                                Start Free Trial
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/demo')}
                                className="group px-7 py-3.5 text-sm font-semibold bg-white/[0.05] border border-white/[0.08] text-white/80 rounded-xl hover:bg-white/[0.1] hover:text-white transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                            >
                                <Play className="w-4 h-4 text-emerald-400" />
                                Try Live Demo
                            </button>
                        </motion.div>

                        {/* Mini stats */}
                        <motion.div variants={fadeUp} className="flex gap-8 pt-2">
                            {[
                                { value: '12', label: 'Countries' },
                                { value: '2,847', label: 'Farmers' },
                                { value: '99.9%', label: 'Uptime' },
                            ].map((s, i) => (
                                <div key={i}>
                                    <div className="text-xl font-bold text-white/90">{s.value}</div>
                                    <div className="text-xs text-white/25 mt-0.5">{s.label}</div>
                                </div>
                            ))}
                        </motion.div>
                    </motion.div>

                    {/* Right — Detailed dashboard mockup */}
                    <motion.div
                        initial="hidden" animate="visible" variants={scaleIn}
                        className="relative"
                    >
                        {/* Glow behind mockup */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-amber-500/10 blur-[60px] rounded-full scale-90" />

                        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0a100d] shadow-2xl shadow-black/60 transform perspective-[1200px] rotate-y-[2deg] -rotate-x-[1deg] hover:rotate-y-0 hover:rotate-x-0 transition-transform duration-700">
                            {/* Window chrome */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                                </div>
                                <div className="flex-1 flex justify-center">
                                    <div className="px-3 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-white/25 font-mono">
                                        app.gpexts.com/dashboard
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Bell className="w-3 h-3 text-white/20" />
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[7px] font-bold">A</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-[170px_1fr] min-h-[380px]">
                                {/* Sidebar */}
                                <div className="bg-white/[0.015] border-r border-white/[0.05] p-2.5 text-[10px] space-y-0.5">
                                    <div className="px-2.5 py-1.5 mb-2">
                                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.1] text-emerald-400 font-medium text-[10px]">
                                            <BarChart3 className="w-3 h-3" />
                                            Dashboard
                                        </div>
                                    </div>
                                    {[
                                        { icon: Users, label: 'Farmers', count: '2,847' },
                                        { icon: MapPin, label: 'Visits', count: '156' },
                                        { icon: Brain, label: 'AI Assistant' },
                                        { icon: TrendingUp, label: 'Analytics' },
                                        { icon: Shield, label: 'Diseases', count: '3' },
                                        { icon: FileText, label: 'Reports' },
                                        { icon: Database, label: 'Knowledge' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-white/25 hover:text-white/40 hover:bg-white/[0.02] transition-all cursor-default">
                                            <div className="flex items-center gap-2">
                                                <item.icon className="w-3 h-3" />
                                                {item.label}
                                            </div>
                                            {item.count && <span className="text-[8px] text-white/15 bg-white/[0.04] px-1.5 py-0.5 rounded-full">{item.count}</span>}
                                        </div>
                                    ))}
                                </div>

                                {/* Main content */}
                                <div className="p-3 bg-white/[0.005] space-y-2.5">
                                    {/* Welcome bar */}
                                    <div className="flex items-center justify-between mb-1">
                                        <div>
                                            <div className="text-[11px] font-semibold text-white/70">Good morning, Amina</div>
                                            <div className="text-[9px] text-white/25">Here's what's happening across your network</div>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/[0.08] text-emerald-400 text-[9px] font-medium">
                                            <Wifi className="w-2.5 h-2.5" />
                                            All Systems Online
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { value: '2,847', label: 'Farmers', change: '+12%', color: '#10b981', sparkData: [20, 25, 22, 30, 28, 35, 32, 40, 38, 45] },
                                            { value: '156', label: 'Visits', change: '+8%', color: '#10b981', sparkData: [10, 15, 12, 18, 20, 16, 22, 25, 20, 28] },
                                            { value: '92%', label: 'Health', change: '+3%', color: '#f59e0b', sparkData: [85, 87, 86, 88, 90, 89, 91, 90, 92, 92] },
                                            { value: '4.2mm', label: 'Rain/day', change: 'Normal', color: '#3b82f6', sparkData: [3, 4, 5, 3, 4, 6, 5, 4, 3, 4] },
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-white/[0.025] rounded-lg p-2.5 border border-white/[0.04]">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[14px] font-bold text-white/85">{stat.value}</span>
                                                    <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: stat.color, background: `${stat.color}15` }}>{stat.change}</span>
                                                </div>
                                                <div className="text-[8px] text-white/25 uppercase tracking-wider mb-1.5">{stat.label}</div>
                                                <Sparkline data={stat.sparkData} color={stat.color} width={60} height={18} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Chart + Activity */}
                                    <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                                        {/* Chart */}
                                        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[9px] font-semibold text-white/45">Farmer Growth</span>
                                                <span className="text-[8px] text-white/15">Last 12 months</span>
                                            </div>
                                            <div className="flex items-end gap-1 h-20">
                                                {[20, 28, 24, 35, 30, 42, 38, 50, 45, 58, 52, 65].map((h, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-100"
                                                        style={{
                                                            height: `${h}%`,
                                                            background: i === 11
                                                                ? 'linear-gradient(to top, #D97706, #F59E0B)'
                                                                : `linear-gradient(to top, rgba(16,185,129,${0.2 + i * 0.04}), rgba(16,185,129,${0.4 + i * 0.03}))`,
                                                            opacity: i === 11 ? 1 : 0.6 + i * 0.03,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex justify-between mt-1.5 text-[7px] text-white/15">
                                                <span>Jan</span><span>Mar</span><span>Jun</span><span>Sep</span><span>Dec</span>
                                            </div>
                                        </div>

                                        {/* Activity feed */}
                                        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
                                            <div className="text-[9px] font-semibold text-white/45 mb-2">Recent Activity</div>
                                            <div className="space-y-2">
                                                {[
                                                    { icon: MapPin, text: 'Visit: Amina Okafor', time: '2m ago', color: 'text-emerald-400' },
                                                    { icon: Brain, text: 'AI: Soil analysis ready', time: '15m ago', color: 'text-purple-400' },
                                                    { icon: Shield, text: 'Alert: Rust detected', time: '1h ago', color: 'text-amber-400' },
                                                    { icon: Users, text: 'New farmer: J. Mensah', time: '3h ago', color: 'text-blue-400' },
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <item.icon className={`w-3 h-3 ${item.color} flex-shrink-0 mt-0.5`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[9px] text-white/50 truncate">{item.text}</div>
                                                            <div className="text-[7px] text-white/20">{item.time}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Farmer list */}
                                    <div className="space-y-1">
                                        {[
                                            { name: 'Amina Okafor', initials: 'AO', color: 'from-emerald-400 to-emerald-600', crop: 'Maize & Beans', status: 'Active', statusBg: 'bg-emerald-500/10 text-emerald-400', health: 94 },
                                            { name: 'Joseph Mensah', initials: 'JM', color: 'from-amber-400 to-amber-600', crop: 'Cassava', status: 'Review', statusBg: 'bg-amber-500/10 text-amber-400', health: 78 },
                                            { name: 'Ngozi Kalu', initials: 'NK', color: 'from-orange-400 to-orange-600', crop: 'Rice & Millet', status: 'Active', statusBg: 'bg-emerald-500/10 text-emerald-400', health: 88 },
                                        ].map((f, i) => (
                                            <div key={i} className="flex items-center gap-2.5 bg-white/[0.015] rounded-lg px-2.5 py-1.5 border border-white/[0.03] text-[10px]">
                                                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${f.color} flex items-center justify-center text-white text-[7px] font-bold`}>
                                                    {f.initials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-medium text-white/60 block truncate">{f.name}</span>
                                                    <span className="text-[8px] text-white/20">{f.crop}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${f.health}%`, background: f.health > 85 ? '#10b981' : f.health > 70 ? '#f59e0b' : '#ef4444' }} />
                                                    </div>
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-semibold ${f.statusBg}`}>{f.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Bottom fade */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060b08] to-transparent pointer-events-none z-20" />

                {/* Scroll indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
                >
                    <span className="text-[10px] text-white/20 uppercase tracking-widest">Scroll</span>
                    <ChevronDown className="w-4 h-4 text-white/20 animate-bounce" />
                </motion.div>
            </section>

            {/* ── PROBLEM / SOLUTION ── */}
            <section id="problem" className="relative py-28 border-t border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-6">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
                        className="text-center mb-16"
                    >
                        <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/70 mb-4">
                            Why AgExtension
                        </motion.div>
                        <motion.h2 variants={fadeUp} className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight leading-tight">
                            The old way isn't{' '}
                            <span className="bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">working</span>
                        </motion.h2>
                    </motion.div>

                    <div className="space-y-3">
                        {painPoints.map((item, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
                                variants={fadeUp}
                                className="grid md:grid-cols-2 gap-3"
                            >
                                <div className="flex items-start gap-3 p-5 rounded-xl bg-red-500/[0.03] border border-red-500/[0.06] hover:border-red-500/[0.12] transition-colors">
                                    <XCircle className="w-4 h-4 text-red-400/60 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm text-white/40 leading-relaxed">{item.problem}</span>
                                </div>
                                <div className="flex items-start gap-3 p-5 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/[0.06] hover:border-emerald-500/[0.12] transition-colors">
                                    <CheckCircle className="w-4 h-4 text-emerald-400/60 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm text-white/60 leading-relaxed">{item.solution}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section id="features" className="relative py-28 border-t border-white/[0.04]">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
                        className="mb-16"
                    >
                        <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/70 mb-4">
                            Features
                        </motion.div>
                        <motion.h2 variants={fadeUp} className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight leading-tight max-w-lg">
                            Built for the realities of{' '}
                            <span className="text-white/35">African agriculture</span>
                        </motion.h2>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {features.map((feat, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
                                variants={fadeUp}
                                className={`group relative p-7 rounded-2xl bg-white/[0.015] border border-white/[0.04] hover:border-emerald-500/20 hover:bg-white/[0.03] transition-all duration-500 overflow-hidden ${
                                    feat.highlight ? 'lg:col-span-2 lg:row-span-2 lg:p-10' : ''
                                }`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="relative z-10">
                                    <div className={`rounded-xl bg-white/[0.04] border border-white/[0.05] flex items-center justify-center mb-5 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all duration-500 ${
                                        feat.highlight ? 'w-14 h-14 mb-7' : 'w-11 h-11'
                                    }`}>
                                        <feat.icon className={`text-white/40 group-hover:text-emerald-400 transition-colors duration-500 ${
                                            feat.highlight ? 'w-7 h-7' : 'w-5 h-5'
                                        }`} />
                                    </div>
                                    <h3 className={`font-bold mb-2 text-white/85 ${feat.highlight ? 'text-xl mb-3' : 'text-base'}`}>{feat.title}</h3>
                                    <p className={`text-white/30 leading-relaxed group-hover:text-white/40 transition-colors duration-500 ${
                                        feat.highlight ? 'text-base max-w-md' : 'text-sm'
                                    }`}>{feat.desc}</p>

                                    {feat.highlight && (
                                        <div className="mt-8 pt-6 border-t border-white/[0.04] grid grid-cols-3 gap-4">
                                            {[
                                                { val: 'Real-time', label: 'Sync' },
                                                { val: 'Offline', label: 'First' },
                                                { val: 'GPS', label: 'Enabled' },
                                            ].map((s, j) => (
                                                <div key={j}>
                                                    <div className="text-sm font-bold text-emerald-400">{s.val}</div>
                                                    <div className="text-[10px] text-white/20 uppercase tracking-wider">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section id="how-it-works" className="relative py-28 border-t border-white/[0.04]">
                <div className="max-w-5xl mx-auto px-6">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
                        className="text-center mb-20"
                    >
                        <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/70 mb-4">
                            How It Works
                        </motion.div>
                        <motion.h2 variants={fadeUp} className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight">
                            Up and running in{' '}
                            <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">three steps</span>
                        </motion.h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px">
                            <div className="w-full h-full bg-gradient-to-r from-emerald-500/20 via-emerald-500/40 to-amber-500/20" />
                        </div>

                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true }}
                                variants={fadeUp}
                                className="text-center relative"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/[0.08] to-amber-500/[0.04] border border-emerald-500/15 flex items-center justify-center text-lg font-bold text-emerald-400/80 mx-auto mb-6 relative z-10">
                                    {step.num}
                                </div>
                                <h3 className="text-lg font-bold mb-3 text-white/85">{step.title}</h3>
                                <p className="text-sm text-white/30 max-w-[280px] mx-auto leading-relaxed">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── LIVE STATS ── */}
            <section ref={statsRef} className="relative py-24 border-t border-b border-white/[0.04] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-amber-500/[0.02] pointer-events-none" />
                <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center relative z-10">
                    {[
                        { value: countryCount, suffix: '+', label: 'Countries', icon: Globe },
                        { value: farmerCount, suffix: '', label: 'Farmers Managed', icon: Users },
                        { value: visitCount, suffix: '+', label: 'Field Visits', icon: MapPin },
                        { value: 99.9, suffix: '%', label: 'Uptime', icon: Zap, isDecimal: true },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial="hidden" whileInView="visible" viewport={{ once: true }}
                            variants={fadeUp}
                            className="space-y-2"
                        >
                            <stat.icon className="w-5 h-5 text-emerald-400/30 mx-auto mb-2" />
                            <div className="text-[clamp(2rem,4vw,2.8rem)] font-bold bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                                {stat.isDecimal ? stat.value : stat.value.toLocaleString()}{stat.suffix}
                            </div>
                            <div className="text-xs text-white/25 uppercase tracking-wider">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── BUILT FOR ── */}
            <section className="relative py-28 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent pointer-events-none" />
                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
                        className="text-center mb-16"
                    >
                        <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/70 mb-4">
                            Built For
                        </motion.div>
                        <motion.h2 variants={fadeUp} className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight">
                            Serving organizations across{' '}
                            <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">Africa</span>
                        </motion.h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-4">
                        {audiences.map((aud, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true }}
                                variants={fadeUp}
                                className="group p-7 rounded-2xl bg-white/[0.015] border border-white/[0.04] hover:border-emerald-500/15 hover:bg-white/[0.03] transition-all duration-500"
                            >
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.08] flex items-center justify-center mb-5 group-hover:bg-emerald-500/[0.1] transition-all duration-500">
                                    <aud.icon className="w-6 h-6 text-emerald-400/50 group-hover:text-emerald-400/70 transition-colors" />
                                </div>
                                <h3 className="text-base font-bold mb-2 text-white/85">{aud.title}</h3>
                                <p className="text-sm text-white/30 leading-relaxed">{aud.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── MISSION ── */}
            <section id="mission" className="relative py-28 border-t border-white/[0.04]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
                    className="max-w-3xl mx-auto px-6 text-center relative z-10"
                >
                    <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/70 mb-4">
                        Our Mission
                    </motion.div>
                    <motion.h2 variants={fadeUp} className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight mb-6 leading-tight">
                        Closing the gap between{' '}
                        <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">agricultural data</span>
                        {' '}and field decisions
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-lg text-white/35 leading-relaxed max-w-2xl mx-auto">
                        Across Africa, extension officers manage thousands of farmers with clipboards and guesswork. AgExtension replaces that with real-time soil data, satellite weather, and AI-powered diagnostics — so every recommendation is backed by evidence, not intuition.
                    </motion.p>
                </motion.div>
            </section>

            {/* ── CTA ── */}
            <section className="relative py-28 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#060b08] via-emerald-950/20 to-[#060b08] pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.05] blur-[100px] rounded-full pointer-events-none" />

                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
                    className="max-w-2xl mx-auto px-6 text-center relative z-10"
                >
                    <motion.h2 variants={fadeUp} className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-5 leading-tight">
                        Ready to transform your
                        <br />
                        <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">agricultural extension?</span>
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-lg text-white/35 mb-8">
                        Start with a free trial. No credit card required.
                    </motion.p>
                    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => navigate('/register')}
                            className="group px-8 py-4 text-base font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                            Get Started Free
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => navigate('/demo')}
                            className="px-8 py-4 text-base font-semibold bg-white/[0.04] border border-white/[0.06] text-white/60 rounded-xl hover:bg-white/[0.08] hover:text-white/80 transition-all flex items-center justify-center gap-2"
                        >
                            Try Live Demo
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            {/* ── FOOTER ── */}
            <footer id="contact" className="border-t border-white/[0.04] pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 pb-10">
                    <div>
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                                <Leaf className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold">AgExtension</span>
                        </div>
                        <p className="text-sm text-white/30 leading-relaxed max-w-xs">
                            Empowering agricultural extension officers with AI-driven decision support across Africa.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/20 mb-5">Product</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#features" className="text-white/35 hover:text-emerald-400 transition-colors">Features</a></li>
                            <li><a href="#how-it-works" className="text-white/35 hover:text-emerald-400 transition-colors">How It Works</a></li>
                            <li><a href="/demo" className="text-white/35 hover:text-emerald-400 transition-colors">Live Demo</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/20 mb-5">Resources</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#mission" className="text-white/35 hover:text-emerald-400 transition-colors">About</a></li>
                            <li><a href="mailto:hello@gpexts.com" className="text-white/35 hover:text-emerald-400 transition-colors">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/20 mb-5">Get Started</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="/register" className="text-white/35 hover:text-emerald-400 transition-colors">Create Account</a></li>
                            <li><a href="/login" className="text-white/35 hover:text-emerald-400 transition-colors">Sign In</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/[0.04] flex flex-col md:flex-row justify-between items-center gap-4">
                    <span className="text-xs text-white/15">&copy; {new Date().getFullYear()} AgExtension. All rights reserved.</span>
                    <div className="flex gap-5 text-xs">
                        <a href="#" className="text-white/15 hover:text-emerald-400 transition-colors">Privacy Policy</a>
                        <a href="#" className="text-white/15 hover:text-emerald-400 transition-colors">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
