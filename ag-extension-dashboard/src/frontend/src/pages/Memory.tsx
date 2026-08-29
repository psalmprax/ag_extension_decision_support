import React, { useState } from 'react';
import {
  Brain,
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  RefreshCw,
  Filter,
  Radio,
  Sparkles,
  X,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useResourceLoader } from '@/hooks/useResourceLoader';
import { useAppStore } from '../store/useAppStore';
import {
  fetchMemories,
  storeMemory,
  deleteMemory,
  fetchMemorySummary,
  type MemoryEntry,
} from '../api/memoryService';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';
import { RagKnowledgeGraphCanvas } from '@/components/canvas-ui/RagKnowledgeGraphCanvas';

export function Memory() {
  const { t } = useLanguage();
  const { addNotification } = useAppStore();

  type MemoryResources = {
    memories: MemoryEntry[];
    summary: Array<{ category: string; count: number; avgImportance: number }>;
  };
  const loader = useResourceLoader<MemoryResources>({
    load: async category => ({
      memories: await fetchMemories(category),
      summary: await fetchMemorySummary(),
    }),
    errorMessage: t('memory_failed_load') || 'Failed to load vector memories',
  });
  const memories = loader.data.memories ?? [];
  const memorySummary = loader.data.summary ?? [];
  const { selectedCategory, setSelectedCategory, isLoading, isRefreshing, reload } =
    loader;

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null);

  const [newMemory, setNewMemory] = useState({
    category: '',
    key: '',
    value: '',
    importance: 0.5,
  });

  const handleAddMemory = async () => {
    if (!newMemory.category || !newMemory.key || !newMemory.value) return;

    try {
      const res = await storeMemory(
        newMemory.category,
        newMemory.key,
        newMemory.value,
        newMemory.importance
      );
      if (res.success) {
        addNotification({
          type: 'success',
          message: t('memory_stored_success') || 'Memory successfully indexed in vector store',
        });
        setNewMemory({ category: '', key: '', value: '', importance: 0.5 });
        setShowAddModal(false);
        reload();
      }
    } catch (error) {
      console.error('Failed to store memory:', error);
      addNotification({
        type: 'error',
        message: t('memory_failed_store') || 'Failed to index memory',
      });
    }
  };

  const handleDeleteMemory = async (category: string, key: string) => {
    if (!confirm('Are you sure you want to delete this memory vector?')) return;

    try {
      const res = await deleteMemory(category, key);
      if (res.success) {
        addNotification({
          type: 'success',
          message: t('memory_deleted_success') || 'Vector memory pruned',
        });
        reload();
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
      addNotification({
        type: 'error',
        message: 'Failed to delete memory',
      });
    }
  };

  const handleEditMemory = (memory: MemoryEntry) => {
    setEditingMemory(memory);
    setNewMemory({
      category: memory.category,
      key: memory.key,
      value: memory.value,
      importance: memory.importance,
    });
    setShowAddModal(true);
  };

  const categories = Array.from(new Set(memories.map(m => m.category)));
  const filteredMemories = memories.filter(memory => {
    const matchesSearch =
      searchQuery === '' ||
      memory.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalAccesses = memories.reduce((acc, m) => acc + (m.accessCount || 0), 0);
  const avgImportanceScore = memories.length > 0 
    ? (memories.reduce((acc, m) => acc + (m.importance || 0), 0) / memories.length) * 100 
    : 0;

  if (isLoading) {
    return (
      <LoadingHeaderSkeleton
        title="Agentic Memory Engine"
        description="Dynamic RAG vector store & knowledge graph"
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* ── Top Bento Banner: Agent Memory Engine ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-950/40">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">Agent Memory & Knowledge Engine</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <Radio className="w-2.5 h-2.5 text-purple-400 animate-pulse" />
                  RAG Vector Store Synced
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Dynamic conversational memory, regional skill cards, and semantic recall embeddings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            {/* KPI Telemetry Chips */}
            <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">Vectors</span>
                <strong className="text-sm font-bold text-white font-mono">{memories.length}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">Categories</span>
                <strong className="text-sm font-bold text-purple-400 font-mono">{categories.length}</strong>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-center sm:text-left">
                <span className="text-xxs font-semibold text-white/40 uppercase block">Mean Score</span>
                <strong className="text-sm font-bold text-emerald-400 font-mono">{avgImportanceScore.toFixed(0)}%</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingMemory(null);
                  setNewMemory({ category: '', key: '', value: '', importance: 0.5 });
                  setShowAddModal(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-950/40 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Inject Memory</span>
              </button>
              <button
                onClick={() => reload()}
                disabled={isRefreshing}
                className="px-3.5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-5 border-t border-white/5">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search vector keys, semantic values, or categories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-white/30 focus:ring-1 focus:ring-purple-400 outline-none"
            />
          </div>

          <div className="relative w-full sm:w-56">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-9 py-2 text-xs rounded-xl border border-white/10 bg-slate-900 text-white focus:ring-1 focus:ring-purple-400 outline-none"
            >
              <option value="all">All Vector Categories ({memories.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Real-Time Impulse Knowledge Graph ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Dynamic RAG Semantic Mesh</h3>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xxs font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Real-Time Impulse Graph
          </span>
        </div>
        <RagKnowledgeGraphCanvas
          customNodes={
            memories.length > 0
              ? memories.slice(0, 12).map((m, idx) => ({
                  id: `mem-${m.id || idx}`,
                  label: m.key,
                  category: (m.category === 'fao' ||
                  m.category === 'soil' ||
                  m.category === 'nasa' ||
                  m.category === 'farmer' ||
                  m.category === 'rule'
                    ? m.category
                    : 'rule') as 'fao' | 'soil' | 'nasa' | 'farmer' | 'rule',
                  snippet: typeof m.value === 'string' ? m.value : JSON.stringify(m.value),
                  score: m.importance ?? 0,
                }))
              : undefined
          }
        />
      </div>

      {/* ── Memory Vector Entry Grid ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            Indexed Memories & Knowledge Vectors ({filteredMemories.length})
          </h3>
          <span className="text-xs text-white/40 font-mono">Total Accesses: {totalAccesses}</span>
        </div>

        {filteredMemories.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto shadow-lg shadow-purple-950/40">
              <Brain className="w-8 h-8 opacity-70" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No Memory Vectors Found</h3>
              <p className="text-xs text-white/50 max-w-sm mx-auto">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No vector entries match the current search query or category filter.'
                  : 'The agent has no custom episodic memory entries yet. Inject your first agronomic rule.'}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingMemory(null);
                setNewMemory({ category: '', key: '', value: '', importance: 0.5 });
                setShowAddModal(true);
              }}
              className="px-5 py-2.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Knowledge Vector</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMemories.map(memory => (
              <motion.div
                key={`${memory.category}-${memory.key}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 rounded-xl p-5 space-y-3 transition-all duration-300 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      <Tag className="w-2.5 h-2.5" />
                      {memory.category}
                    </span>
                    <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                      {memory.key}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditMemory(memory)}
                      className="p-1.5 text-white/40 hover:text-purple-300 rounded-lg hover:bg-white/5 transition-all"
                      title="Edit Memory"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMemory(memory.category, memory.key)}
                      className="p-1.5 text-white/40 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-all"
                      title="Delete Memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-white/70 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-white/5 font-mono">
                  {memory.value}
                </p>

                {/* Importance Bar & Telemetry */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xxs font-mono text-white/40">
                    <span>Importance: {((memory.importance || 0.5) * 100).toFixed(0)}%</span>
                    <span>Accesses: {memory.accessCount || 0}</span>
                    <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(memory.importance || 0.5) * 100}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Category Cluster Summary ── */}
      {memorySummary.length > 0 && (
        <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Category Vector Distribution & Cluster Strength
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memorySummary.map(category => (
              <div
                key={category.category}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-xs text-white uppercase tracking-wider">{category.category}</h4>
                  <p className="text-xxs font-mono text-white/40 mt-0.5">
                    Mean Recall: {(category.avgImportance * 100).toFixed(0)}%
                  </p>
                </div>
                <span className="text-lg font-mono font-bold text-purple-400">{category.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add / Edit Memory Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => {
              setShowAddModal(false);
              setEditingMemory(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="backdrop-blur-2xl bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg p-6 sm:p-8 space-y-6 text-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      {editingMemory ? 'Edit Knowledge Vector' : 'Inject New Knowledge Vector'}
                    </h2>
                    <p className="text-xs text-white/50">Store regional agronomy facts in agent RAG</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingMemory(null);
                  }}
                  className="p-1.5 text-white/40 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Category *</label>
                  <input
                    type="text"
                    value={newMemory.category}
                    onChange={e => setNewMemory({ ...newMemory, category: e.target.value })}
                    placeholder="e.g. soil_ph, crop_rotation, pest_protocol"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Vector Key *</label>
                  <input
                    type="text"
                    value={newMemory.key}
                    onChange={e => setNewMemory({ ...newMemory, key: e.target.value })}
                    placeholder="e.g. maize_nitrogen_deficiency_remedy"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-purple-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-white/60">Knowledge Value / Fact *</label>
                  <textarea
                    rows={4}
                    value={newMemory.value}
                    onChange={e => setNewMemory({ ...newMemory, value: e.target.value })}
                    placeholder="Provide the exact agronomic guidance, fertilizer ratio, or disease symptom description..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs outline-none focus:ring-1 focus:ring-purple-400 resize-none font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xxs font-bold uppercase tracking-wider text-white/60">
                    <span>Recall Importance Weight</span>
                    <span className="text-purple-400 font-mono font-bold">{(newMemory.importance * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={newMemory.importance}
                    onChange={e => setNewMemory({ ...newMemory, importance: parseFloat(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingMemory(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMemory}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-950/40"
                  >
                    {editingMemory ? 'Update Vector' : 'Inject Vector'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Memory;
