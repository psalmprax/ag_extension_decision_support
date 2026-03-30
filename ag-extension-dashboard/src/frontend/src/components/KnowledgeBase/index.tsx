import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    MessageSquare, 
    History, 
    BarChart3, 
    ChevronLeft, 
    ChevronRight, 
    Sparkles,
    Brain,
    Lightbulb,
    Clock,
    Zap,
    TrendingUp,
    PieChart,
    Info,
    ArrowRight
} from 'lucide-react';
import { askAI, searchKnowledge } from '@/api/knowledgeService';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { KnowledgeStats } from './KnowledgeStats';
import { KnowledgeSidebar } from './KnowledgeSidebar';
import { ReasoningVisuals } from './ReasoningVisuals';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface Result {
    answer: string;
    contextUsed: any[];
    cached?: boolean;
    query?: string;
    timestamp?: string;
    visuals?: any;
}

export const KnowledgeBase: React.FC = () => {
    const { t } = useLanguage();
    const { addNotification } = useAppStore();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [isAsking, setIsAsking] = useState(false);
    const [lastResult, setLastResult] = useState<Result | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showStats, setShowStats] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);

    // Fetch history and stats on mount
    useEffect(() => {
        fetchHistory();
        fetchStats();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/knowledge/history', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) setHistory(data.data);
        } catch (err) {
            console.error('History fetch failed', err);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/knowledge/stats', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) setStats(data.data);
        } catch (err) {
            console.error('Stats fetch failed', err);
        }
    };

    const handleSearch = async (queryToSearch: string) => {
        const queryText = queryToSearch || searchQuery;
        if (!queryText.trim()) return;

        setIsAsking(true);
        setLastResult(null);
        
        try {
            const res = await askAI(queryText);
            if (res.success) {
                const result = {
                    ...res.data,
                    query: queryText,
                    timestamp: new Date().toISOString()
                };
                setLastResult(result);
                fetchHistory(); // Refresh history
                
                if (result.cached) {
                    addNotification({
                        type: 'info',
                        message: 'Result retrieved from semantic cache (Cost optimized)'
                    });
                }
            }
        } catch (error) {
            addNotification({ type: 'error', message: 'Knowledge search failed' });
        } finally {
            setIsAsking(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-theme-bg/50 backdrop-blur-sm">
            {/* ChatGPT-style Side History */}
            <KnowledgeSidebar 
                isOpen={sidebarOpen} 
                onToggle={() => setSidebarOpen(!sidebarOpen)}
                history={history}
                onSelect={(h) => {
                    setSearchQuery(h.queryText);
                    handleSearch(h.queryText);
                }}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
                <div className="max-w-4xl mx-auto">
                    {/* Header glassmorphism */}
                    <div className="mb-12 text-center">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-xs font-black uppercase tracking-widest mb-6"
                        >
                            <Sparkles className="w-3 h-3" />
                            ALFA reasoning engine active
                        </motion.div>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">
                            {t('knowledge_title')}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg max-w-2xl mx-auto">
                            {t('knowledge_subtitle')}
                        </p>
                    </div>

                    {/* Premium Search Bar */}
                    <div className="relative group mb-12">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <div className="relative flex items-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 rounded-3xl p-1.5 shadow-2xl">
                            <div className="pl-5 text-primary-500">
                                <Search className="w-6 h-6" />
                            </div>
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                                placeholder="How can I help you today?"
                                className="flex-1 bg-transparent border-none focus:ring-0 py-4 px-4 text-xl font-medium text-gray-900 dark:text-white placeholder-gray-400"
                            />
                            <div className="flex gap-2 pr-2">
                                <button 
                                    onClick={() => setShowStats(!showStats)}
                                    className={`p-3 rounded-2xl transition-all ${showStats ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400'}`}
                                    title="Insights"
                                >
                                    <BarChart3 className="w-6 h-6" />
                                </button>
                                <button 
                                    onClick={() => handleSearch(searchQuery)}
                                    disabled={isAsking || !searchQuery.trim()}
                                    className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white p-3 md:px-8 rounded-2xl font-bold shadow-lg shadow-primary-500/20 flex items-center gap-2 transition-all transform active:scale-95"
                                >
                                    {isAsking ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span className="hidden md:inline">Generate</span>
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {showStats ? (
                            <motion.div
                                key="stats"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <KnowledgeStats data={stats} />
                            </motion.div>
                        ) : lastResult ? (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8 pb-12"
                            >
                                {/* AI Answer Card */}
                                <div className="card p-10 bg-white dark:bg-gray-800 shadow-2xl border-primary-50/50 dark:border-primary-900/30 border-2 relative overflow-hidden">
                                     {lastResult.cached && (
                                         <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                                             <Zap className="w-3 h-3 fill-current" />
                                             Optimized Cache
                                         </div>
                                     )}
                                    
                                    <div className="flex items-start gap-4 mb-8">
                                        <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl text-primary-600 dark:text-primary-400">
                                            <Brain className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-gray-400 uppercase tracking-widest mb-1">
                                                ALFA Reasoning Results
                                            </h2>
                                            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                                Expert recommendation for: "{lastResult.query}"
                                            </p>
                                        </div>
                                    </div>

                                    {/* Markdown results with refined Typography */}
                                    <MarkdownRenderer content={lastResult.answer} />

                                    {/* New Visual Intelligence Layer */}
                                    {lastResult.visuals && (
                                        <div className="mt-12 mb-16 p-1 bg-gradient-to-br from-primary-500/5 to-transparent rounded-[2.5rem] border border-primary-500/10">
                                            <ReasoningVisuals visuals={lastResult.visuals} />
                                        </div>
                                    )}

                                    <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700/50 flex flex-col gap-6">
                                        <div className="flex items-center gap-2">
                                            <Info className="w-4 h-4 text-primary-500" />
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Contextual Verification Sources</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {lastResult.contextUsed.map((ctx: any, i: number) => (
                                                <div key={i} className="px-4 py-2 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 rounded-2xl flex items-center gap-2 group hover:border-primary-500/50 transition-colors cursor-pointer">
                                                    <div className="w-2 h-2 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Source {i + 1}</span>
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                            {ctx.metadata?.crop || 'General'} / {ctx.metadata?.category || 'Expert Advice'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            /* Empty State / Suggestions */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
                                {['How to manage fall armyworm?', 'Best time for maize harvesting?', 'Impact of soil pH on yield?', 'Intercropping with beans'].map((suggestion, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => {
                                            setSearchQuery(suggestion);
                                            handleSearch(suggestion);
                                        }}
                                        className="p-6 bg-theme-bg-card rounded-3xl border border-gray-100 dark:border-gray-700 hover:border-primary-500 transition-all text-left flex items-start gap-4 group"
                                    >
                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl group-hover:bg-primary-500 group-hover:text-white transition-colors">
                                            <Lightbulb className="w-5 h-5" />
                                        </div>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">{suggestion}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};
