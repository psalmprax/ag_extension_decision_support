import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Leaf, Users, MapPin, Brain, BarChart3, Shield,
    ArrowRight, CheckCircle, Globe, Smartphone,
    Zap, Database, ChevronRight
} from 'lucide-react';

const fadeInUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    })
};

const features = [
    {
        icon: Users,
        title: 'Farmer Portfolio',
        desc: 'Manage your entire farmer network with real-time vital scores, crop data, and soil analytics.',
        color: 'bg-blue-50 text-blue-600',
    },
    {
        icon: MapPin,
        title: 'Field Visits',
        desc: 'Schedule, track, and synthesize field visits with AI-powered note analysis and follow-up automation.',
        color: 'bg-emerald-50 text-emerald-600',
    },
    {
        icon: Brain,
        title: 'AI Assistant',
        desc: 'Get instant agronomic advice powered by RAG with citations, knowledge graphs, and re-ranked results.',
        color: 'bg-purple-50 text-purple-600',
    },
    {
        icon: BarChart3,
        title: 'Analytics & Reports',
        desc: 'Track officer performance, farmer outcomes, and generate executive reports with one click.',
        color: 'bg-orange-50 text-orange-600',
    },
    {
        icon: Shield,
        title: 'Disease Diagnosis',
        desc: 'AI-powered crop disease identification with treatment recommendations from the knowledge base.',
        color: 'bg-pink-50 text-pink-600',
    },
    {
        icon: Database,
        title: 'Knowledge Base',
        desc: 'FAOSTAT data, NASA POWER weather, SoilGrids properties — all searchable with AI.',
        color: 'bg-teal-50 text-teal-600',
    },
];

const steps = [
    { num: '1', title: 'Register Farmers', desc: 'Add farmers with GPS coordinates, crop data, soil info, and contact details. Bulk import supported.' },
    { num: '2', title: 'Track & Visit', desc: 'Schedule field visits, record observations, capture photos, and log follow-up actions from any device.' },
    { num: '3', title: 'Analyze & Act', desc: 'AI surfaces insights, predicts risks, recommends actions, and generates reports for stakeholders.' },
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
        <div className="min-h-screen bg-[#FFFBEB] text-stone-900 overflow-x-hidden">
            {/* Nav */}
            <nav className="sticky top-0 z-50 bg-[#FFFBEB]/92 backdrop-blur-xl border-b border-amber-900/10">
                <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center">
                            <Leaf className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-emerald-800">AgExtension</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-medium text-stone-600 hover:text-emerald-800 transition-colors">Features</a>
                        <a href="#how-it-works" className="text-sm font-medium text-stone-600 hover:text-emerald-800 transition-colors">How It Works</a>
                        <a href="#contact" className="text-sm font-medium text-stone-600 hover:text-emerald-800 transition-colors">Contact</a>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm font-semibold text-stone-600 hover:text-emerald-800 transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            className="px-5 py-2.5 text-sm font-bold bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 transition-all hover:-translate-y-0.5 shadow-md hover:shadow-lg"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative overflow-hidden">
                {/* Geometric accents */}
                <svg className="absolute -top-5 right-[8%] w-36 h-36 opacity-[0.06] pointer-events-none" viewBox="0 0 100 100">
                    <polygon points="50,5 95,95 5,95" fill="#D97706" />
                    <polygon points="50,25 80,80 20,80" fill="#FFFBEB" />
                </svg>
                <svg className="absolute bottom-3 left-[3%] w-24 h-24 opacity-[0.06] pointer-events-none" viewBox="0 0 100 100">
                    <rect x="10" y="10" width="80" height="80" transform="rotate(45 50 50)" fill="#166534" />
                </svg>

                <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left copy */}
                    <motion.div
                        initial="hidden" animate="visible"
                        className="space-y-6"
                    >
                        <motion.div variants={fadeInUp} custom={0} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-800/8 border border-emerald-800/15">
                            <CheckCircle className="w-4 h-4 text-emerald-700" />
                            <span className="text-xs font-semibold tracking-wide text-emerald-800">Trusted across 10+ African countries</span>
                        </motion.div>

                        <motion.h1 variants={fadeInUp} custom={1} className="text-[clamp(2.2rem,4.5vw,3.5rem)] font-bold leading-[1.1] tracking-tight">
                            Smarter Farming Starts with{' '}
                            <span className="text-emerald-700">Better Data</span>
                        </motion.h1>

                        <motion.p variants={fadeInUp} custom={2} className="text-lg text-stone-500 leading-relaxed max-w-lg">
                            Empower extension officers with AI-driven insights, real-time farmer tracking, and data-powered decisions across Africa.
                        </motion.p>

                        <motion.div variants={fadeInUp} custom={3} className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => navigate('/register')}
                                className="px-7 py-3.5 text-base font-bold bg-emerald-800 text-white rounded-lg hover:bg-emerald-700 transition-all hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
                            >
                                Start Free Trial
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => navigate('/demo')}
                                className="px-7 py-3.5 text-base font-bold border-2 border-emerald-800 text-emerald-800 rounded-lg hover:bg-emerald-800 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                Try Live Demo
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </motion.div>
                    </motion.div>

                    {/* Right — static dashboard mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 32, rotateY: 3, rotateX: -1 }}
                        animate={{ opacity: 1, y: 0, rotateY: 3, rotateX: -1 }}
                        transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="relative"
                    >
                        <div className="bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.12)] border border-stone-200/60 overflow-hidden transform perspective-[1200px] rotate-y-[3deg] -rotate-x-[1deg] hover:rotate-y-0 hover:rotate-x-0 transition-transform duration-500">
                            {/* Topbar */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 border-b border-stone-200">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                                <span className="text-[11px] text-stone-400 ml-2 font-medium">AgExtension Dashboard</span>
                            </div>

                            <div className="grid grid-cols-[170px_1fr] min-h-[310px]">
                                {/* Sidebar */}
                                <div className="bg-stone-900 p-3 text-[11px] text-stone-400 space-y-0.5">
                                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-emerald-800/30 text-green-400 font-medium">
                                        <BarChart3 className="w-3.5 h-3.5" />
                                        Dashboard
                                    </div>
                                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md">
                                        <Users className="w-3.5 h-3.5" />
                                        Farmers
                                    </div>
                                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md">
                                        <MapPin className="w-3.5 h-3.5" />
                                        Visits
                                    </div>
                                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md">
                                        <Brain className="w-3.5 h-3.5" />
                                        AI Assistant
                                    </div>
                                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md">
                                        <BarChart3 className="w-3.5 h-3.5" />
                                        Analytics
                                    </div>
                                </div>

                                {/* Main content */}
                                <div className="p-3 bg-stone-50 space-y-3">
                                    {/* Stats row */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white rounded-lg p-3 border border-stone-200">
                                            <div className="text-lg font-bold text-emerald-700">2,847</div>
                                            <div className="text-[10px] text-stone-400 uppercase tracking-wide">Active Farmers</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-stone-200">
                                            <div className="text-lg font-bold text-emerald-700">156</div>
                                            <div className="text-[10px] text-stone-400 uppercase tracking-wide">Visits This Month</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-stone-200">
                                            <div className="text-lg font-bold text-amber-600">92%</div>
                                            <div className="text-[10px] text-stone-400 uppercase tracking-wide">Health Score</div>
                                        </div>
                                    </div>

                                    {/* Chart */}
                                    <div className="bg-white rounded-lg p-3 border border-stone-200">
                                        <div className="text-[11px] font-semibold text-stone-700 mb-2">Farmer Growth</div>
                                        <div className="flex items-end gap-1.5 h-14">
                                            {[35, 50, 40, 65, 55, 75, 90].map((h, i) => (
                                                <div
                                                    key={i}
                                                    className="flex-1 rounded-t-sm"
                                                    style={{
                                                        height: `${h}%`,
                                                        background: i === 3 ? '#D97706' : '#166534',
                                                        opacity: 0.7 + (i * 0.04),
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Farmer list */}
                                    <div className="space-y-1.5">
                                        {[
                                            { name: 'Amina Okafor', initials: 'AO', color: 'bg-emerald-700', status: 'Active', statusColor: 'bg-green-100 text-green-700' },
                                            { name: 'Joseph Mensah', initials: 'JM', color: 'bg-amber-600', status: 'Review', statusColor: 'bg-amber-100 text-amber-700' },
                                            { name: 'Ngozi Kalu', initials: 'NK', color: 'bg-orange-600', status: 'Active', statusColor: 'bg-green-100 text-green-700' },
                                        ].map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-white rounded-md px-2.5 py-1.5 border border-stone-200 text-[11px]">
                                                <div className={`w-5 h-5 rounded-full ${f.color} flex items-center justify-center text-white text-[9px] font-bold`}>
                                                    {f.initials}
                                                </div>
                                                <span className="flex-1 font-medium text-stone-700">{f.name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${f.statusColor}`}>
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
            </section>

            {/* Trusted by */}
            <section className="py-10 bg-white border-y border-stone-100">
                <div className="max-w-5xl mx-auto px-6 text-center">
                    <p className="text-xs uppercase tracking-[0.12em] font-semibold text-stone-400 mb-5">
                        Trusted by organizations across Africa
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        {trustedOrgs.map((org, i) => (
                            <div
                                key={i}
                                className="px-5 py-2.5 bg-stone-50 rounded-lg text-sm font-semibold text-stone-500 border border-stone-100"
                            >
                                {org}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-24">
                <div className="max-w-7xl mx-auto px-6">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
                        className="text-center mb-16 max-w-xl mx-auto"
                    >
                        <motion.div variants={fadeInUp} custom={0} className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600 mb-3">
                            Features
                        </motion.div>
                        <motion.h2 variants={fadeInUp} custom={1} className="text-[clamp(1.8rem,3vw,2.5rem)] font-bold tracking-tight mb-4">
                            Everything you need to manage agricultural extension
                        </motion.h2>
                        <motion.p variants={fadeInUp} custom={2} className="text-stone-500 text-lg">
                            From farmer registration to AI-powered insights, all in one platform designed for the realities of African agriculture.
                        </motion.p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map((feat, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
                                variants={fadeInUp} custom={i}
                                className="bg-white rounded-2xl p-7 border border-stone-100 hover:border-emerald-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
                            >
                                {/* Top gradient bar on hover */}
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className={`w-12 h-12 rounded-xl ${feat.color} flex items-center justify-center mb-5`}>
                                    <feat.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">{feat.title}</h3>
                                <p className="text-sm text-stone-500 leading-relaxed mb-4">{feat.desc}</p>
                                <span className="text-sm font-semibold text-emerald-700 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                                    Learn more <ChevronRight className="w-4 h-4" />
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-24 bg-white">
                <div className="max-w-5xl mx-auto px-6">
                    <motion.div
                        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
                        className="text-center mb-16"
                    >
                        <motion.div variants={fadeInUp} custom={0} className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600 mb-3">
                            How It Works
                        </motion.div>
                        <motion.h2 variants={fadeInUp} custom={1} className="text-[clamp(1.8rem,3vw,2.5rem)] font-bold tracking-tight">
                            Up and running in three simple steps
                        </motion.h2>
                    </motion.div>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {/* Connecting line */}
                        <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-amber-500 via-emerald-600 to-amber-500" />

                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                initial="hidden" whileInView="visible" viewport={{ once: true }}
                                variants={fadeInUp} custom={i}
                                className="text-center relative"
                            >
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFFBEB] to-amber-100 border-[3px] border-amber-500 flex items-center justify-center text-2xl font-bold text-amber-800 mx-auto mb-5 relative z-10">
                                    {step.num}
                                </div>
                                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                                <p className="text-sm text-stone-500 max-w-[260px] mx-auto">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats band */}
            <section className="py-16 bg-gradient-to-r from-emerald-800 to-emerald-900 text-white">
                <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { value: '10+', label: 'Countries' },
                        { value: '5,000+', label: 'Farmers Managed' },
                        { value: '50+', label: 'Crop Varieties' },
                        { value: '24/7', label: 'AI Support' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial="hidden" whileInView="visible" viewport={{ once: true }}
                            variants={fadeInUp} custom={i}
                        >
                            <div className="text-[clamp(2rem,4vw,3rem)] font-bold">{stat.value}</div>
                            <div className="text-sm opacity-80 mt-1">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Testimonial */}
            <section className="py-24 bg-[#FFFBEB]">
                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true }}
                    className="max-w-2xl mx-auto px-6 text-center"
                >
                    <div className="text-6xl leading-none text-amber-500/30 font-serif mb-[-0.5rem]">"</div>
                    <motion.blockquote variants={fadeInUp} custom={0} className="text-xl italic text-stone-600 leading-relaxed mb-8">
                        AgExtension transformed how we deliver agricultural services. We went from paper-based tracking to real-time insights across 3,000 farmers in six months. The AI assistant alone saves our officers hours per week.
                    </motion.blockquote>
                    <motion.div variants={fadeInUp} custom={1} className="flex items-center justify-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg">
                            KO
                        </div>
                        <div className="text-left">
                            <div className="font-bold">Dr. Kemi Oyelaran</div>
                            <div className="text-sm text-stone-500">Director of Extension Services, Ogun State Nigeria</div>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-900 text-white text-center">
                <motion.div
                    initial="hidden" whileInView="visible" viewport={{ once: true }}
                    className="max-w-2xl mx-auto px-6 space-y-6"
                >
                    <motion.h2 variants={fadeInUp} custom={0} className="text-[clamp(1.8rem,3vw,2.5rem)] font-bold tracking-tight">
                        Ready to transform your agricultural extension?
                    </motion.h2>
                    <motion.p variants={fadeInUp} custom={1} className="text-lg opacity-80">
                        Join hundreds of organizations using data to grow smarter.
                    </motion.p>
                    <motion.button
                        variants={fadeInUp} custom={2}
                        onClick={() => navigate('/register')}
                        className="px-8 py-4 text-base font-bold bg-amber-500 text-stone-900 rounded-lg hover:bg-amber-400 transition-all hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
                    >
                        Get Started Free
                    </motion.button>
                </motion.div>
            </section>

            {/* Footer */}
            <footer id="contact" className="bg-stone-900 text-stone-400 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 pb-10">
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center">
                                <Leaf className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold text-stone-100">AgExtension</span>
                        </div>
                        <p className="text-sm leading-relaxed">
                            Empowering agricultural extension officers with AI-driven decision support across Africa.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">Product</h4>
                        <ul className="space-y-2.5 text-sm">
                            <li><a href="#features" className="hover:text-amber-500 transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Pricing</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Integrations</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Changelog</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">Resources</h4>
                        <ul className="space-y-2.5 text-sm">
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Documentation</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">API Reference</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Blog</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Support</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">Contact</h4>
                        <ul className="space-y-2.5 text-sm">
                            <li><a href="mailto:hello@gpexts.com" className="hover:text-amber-500 transition-colors">hello@gpexts.com</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Support</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">Twitter</a></li>
                            <li><a href="#" className="hover:text-amber-500 transition-colors">LinkedIn</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 pt-6 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-stone-500">
                    <span>&copy; {new Date().getFullYear()} AgExtension. All rights reserved.</span>
                    <div className="flex gap-4">
                        <a href="#" className="hover:text-amber-500 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-amber-500 transition-colors">Terms of Service</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
