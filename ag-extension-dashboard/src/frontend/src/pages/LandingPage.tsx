import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Leaf, BarChart3, Users, MapPin, Brain, Shield,
    ChevronRight, ArrowRight, Zap, Globe, Smartphone
} from 'lucide-react';

const features = [
    {
        icon: Users,
        title: 'Farmer Portfolio',
        desc: 'Manage your entire farmer network with real-time vital scores, crop data, and soil analytics.',
        color: 'from-blue-500 to-cyan-500',
    },
    {
        icon: MapPin,
        title: 'Field Visits',
        desc: 'Schedule, track, and synthesize field visits with AI-powered note analysis and follow-up automation.',
        color: 'from-green-500 to-emerald-500',
    },
    {
        icon: Brain,
        title: 'AI Assistant',
        desc: 'Get instant agronomic advice powered by RAG v2 — citations, knowledge graphs, and re-ranked results.',
        color: 'from-purple-500 to-violet-500',
    },
    {
        icon: BarChart3,
        title: 'Analytics & Reports',
        desc: 'Track extension officer performance, farmer outcomes, and generate executive reports.',
        color: 'from-orange-500 to-amber-500',
    },
    {
        icon: Leaf,
        title: 'Disease Diagnosis',
        desc: 'AI-powered crop disease identification with treatment recommendations from the knowledge base.',
        color: 'from-rose-500 to-pink-500',
    },
    {
        icon: Globe,
        title: 'Knowledge Base',
        desc: 'FAOSTAT data, NASA POWER weather, SoilGrids properties, and curated agronomic articles — all searchable.',
        color: 'from-teal-500 to-cyan-500',
    },
];

const stats = [
    { value: '10+', label: 'Countries covered' },
    { value: '50+', label: 'Crop varieties' },
    { value: '24/7', label: 'AI assistance' },
    { value: '100%', label: 'Offline ready' },
];

export function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 overflow-hidden">
            {/* Hero */}
            <section className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-green-400/20 to-transparent rounded-full blur-3xl" />

                {/* Nav */}
                <nav className="relative z-10 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="AG Extension" className="w-10 h-10 rounded-xl shadow-lg" />
                        <span className="text-xl font-black text-gray-900 dark:text-white tracking-tight">AG Extension</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/login')}
                            className="px-5 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            className="px-5 py-2.5 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-600/20 transition-all"
                        >
                            Get Started
                        </button>
                    </div>
                </nav>

                {/* Hero Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-8">
                            <Zap className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-bold text-green-700 dark:text-green-400">AI-Powered Agricultural Extension</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white leading-[1.1] mb-6">
                            Smarter Farming
                            <br />
                            <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                                Better Harvests
                            </span>
                        </h1>

                        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                            The complete decision support platform for agricultural extension officers.
                            Manage farmers, diagnose diseases, track field visits, and leverage AI — all in one place.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => navigate('/register')}
                                className="px-8 py-4 text-lg font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-xl shadow-green-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                Start Free Trial
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="px-8 py-4 text-lg font-bold bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-2xl hover:border-green-500 transition-all flex items-center justify-center gap-2"
                            >
                                Sign In
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Stats */}
            <section className="relative z-10 -mt-16 max-w-5xl mx-auto px-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="text-center"
                        >
                            <div className="text-3xl font-black text-gray-900 dark:text-white">{stat.value}</div>
                            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="max-w-7xl mx-auto px-6 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                        Everything You Need
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                        Purpose-built for agricultural extension work in Sub-Saharan Africa
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="group p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:shadow-xl transition-all"
                        >
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center mb-4 shadow-lg`}>
                                <feat.icon className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{feat.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="bg-gradient-to-br from-green-600 to-green-700 py-20">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-4xl font-black text-white mb-4">
                        Ready to Transform Your Extension Work?
                    </h2>
                    <p className="text-lg text-green-100 mb-8 max-w-xl mx-auto">
                        Join extension officers across Africa using AI-powered tools to improve farmer outcomes.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/register')}
                            className="px-8 py-4 text-lg font-bold bg-white text-green-700 rounded-2xl shadow-xl hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Smartphone className="w-5 h-5" />
                            Create Free Account
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-8 py-4 text-lg font-bold bg-green-500/30 text-white border-2 border-green-400/50 rounded-2xl hover:bg-green-500/40 transition-all flex items-center justify-center gap-2"
                        >
                            <Shield className="w-5 h-5" />
                            Sign In
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg" />
                        <span className="text-sm font-bold text-white">AG Extension Decision Support</span>
                    </div>
                    <div className="text-sm">
                        &copy; {new Date().getFullYear()} AG Extension. Empowering farmers through technology.
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
