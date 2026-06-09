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
    ArrowRight,
    Paperclip,
    Mic,
    X,
    File as FileIcon,
    Volume2
} from 'lucide-react';
import { askAI, searchKnowledge, fetchKnowledgeHistory, fetchKnowledgeStats, Attachment, Citation } from '@/api/knowledgeService';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { KnowledgeStats } from './KnowledgeStats';
import { KnowledgeSidebar } from './KnowledgeSidebar';
import { ReasoningVisuals } from './ReasoningVisuals';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface ContextItem {
    content: string;
    source?: string;
    score?: number;
    metadata?: {
        title?: string;
        sourceUrl?: string;
        crop?: string;
        category?: string;
    };
}

interface KPI {
    label: string;
    value: string;
    status: 'good' | 'warning' | 'critical';
    trend?: string;
}

interface Chart {
    type: 'bar' | 'line' | 'pie' | 'area';
    title: string;
    data: Array<{ label: string; value: number }>;
}

interface MediaAsset {
    url: string;
    caption?: string;
}

type VisualData = {
    kpis?: KPI[];
    charts?: Chart[];
    images?: MediaAsset[];
    videos?: MediaAsset[];
};

interface Result {
    answer: string;
    contextUsed: ContextItem[];
    cached?: boolean;
    query?: string;
    timestamp?: string;
    visuals?: VisualData;
    audio?: string;
    citations?: Citation[];
}

export const KnowledgeBase: React.FC = () => {
    const { t } = useLanguage();
    const { addNotification } = useAppStore();
    const { isModern, headingClass, radiusClass, btnClass } = useThemeClasses();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isAsking, setIsAsking] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [lastResult, setLastResult] = useState<Result | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showStats, setShowStats] = useState(false);
    const [history, setHistory] = useState<{ id: string; query?: string; queryText?: string; crop?: string; category?: string; timestamp?: string; createdAt?: string }[]>([]);
    const [stats, setStats] = useState<{ crops?: { name: string; count: number }[]; categories?: { name: string; count: number }[]; totalQueries?: number; cachedQueries?: number } | null>(null);

    // Fetch history and stats on mount
    useEffect(() => {
        fetchHistory();
        fetchStats();
    }, []);

    const fetchHistory = async () => {
        try {
            const data = await fetchKnowledgeHistory();
            if (data.success) setHistory(data.data);
        } catch (err) {
            console.error('History fetch failed', err);
        }
    };

    const fetchStats = async () => {
        try {
            const data = await fetchKnowledgeStats();
            if (data.success) setStats(data.data);
        } catch (err) {
            console.error('Stats fetch failed', err);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setAttachments(prev => [
                    ...prev, 
                    { 
                        type: file.type.startsWith('image/') ? 'image' : 'file', 
                        data: base64String, 
                        name: file.name,
                        mimeType: file.type
                    }
                ]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSearch = async (queryToSearch: string) => {
        const queryText = queryToSearch || searchQuery;
        if (!queryText.trim() && attachments.length === 0) return;

        setIsAsking(true);
        setLastResult(null);
        
        try {
            const res = await askAI(queryText, attachments);
            if (res.success) {
                const result = {
                    ...res.data,
                    query: queryText || 'Multimodal Search',
                    timestamp: new Date().toISOString()
                };
                setLastResult(result);
                setAttachments([]); // Clear attachments after successful search
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
                    const query = h.queryText || h.query || '';
                    setSearchQuery(query);
                    handleSearch(query);
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
                        <h1 className={`text-4xl md:text-5xl font-black mb-4 tracking-tighter ${headingClass}`}>
                            {isModern ? 'Ontological Repository' : 'Knowledge Base'}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg max-w-2xl mx-auto">
                            {t('knowledge_subtitle')}
                        </p>
                    </div>

                    {/* Premium Search Bar */}
                    <div className="relative group mb-12">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-indigo-600 blur opacity-20 group-hover:opacity-40 transition-opacity" style={{ borderRadius: isModern ? 'calc(var(--radius-card) + 4px)' : '0px' }}></div>
                        <div className="relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 p-1.5 shadow-2xl" style={{ borderRadius: isModern ? 'var(--radius-card)' : '0px', boxShadow: isModern ? 'var(--shadow-premium)' : 'none' }}>
                            {/* Attachment Previews */}
                            {attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
                                    {attachments.map((att, i) => (
                                        <div key={i} className={`flex items-center gap-2 bg-primary-50 dark:bg-primary-900/40 px-3 py-1.5 ${radiusClass} border border-primary-100 dark:border-primary-800 group/att`}>
                                            {att.type === 'image' ? (
                                                <img src={att.data} className="w-5 h-5 object-cover rounded-md" />
                                            ) : (
                                                <FileIcon className="w-4 h-4 text-primary-500" />
                                            )}
                                            <span className="text-[10px] font-bold text-primary-700 dark:text-primary-300 max-w-[100px] truncate">{att.name}</span>
                                            <button onClick={() => removeAttachment(i)} className="text-primary-400 hover:text-rose-500 transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center">
                                <div className="pl-5 text-primary-500">
                                    <Search className="w-6 h-6" />
                                </div>
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                                    placeholder="Ask ALFA anything... (Try uploading a crop photo)"
                                    className="flex-1 bg-transparent border-none focus:ring-0 py-4 px-4 text-xl font-medium text-gray-900 dark:text-white placeholder-gray-400"
                                />
                                <div className="flex gap-2 pr-2">
                                    <label className={`p-3 ${radiusClass} hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 cursor-pointer transition-all`}>
                                        <Paperclip className="w-6 h-6" />
                                        <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                                    </label>
                                    <button 
                                        onClick={() => setIsRecording(!isRecording)}
                                        className={`p-3 ${radiusClass} transition-all ${isRecording ? 'bg-rose-100 text-rose-600 animate-pulse' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400'}`}
                                        title="Voice Input"
                                    >
                                        <Mic className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={() => setShowStats(!showStats)}
                                        className={`p-3 ${radiusClass} transition-all ${showStats ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400'}`}
                                        title="Insights"
                                    >
                                        <BarChart3 className="w-6 h-6" />
                                    </button>
                                    <Button
                                        loading={isAsking}
                                        disabled={!searchQuery.trim() && attachments.length === 0}
                                        onClick={() => handleSearch(searchQuery)}
                                        className="p-3 md:px-8 font-bold shadow-lg shadow-primary-500/20"
                                    >
                                        <span className="hidden md:inline">Generate</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </div>
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
                                {stats && <KnowledgeStats data={stats} />}
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
                                         <Badge variant="success" size="sm" className="absolute top-4 right-4">
                                             <Zap className="w-3 h-3 fill-current" />
                                             Optimized Cache
                                         </Badge>
                                     )}
                                    
                                    <div className="flex items-start gap-4 mb-8">
                                        <div className={`p-3 bg-primary-100 dark:bg-primary-900/40 ${radiusClass} text-primary-600 dark:text-primary-400`}>
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
                                    {(lastResult.visuals || lastResult.audio) && (
                                        <div className={`mt-12 mb-16 p-1 bg-gradient-to-br from-primary-500/5 to-transparent ${isModern ? 'rounded-[2.5rem]' : 'rounded-none'} border border-primary-500/10`}>
                                            <ReasoningVisuals visuals={lastResult.visuals || {}} audio={lastResult.audio} />
                                        </div>
                                    )}

                                    <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700/50 flex flex-col gap-6">
                                        <div className="flex items-center gap-2">
                                            <Info className="w-4 h-4 text-primary-500" />
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Contextual Verification Sources</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {lastResult.contextUsed.map((ctx, i) => (
                                                <div key={i} className={`px-4 py-2 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/50 ${radiusClass} flex items-center gap-2 group hover:border-primary-500/50 transition-colors cursor-pointer`}>
                                                    <div className="w-2 h-2 bg-primary-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Source</span>
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 max-w-[220px] truncate" title={ctx.metadata?.sourceUrl || ctx.metadata?.title || ''}>
                                                            {ctx.metadata?.title || `${ctx.metadata?.crop || 'General'} / ${ctx.metadata?.category || 'Expert Advice'}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* RAG v2 Citations */}
                                    {lastResult.citations && lastResult.citations.length > 0 && (
                                        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700/50">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Sparkles className="w-4 h-4 text-amber-500" />
                                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">RAG v2 Citations</span>
                                                <Badge variant="info" size="sm">Enhanced</Badge>
                                            </div>
                                            <div className="space-y-3">
                                                {lastResult.citations.map((cite, i) => (
                                                    <div key={i} className={`p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 ${radiusClass}`}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{cite.title}</span>
                                                            <Badge variant="warning" size="sm">{cite.category}</Badge>
                                                        </div>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{cite.excerpt}</p>
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 max-w-[120px]">
                                                                <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.round(cite.score * 100)}%` }}></div>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-500">{Math.round(cite.score * 100)}% match</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
                                        className="p-6 bg-theme-bg-card border border-gray-100 dark:border-gray-700 hover:border-primary-500 transition-all text-left flex items-start gap-4 group"
                                        style={{ borderRadius: isModern ? 'var(--radius-card)' : '0px' }}
                                    >
                                        <div className={`p-2 bg-gray-100 dark:bg-gray-700 ${radiusClass} group-hover:bg-primary-500 group-hover:text-white transition-colors`}>
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
