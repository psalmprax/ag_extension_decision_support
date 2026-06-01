import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Leaf, Users, MapPin, Brain, BarChart3, Shield,
    ArrowRight, CheckCircle, Globe, Smartphone,
    Zap, Database, ChevronRight, TrendingUp, Wifi, FileText
} from 'lucide-react';

const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } }
};

const fadeUp = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

const features = [
    {
        icon: Users,
        title: 'Farmer Portfolio',
        desc: 'Manage your entire farmer network with real-time vital scores, crop data, and soil analytics in one unified view.',
    },
    {
        icon: MapPin,
        title: 'Field Visits',
        desc: 'Schedule, track, and synthesize field visits with AI-powered note analysis and follow-up automation.',
    },
    {
        icon: Brain,
        title: 'AI Assistant',
        desc: 'Instant agronomic advice powered by RAG with citations, knowledge graphs, and re-ranked results.',
    },
    {
        icon: TrendingUp,
        title: 'Analytics & Reports',
        desc: 'Track officer performance, farmer outcomes, and generate executive reports with one click.',
    },
    {
        icon: Shield,
        title: 'Disease Diagnosis',
        desc: 'AI-powered crop disease identification with treatment recommendations from the knowledge base.',
    },
    {
        icon: Database,
        title: 'Knowledge Base',
        desc: 'FAOSTAT data, NASA POWER weather, SoilGrids properties — all searchable with AI-powered RAG.',
    },
];

const steps = [
    { num: '01', title: 'Register Farmers', desc: 'Add farmers with GPS coordinates, crop data, soil info, and contact details. Bulk import supported.' },
    { num: '02', title: 'Track & Visit', desc: 'Schedule field visits, record observations, capture photos, and log follow-up actions from any device.' },
    { num: '03', title: 'Analyze & Act', desc: 'AI surfaces insights, predicts risks, recommends actions, and generates reports for stakeholders.' },
];

const trustedOrgs = [
    'Min. of Agriculture, Kenya',
    'AGRA',
    'FAO',
    'World Bank',
    'IFDC',
];

export function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#070d0a] text-white overflow-x-hidden">
            {/* ========== NAV ========== */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#070d0a]/70 backdrop-blur-2xl border-b border-white/[0.04]">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Leaf className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">AgExtension</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="text-sm font-medium text-white/50 hover:text-white transition-colors">How It Works</a>
                        <a href="#testimonials" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Testimonials</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
                        >
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

            {/* ========== HERO ========== */}
            <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
                {/* Background orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-amber-500/[0.05] blur-[100px]" />
                    <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-emerald-400/[0.03] blur-[80px]" />
                </div>

                {/* Grid pattern */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />

                <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10">
                    {/* Left copy */}
                    <motion.div
                        initial="hidden" animate="visible" variants={stagger}
                        className="space-y-8"
                    >
                        <motion.div variants={fadeUp} className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-white/60">Trusted across 10+ African countries</span>
                        </motion.div>

                        <motion.h1 variants={fadeUp} className="text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-tight">
                            Smarter Farming
                            <br />
                            Starts with{' '}
                            <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-400 bg-clip-text text-transparent">
                                Better Data
                            </span>
                        </motion.h1>

                        <motion.p variants={fadeUp} className="text-lg text-white/45 leading-relaxed max-w-lg">
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
                                className="px-7 py-3.5 text-sm font-semibold bg-white/[0.05] border border-white/[0.08] text-white/80 rounded-xl hover:bg-white/[0.1] hover:text-white transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                            >
                                Try Live Demo
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </motion.div>

                        {/* Micro stats */}
                        <motion.div variants={fadeUp} className="flex gap-8 pt-2">
                            {[
                                { value: '5,000+', label: 'Farmers' },
                                { value: '10+', label: 'Countries' },
                                { value: '24/7', label: 'AI Support' },
                            ].map((s, i) => (
                                <div key={i}>
                                    <div className="text-xl font-bold text-white/90">{s.value}</div>
                                    <div className="text-xs text-white/30 mt-0.5">{s.label}</div>
                                </div>
                            ))}
                        </motion.div>
                    </motion.div>

                    {/* Right — Dashboard mockup */}
                    <motion.div
                        initial="hidden" animate="visible" variants={scaleIn}
                        className="relative"
                    >
                        {/* Glow behind mockup */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-amber-500/10 blur-[60px] rounded-full scale-90" />

                        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm shadow-2xl shadow-black/50 transform perspective-[1200px] rotate-y-[2deg] -rotate-x-[1deg] hover:rotate-y-0 hover:rotate-x-0 transition-transform duration-700">
                            {/* Window chrome */}
                            <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                                </div>
                                <div className="flex-1 flex justify-center">
                                    <div className="px-3 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-white/30 font-mono">
                                        app.gpexts.com/dashboard
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-[180px_1fr] min-h-[340px]">
                                {/* Sidebar */}
                                <div className="bg-white/[0.02] border-r border-white/[0.06] p-3 text-[11px] space-y-0.5">
                                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/[0.1] text-emerald-400 font-medium">
                                        <BarChart3 className="w-3.5 h-3.5" />
                                        Dashboard
                                    </div>
                                    {[
                                        { icon: Users, label: 'Farmers' },
                                        { icon: MapPin, label: 'Visits' },
                                        { icon: Brain, label: 'AI Assistant' },
                                        { icon: TrendingUp, label: 'Analytics' },
                                        { icon: FileText, label: 'Reports' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/30 hover:text-white/50 transition-colors">
                                            <item.icon className="w-3.5 h-3.5" />
                                            {item.label}
                                        </div>
                                    ))}
                                </div>

                                {/* Main content */}
                                <div className="p-4 bg-white/[0.01] space-y-3">
                                    {/* Stats row */}
                                    <div className="grid grid-cols-3 gap-2.5">
                                        {[
                                            { value: '2,847', label: 'Active Farmers', change: '+12%', color: 'text-emerald-400' },
                                            { value: '156', label: 'Visits This Month', change: '+8%', color: 'text-emerald-400' },
                                            { value: '92%', label: 'Health Score', change: '+3%', color: 'text-amber-400' },
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                                                <div className="text-lg font-bold text-white/90">{stat.value}</div>
                                                <div className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">{stat.label}</div>
                                                <div className={`text-[9px] font-semibold ${stat.color} mt-1`}>{stat.change}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Chart area */}
                                    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] font-semibold text-white/50">Farmer Growth</span>
                                            <span className="text-[9px] text-white/20">Last 7 months</span>
                                        </div>
                                        <div className="flex items-end gap-1.5 h-16">
                                            {[30, 45, 38, 60, 52, 72, 88].map((h, i) => (
                                                <div
                                                    key={i}
                                                    className="flex-1 rounded-t-sm transition-all duration-300"
                                                    style={{
                                                        height: `${h}%`,
                                                        background: i === 6
                                                            ? 'linear-gradient(to top, #D97706, #F59E0B)'
                                                            : `linear-gradient(to top, rgba(16,185,129,${0.3 + i * 0.08}), rgba(16,185,129,${0.5 + i * 0.06}))`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Farmer list */}
                                    <div className="space-y-1.5">
                                        {[
                                            { name: 'Amina Okafor', initials: 'AO', color: 'from-emerald-400 to-emerald-600', status: 'Active', statusBg: 'bg-emerald-500/10 text-emerald-400' },
                                            { name: 'Joseph Mensah', initials: 'JM', color: 'from-amber-400 to-amber-600', status: 'Review', statusBg: 'bg-amber-500/10 text-amber-400' },
                                            { name: 'Ngozi Kalu', initials: 'NK', color: 'from-orange-400 to-orange-600', status: 'Active', statusBg: 'bg-emerald-500/10 text-emerald-400' },
                                        ].map((f, i) => (
                                            <div key={i} className="flex items-center gap-2.5 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04] text-[11px]">
                                                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${f.color} flex items-center justify-center text-white text-[8px] font-bold shadow-sm`}>
                                                    {f.initials}
                                                </div>
                                                <span className="flex-1 font-medium text-white/70">{f.name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${f.statusBg}`}>
                                                    {f.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Bottom fade */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#070d0a] to-transparent pointer-events-none" />
            </section>

            {/* ========== TRUSTED BY ========== */}
            <section className="relative py-16 border-y border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] font-medium text-white/25 mb-8">
                        Trusted by leading organizations across Africa
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        {trustedOrgs.map((org, i) => (
                            <div
                                key={i}
                                className="px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm font-medium text-white/35 hover:text-white/50 hover:bg-white/[0.05] transition-all cursor-default"
                            >
                                {org}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== FEATURES ========== */}
            <section id="features" className="relative py-28">
                {/* Background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
                        className="text-center mb-20 max-w-2xl mx-auto"
                    >
                        <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/70 mb-4">
                            Features
                        </motion.div>
                        <motion.h2 variants={fadeUp} className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight mb-5 leading-tight">
                            Everything you need to manage
                            <br />
                            <span className="text-white/40">agricultural extension</span>
                        </motion.h2>
                        <motion.p variants={fadeUp} className="text-white/40 text-lg leading-relaxed">
                            From farmer registration to AI-powered insights, all in one platform designed for the realities of African agriculture.
                        </motion.p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {features.map((feat, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
                                variants={fadeUp}
                                className="group relative p-7 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all duration-500 overflow-hidden"
                            >
                                {/* Hover glow */}
                                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="relative z-10">
                                    <div className="w-11 h-11 rounded-xl bg-white/[0.05] border border-white/[0.06] flex items-center justify-center mb-5 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all duration-500">
                                        <feat.icon className="w-5 h-5 text-white/50 group-hover:text-emerald-400 transition-colors duration-500" />
                                    </div>
                                    <h3 className="text-base font-bold mb-2 text-white/90">{feat.title}</h3>
                                    <p className="text-sm text-white/35 leading-relaxed group-hover:text-white/45 transition-colors duration-500">{feat.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== HOW IT WORKS ========== */}
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
                        {/* Connecting line */}
                        <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px">
                            <div className="w-full h-full bg-gradient-to-r from-emerald-500/30 via-emerald-500/50 to-amber-500/30" />
                        </div>

                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true }}
                                variants={fadeUp}
                                className="text-center relative"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-amber-500/5 border border-emerald-500/20 flex items-center justify-center text-lg font-bold text-emerald-400 mx-auto mb-6 relative z-10 backdrop-blur-sm">
                                    {step.num}
                                </div>
                                <h3 className="text-lg font-bold mb-3 text-white/90">{step.title}</h3>
                                <p className="text-sm text-white/35 max-w-[280px] mx-auto leading-relaxed">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ========== STATS BAND ========== */}
            <section className="relative py-20 border-t border-b border-white/[0.04] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.04] via-transparent to-amber-500/[0.03] pointer-events-none" />
                <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center relative z-10">
                    {[
                        { value: '10+', label: 'Countries', icon: Globe },
                        { value: '5,000+', label: 'Farmers Managed', icon: Users },
                        { value: '50+', label: 'Crop Varieties', icon: Leaf },
                        { value: '24/7', label: 'AI Support', icon: Zap },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial="hidden" whileInView="visible" viewport={{ once: true }}
                            variants={fadeUp}
                            className="space-y-2"
                        >
                            <stat.icon className="w-5 h-5 text-emerald-400/40 mx-auto mb-2" />
                            <div className="text-[clamp(2rem,4vw,2.8rem)] font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                                {stat.value}
                            </div>
                            <div className="text-xs text-white/30 uppercase tracking-wider">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ========== TESTIMONIAL ========== */}
            <section id="testimonials" className="relative py-28">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
                    className="max-w-3xl mx-auto px-6 text-center relative z-10"
                >
                    <motion.div variants={fadeUp} className="text-7xl leading-none text-emerald-500/15 font-serif mb-2 select-none">
                        &ldquo;
                    </motion.div>
                    <motion.blockquote variants={fadeUp} className="text-xl md:text-2xl text-white/70 leading-relaxed mb-10 font-light">
                        AgExtension transformed how we deliver agricultural services. We went from paper-based tracking to real-time insights across 3,000 farmers in six months. The AI assistant alone saves our officers hours per week.
                    </motion.blockquote>
                    <motion.div variants={fadeUp} className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
                            KO
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-white/90">Dr. Kemi Oyelaran</div>
                            <div className="text-sm text-white/35">Director of Extension Services, Ogun State Nigeria</div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* ========== CTA ========== */}
            <section className="relative py-28 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[#070d0a] via-emerald-950/30 to-[#070d0a] pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.06] blur-[100px] rounded-full pointer-events-none" />

                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
                    className="max-w-2xl mx-auto px-6 text-center relative z-10"
                >
                    <motion.h2 variants={fadeUp} className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-5 leading-tight">
                        Ready to transform your
                        <br />
                        <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">agricultural extension?</span>
                    </motion.h2>
                    <motion.p variants={fadeUp} className="text-lg text-white/40 mb-8">
                        Join hundreds of organizations using data to grow smarter.
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
                            className="px-8 py-4 text-base font-semibold bg-white/[0.05] border border-white/[0.08] text-white/70 rounded-xl hover:bg-white/[0.1] hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                            Try Live Demo
                        </button>
                    </motion.div>
                </motion.div>
            </section>

            {/* ========== FOOTER ========== */}
            <footer id="contact" className="border-t border-white/[0.04] pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 pb-10">
                    <div>
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                                <Leaf className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold">AgExtension</span>
                        </div>
                        <p className="text-sm text-white/35 leading-relaxed max-w-xs">
                            Empowering agricultural extension officers with AI-driven decision support across Africa.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/25 mb-5">Product</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#features" className="text-white/40 hover:text-emerald-400 transition-colors">Features</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Pricing</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Integrations</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Changelog</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/25 mb-5">Resources</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Documentation</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">API Reference</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Blog</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Support</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/25 mb-5">Contact</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="mailto:hello@gpexts.com" className="text-white/40 hover:text-emerald-400 transition-colors">hello@gpexts.com</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Support</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">Twitter</a></li>
                            <li><a href="#" className="text-white/40 hover:text-emerald-400 transition-colors">LinkedIn</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/[0.04] flex flex-col md:flex-row justify-between items-center gap-4">
                    <span className="text-xs text-white/20">&copy; {new Date().getFullYear()} AgExtension. All rights reserved.</span>
                    <div className="flex gap-5 text-xs">
                        <a href="#" className="text-white/20 hover:text-emerald-400 transition-colors">Privacy Policy</a>
                        <a href="#" className="text-white/20 hover:text-emerald-400 transition-colors">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
