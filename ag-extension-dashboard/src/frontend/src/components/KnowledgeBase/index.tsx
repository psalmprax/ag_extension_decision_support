import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Lightbulb } from 'lucide-react';
import { askAI, fetchKnowledgeHistory, fetchKnowledgeStats, Attachment, Citation } from '@/api/knowledgeService';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { KnowledgeStats } from './KnowledgeStats';
import { KnowledgeSidebar } from './KnowledgeSidebar';
import { SearchBar } from './SearchBar';
import { AIResult } from './AIResult';
import type { VisualsData } from './types';

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

interface Result {
    answer: string;
    contextUsed: ContextItem[];
    cached?: boolean;
    query?: string;
    timestamp?: string;
    visuals?: VisualsData;
    audio?: string;
    citations?: Citation[];
}

export const KnowledgeBase: React.FC = () => {
    const { t } = useLanguage();
    const { addNotification } = useAppStore();
    const { isModern, headingClass } = useThemeClasses();

    const [searchQuery, setSearchQuery] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isAsking, setIsAsking] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [lastResult, setLastResult] = useState<Result | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showStats, setShowStats] = useState(false);
    const [history, setHistory] = useState<{ id: string; query?: string; queryText?: string; crop?: string; category?: string; timestamp?: string; createdAt?: string }[]>([]);
    const [stats, setStats] = useState<{ crops?: { name: string; count: number }[]; categories?: { name: string; count: number }[]; totalQueries?: number; cachedQueries?: number } | null>(null);

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

    const handleSearch = async (queryToSearch?: string) => {
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
                setAttachments([]);
                fetchHistory();

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

            <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
                <div className="max-w-4xl mx-auto">
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

                    <SearchBar
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        attachments={attachments}
                        setAttachments={setAttachments}
                        isAsking={isAsking}
                        isRecording={isRecording}
                        setIsRecording={setIsRecording}
                        showStats={showStats}
                        setShowStats={setShowStats}
                        onSearch={() => handleSearch()}
                    />

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
                            <AIResult result={lastResult as { answer: string; contextUsed: ContextItem[]; cached?: boolean; query?: string; timestamp?: string; visuals?: VisualsData; audio?: string; citations?: Citation[] }} />
                        ) : (
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
                                        <div className={`p-2 bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-500 group-hover:text-white transition-colors`}>
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
