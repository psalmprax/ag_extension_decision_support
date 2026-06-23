import React, { useState, useEffect, useCallback } from 'react';
import {
    Brain, Plus, Search, Edit, Trash2,
    Clock, Tag, BarChart3, RefreshCw,
    Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { fetchMemories, storeMemory, deleteMemory, fetchMemorySummary, type MemoryEntry } from '../api/memoryService';
import { MetricCard } from '@/components/MetricCard';

export function Memory() {
    const { t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass } = useThemeClasses();
    const { addNotification } = useAppStore();

    // State
    const [memories, setMemories] = useState<MemoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null);
    const [memorySummary, setMemorySummary] = useState<Array<{ category: string; count: number; avgImportance: number }>>([]);

    // Form state
    const [newMemory, setNewMemory] = useState({
        category: '',
        key: '',
        value: '',
        importance: 0.5
    });

    // Load data
    const loadData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const [memoriesRes, summaryRes] = await Promise.all([
                fetchMemories(selectedCategory === 'all' ? undefined : selectedCategory),
                fetchMemorySummary()
            ]);

            if (memoriesRes.success) {
                setMemories(memoriesRes.data);
            }
            if (summaryRes.success) {
                setMemorySummary(summaryRes.data);
            }
        } catch (error) {
            console.error('Failed to load memory data:', error);
            addNotification({
                type: 'error',
                message: t('memory_failed_load')
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedCategory, addNotification, t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = () => {
        loadData(true);
    };

    const handleAddMemory = async () => {
        if (!newMemory.category || !newMemory.key || !newMemory.value) return;

        try {
            const res = await storeMemory(newMemory.category, newMemory.key, newMemory.value, newMemory.importance);
            if (res.success) {
                addNotification({
                    type: 'success',
                    message: t('memory_stored_success')
                });
                setNewMemory({ category: '', key: '', value: '', importance: 0.5 });
                setShowAddModal(false);
                loadData();
            }
        } catch (error) {
            console.error('Failed to store memory:', error);
                addNotification({
                    type: 'error',
                    message: t('memory_failed_store')
                });
        }
    };

    const handleDeleteMemory = async (category: string, key: string) => {
        if (!confirm('Are you sure you want to delete this memory?')) return;

        try {
            const res = await deleteMemory(category, key);
            if (res.success) {
                    addNotification({
                        type: 'success',
                        message: t('memory_deleted_success')
                    });
                loadData();
            }
        } catch (error) {
            console.error('Failed to delete memory:', error);
            addNotification({
                type: 'error',
                message: 'Failed to delete memory'
            });
        }
    };

    const handleEditMemory = (memory: MemoryEntry) => {
        setEditingMemory(memory);
        setNewMemory({
            category: memory.category,
            key: memory.key,
            value: memory.value,
            importance: memory.importance
        });
        setShowAddModal(true);
    };

    const handleUpdateMemory = async () => {
        if (!editingMemory || !newMemory.category || !newMemory.key || !newMemory.value) return;

        try {
            // Delete old memory and add new one (since we don't have an update API)
            await deleteMemory(editingMemory.category, editingMemory.key);
            const res = await storeMemory(newMemory.category, newMemory.key, newMemory.value, newMemory.importance);

            if (res.success) {
                    addNotification({
                        type: 'success',
                        message: t('memory_updated_success')
                    });
                setNewMemory({ category: '', key: '', value: '', importance: 0.5 });
                setShowAddModal(false);
                setEditingMemory(null);
                loadData();
            }
        } catch (error) {
            console.error('Failed to update memory:', error);
            addNotification({
                type: 'error',
                message: 'Failed to update memory'
            });
        }
    };

    const filteredMemories = memories.filter(memory =>
        (memory.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
         memory.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
         memory.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const categories = [...new Set(memories.map(m => m.category))];


    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Memory Manager</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage AI persistent memory and knowledge</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-6 animate-pulse">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                                </div>
                                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-2xl ${headingClass}`}>{isModern ? 'Cognitive Persistence' : 'Memory Manager'}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('memory_subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700`}
                    >
                        <Plus className="w-4 h-4" />
                        Add Memory
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={`flex items-center gap-2 px-4 py-2 bg-gray-600 text-white ${btnClass} hover:bg-gray-700 disabled:opacity-50`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                        title={t('memory_total_memories')}
                    value={memories.length}
                    icon={Brain}
                    color="blue"
                />
                <MetricCard
                        title={t('memory_categories')}
                    value={categories.length}
                    icon={Tag}
                    color="green"
                />
                <MetricCard
                        title={t('memory_avg_importance')}
                    value={memorySummary.length > 0 ? (memorySummary.reduce((acc, cat) => acc + cat.avgImportance, 0) / memorySummary.length).toFixed(2) : '0.00'}
                    icon={BarChart3}
                    color="purple"
                />
                <MetricCard
                        title={t('memory_most_used')}
                    value={memories.length > 0 ? Math.max(...memories.map(m => m.accessCount)) : 0}
                    icon={Clock}
                    color="orange"
                />
            </div>

            {/* Filters and Search */}
            <div className="card p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder={t('memory_search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className={`px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                        >
                            <option value="all">All Categories</option>
                            {categories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Memory List */}
            <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('memory_title')}</h3>

                {filteredMemories.length > 0 ? (
                    <div className="space-y-4">
                        {filteredMemories.map((memory) => (
                            <motion.div
                                key={`${memory.category}-${memory.key}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 border border-gray-200 dark:border-gray-700 ${radiusClass} bg-white dark:bg-gray-800`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Tag className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                                                {memory.category}
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{memory.key}</h4>
                                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{memory.value}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => handleEditMemory(memory)}
                                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                            title="Edit Memory"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMemory(memory.category, memory.key)}
                                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                            title="Delete Memory"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-4">
                                        <span>Importance: {(memory.importance * 100).toFixed(0)}%</span>
                                        <span>Access: {memory.accessCount}</span>
                                        <span>Last: {new Date(memory.lastAccessedAt).toLocaleDateString()}</span>
                                    </div>
                                    <span>Created: {new Date(memory.createdAt).toLocaleDateString()}</span>
                                </div>

                                {/* Importance Bar */}
                                <div className="mt-3">
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${memory.importance * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Brain className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No memories found</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {searchQuery || selectedCategory !== 'all'
                                ? 'Try adjusting your search or filter criteria'
                                : 'Start by adding your first memory entry'
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Category Summary */}
            {memorySummary.length > 0 && (
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('memory_category_summary')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {memorySummary.map((category) => (
                            <div key={category.category} className={`p-4 bg-gray-50 dark:bg-gray-800 ${radiusClass}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium text-gray-900 dark:text-white">{category.category}</h4>
                                    <span className="text-2xl font-bold text-primary-600">{category.count}</span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Avg Importance: {(category.avgImportance * 100).toFixed(0)}%
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add/Edit Memory Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white dark:bg-gray-800 ${radiusClass} max-w-md w-full`}
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    {editingMemory ? t('memory_edit') : t('memory_add_new')}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setEditingMemory(null);
                                        setNewMemory({ category: '', key: '', value: '', importance: 0.5 });
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Category
                                    </label>
                                    <input
                                        type="text"
                                        value={newMemory.category}
                                        onChange={(e) => setNewMemory(prev => ({ ...prev, category: e.target.value }))}
                                        placeholder="e.g., farming, weather, crops"
                                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Key
                                    </label>
                                    <input
                                        type="text"
                                        value={newMemory.key}
                                        onChange={(e) => setNewMemory(prev => ({ ...prev, key: e.target.value }))}
                                        placeholder={t('memory_unique_identifier')}
                                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Value/Content
                                    </label>
                                    <textarea
                                        value={newMemory.value}
                                        onChange={(e) => setNewMemory(prev => ({ ...prev, value: e.target.value }))}
                                        placeholder={t('memory_content')}
                                        rows={4}
                                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Importance: {(newMemory.importance * 100).toFixed(0)}%
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={newMemory.importance}
                                        onChange={(e) => setNewMemory(prev => ({ ...prev, importance: parseFloat(e.target.value) }))}
                                        className="w-full"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={editingMemory ? handleUpdateMemory : handleAddMemory}
                                        disabled={!newMemory.category || !newMemory.key || !newMemory.value}
                                        className={`flex-1 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
                                    >
                                        {editingMemory ? t('memory_edit') : t('memory_add_new')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setEditingMemory(null);
                                            setNewMemory({ category: '', key: '', value: '', importance: 0.5 });
                                        }}
                                        className={`px-4 py-2 bg-gray-600 text-white ${btnClass} hover:bg-gray-700`}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

export default Memory;