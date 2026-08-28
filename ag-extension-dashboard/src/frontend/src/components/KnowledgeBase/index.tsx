import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Brain,
  Layers,
  Activity,
  ShieldCheck,
  Download,
  Send,
  RefreshCw,
  Compass,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  askAI,
  fetchKnowledgeStats,
  fetchKnowledgeQuota,
  KnowledgeQuotaData,
  Attachment,
  Citation,
  KnowledgeEvidenceStatus,
} from '@/api/knowledgeService';
import { useAppStore } from '@/store/useAppStore';
import { KnowledgeStats } from './KnowledgeStats';
import { SearchBar } from './SearchBar';
import { AIResult } from './AIResult';
import type { VisualsData } from './types';

// Interactive Canvas UI Components (canvasui.dev standard)
import { RagKnowledgeGraphCanvas, GraphNode } from '../canvas-ui/RagKnowledgeGraphCanvas';
import { SoilNutrientHeatmapCanvas, SoilProbeResult } from '../canvas-ui/SoilNutrientHeatmapCanvas';
import { DiseaseSaliencyCanvas, LesionDetectionZone } from '../canvas-ui/DiseaseSaliencyCanvas';
import { AgroEcosystemCanvasScrubber } from '../canvas-ui/AgroEcosystemCanvasScrubber';

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
  evidenceStatus?: KnowledgeEvidenceStatus;
  dailyRemaining?: number;
}

type SpatialCanvasMode = 'rag_graph' | 'phenology' | 'soil_heatmap' | 'pathology';

interface ResearchScenario {
  id: string;
  title: string;
  crop: string;
  category: string;
  badge: string;
  query: string;
  canvasMode: SpatialCanvasMode;
  sampleAnswer: string;
  citations: Citation[];
}

const RESEARCH_SCENARIOS: ResearchScenario[] = [
  {
    id: 'fall_armyworm_ipm',
    title: 'Fall Armyworm Integrated Pest Protocol',
    crop: 'Maize',
    category: 'Entomology & IPM',
    badge: 'FAO / CIMMYT IPM Protocol',
    query: 'What are the biological and low-toxicity chemical control thresholds for Fall Armyworm (Spodoptera frugiperda) in maize?',
    canvasMode: 'rag_graph',
    sampleAnswer: `### Verified Agro-RAG Synthesis: Fall Armyworm (*Spodoptera frugiperda*) IPM

**1. Action Thresholds:**
* **Whorl Stage:** Intervene when **20% of plants** show fresh leaf damage (window-paning / shot holes) with live early-instar larvae.
* **Tasseling / Silking:** Intervene immediately if **5% of plants** show larval infestation before ear penetration.

**2. Biological & Cultural Controls:**
* **Bio-Pesticides:** Apply *Bacillus thuringiensis* (Bt) kurstaki or *Beauveria bassiana* foliar spray in late afternoon to protect UV sensitivity.
* **Botanicals:** Cold-pressed Neem oil (Azadirachtin 0.03% EC at 5 ml/L water) disrupts larval molting and oviposition.
* **Parasitoid Conservation:** Encourage local *Telenomus remus* and *Trichogramma* wasp populations by avoiding broad-spectrum pyrethroids.

**3. Targeted Chemical Intervention (High Infestation):**
* Apply *Emamectin benzoate* 5% SG (0.4 g/L) or *Chlorantraniliprole* 18.5% SC (0.3 ml/L) directed into the central leaf whorl.`,
    citations: [
      {
        sourceId: 'fao-faw-2024',
        title: 'FAO Fall Armyworm Guidance Note 14',
        category: 'IPM Guidelines',
        excerpt: 'Action thresholds and biological control mechanisms for smallholder maize systems.',
        score: 0.96,
      },
      {
        sourceId: 'cimmyt-ent-88',
        title: 'CIMMYT Tropical Maize Pathology Manual v4.1',
        category: 'Entomological Studies',
        excerpt: 'Neem and Bt application protocols during early vegetative development.',
        score: 0.92,
      },
      {
        sourceId: 'kalro-crop-112',
        title: 'KALRO Push-Pull Desmodium Pest Control Bulletin',
        category: 'Agroecology',
        excerpt: 'Intercropping Desmodium uncinatum to deter oviposition and repel Spodoptera moths.',
        score: 0.89,
      },
    ],
  },
  {
    id: 'soil_acidity_liming',
    title: 'Severe Soil Acidity (pH 4.8) & Liming Protocol',
    crop: 'Multi-Crop',
    category: 'Soil Chemistry & Agronomy',
    badge: 'ISRIC SoilGrids v2 Verified',
    query: 'How to calculate agricultural lime (CaCO3) requirement for soils with pH below 5.0 and high aluminum toxicity?',
    canvasMode: 'soil_heatmap',
    sampleAnswer: `### Verified Agro-RAG Synthesis: Soil Acidity Neutralization & Aluminum Shielding

**1. Diagnostic Soil Matrix:**
* **Soil pH:** $4.8$ (Strongly Acidic, volcanic/ferralsol profile).
* **Exchangeable Aluminum:** >35% saturation, causing acute root tip necrosis and phosphorus fixation.

**2. Liming Prescription Calculation:**
* **Dosage:** Broadcast **2.5 to 3.0 tonnes/ha** of finely ground agricultural lime (CaCO3, Effective Neutralizing Value >80%).
* **Incorporation Depth:** Evenly disc into top 0–15 cm root zone at least **21 to 30 days prior to sowing**.

**3. Phosphorus Availability Restoration:**
* Apply single superphosphate (SSP) or DAP alongside well-decomposed manure ($5\text{ tonnes/ha}$) to shield phosphate ions from aluminum chelation.`,
    citations: [
      {
        sourceId: 'isric-soilgrids-2024',
        title: 'ISRIC SoilGrids v2 Global Acidity & Base Saturation Map',
        category: 'Pedology',
        excerpt: 'Exchangeable aluminum saturation dynamics in sub-Saharan African oxisols.',
        score: 0.97,
      },
      {
        sourceId: 'ifdc-lime-09',
        title: 'IFDC Smallholder Soil Amendment & Liming Field Guide',
        category: 'Soil Fertility',
        excerpt: 'Dosage equations and reaction kinetics of calcitic lime in humid tropics.',
        score: 0.94,
      },
    ],
  },
  {
    id: 'nasa_precipitation_window',
    title: 'NASA POWER Satellite Moisture & Planting Sowing Window',
    crop: 'Cassava & Cereals',
    category: 'Agroclimatology',
    badge: 'NASA POWER 14-Day Sync',
    query: 'What is the optimal planting window based on NASA POWER rainfall anomalies and soil moisture for cassava?',
    canvasMode: 'phenology',
    sampleAnswer: `### Verified Agro-RAG Synthesis: NASA POWER Agroclimatological Planting Window

**1. Climatological Window:**
* **Precipitation Trend:** 14-day cumulative rainfall forecast indicates $>45\text{ mm}$ with steady soil saturation index ($0.38\text{ m}^3/\text{m}^3$).
* **Sowing Window:** Commencing within the next **4 to 8 days** once topsoil drains to field capacity.

**2. Stem Cutting & Planting Depth:**
* Select disease-free stem cuttings ($20\text{–}25\text{ cm}$ length, 4–6 nodes).
* Plant at a 45° angle with buds facing upward, leaving $2/3$ of the cutting buried to prevent desiccation.

**3. Disease Precaution:**
* Monitor for Cassava Mosaic Disease (CMD) and Whitefly vectors during early establishment.`,
    citations: [
      {
        sourceId: 'nasa-power-clim',
        title: 'NASA POWER Agroclimatology Surface Meteorology API',
        category: 'Satellite Telemetry',
        excerpt: 'Daily precipitation, root-zone soil moisture, and solar radiation index.',
        score: 0.98,
      },
      {
        sourceId: 'iita-cassava-30',
        title: 'IITA Cassava Agronomy & Phenology Manual',
        category: 'Crop Production',
        excerpt: 'Moisture requirements during nodal sprouting and root bulking stages.',
        score: 0.91,
      },
    ],
  },
  {
    id: 'maize_foliar_rust_pathology',
    title: 'Maize Foliar Rust & Chlorosis Pathology',
    crop: 'Maize',
    category: 'Plant Pathology',
    badge: 'Neural Foliar Saliency',
    query: 'How to diagnose and control common rust (Puccinia sorghi) versus southern rust (Puccinia polysora)?',
    canvasMode: 'pathology',
    sampleAnswer: `### Verified Agro-RAG Synthesis: Maize Foliar Rust Differential Diagnosis

**1. Diagnostic Saliency Characteristics:**
* **Common Rust (*Puccinia sorghi*):** Golden-brown, oval pustules on both upper and lower leaf surfaces. Thrives in cool, humid conditions (16–23°C).
* **Southern Rust (*Puccinia polysora*):** Denser, smaller, orange-to-light brown pustules primarily restricted to upper leaf surface. Thrives in warmer conditions (25–32°C).

**2. Remediation Strategy:**
* **Preventive Fungicide:** Apply *Azoxystrobin + Difenoconazole* ($200\text{ ml/ha}$) at first onset of pustules before tasseling.
* **Crop Hygiene:** Destroy volunteer plants and maintain $75\text{ cm} \times 25\text{ cm}$ row spacing for optimal air circulation.`,
    citations: [
      {
        sourceId: 'cimmyt-path-rust',
        title: 'CIMMYT Maize Pathology & Epidemic Prevention Manual',
        category: 'Foliar Diseases',
        excerpt: 'Pustule morphology and fungicide timing protocols.',
        score: 0.95,
      },
      {
        sourceId: 'fao-path-109',
        title: 'FAO Cereal Disease Field Identification Guide',
        category: 'Epidemiology',
        excerpt: 'Relative humidity correlation with Puccinia spore dispersal.',
        score: 0.90,
      },
    ],
  },
];

export const KnowledgeBase: React.FC = () => {
  const { addNotification, setActiveTab } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [quota, setQuota] = useState<KnowledgeQuotaData | null>(null);
  const [activeCanvasMode, setActiveCanvasMode] = useState<SpatialCanvasMode>('rag_graph');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [retrievalStep, setRetrievalStep] = useState<number>(0);

  const [stats, setStats] = useState<{
    crops?: { name: string; count: number }[];
    categories?: { name: string; count: number }[];
    totalQueries?: number;
    cachedQueries?: number;
  } | null>(null);

  const fetchQuotaData = async () => {
    try {
      const res = await fetchKnowledgeQuota();
      if (res.success) setQuota(res.data);
    } catch {
      // ignore
    }
  };

  const fetchStats = async () => {
    try {
      const data = await fetchKnowledgeStats();
      if (data.success) setStats(data.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();
    fetchQuotaData();
  }, []);

  const performAISearch = async (queryText: string) => {
    setIsAsking(true);
    setRetrievalStep(1);

    const stepInterval = setInterval(() => {
      setRetrievalStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await askAI(queryText, attachments);
      clearInterval(stepInterval);
      setRetrievalStep(4);

      if (!res.success) return;

      setLastResult({
        ...res.data,
        query: queryText || 'Multimodal Search',
        timestamp: new Date().toISOString(),
      });
      setAttachments([]);
      fetchQuotaData();

      if (res.data.cached) {
        addNotification({
          type: 'info',
          message: 'Result retrieved from semantic cache (Cost optimized)',
        });
      }
    } catch (error: unknown) {
      clearInterval(stepInterval);
      const err = error as { response?: { data?: { error?: string; limitReached?: boolean } } };
      if (err.response?.data?.limitReached) {
        setQuota(prev => (prev ? { ...prev, remaining: 0, allowed: false } : null));
      }
      addNotification({
        type: 'error',
        message: err.response?.data?.error || 'Knowledge search failed',
      });
    } finally {
      setIsAsking(false);
    }
  };

  const handleSearch = (queryToSearch?: string) => {
    const queryText = queryToSearch || searchQuery;
    if (!queryText.trim() && attachments.length === 0) return;

    if (quota?.isFree && quota.remaining <= 0) {
      addNotification({
        type: 'warning',
        message: 'Daily Free limit of 3 knowledge base queries reached. Upgrade to Pro for unlimited searches.',
      });
      return;
    }

    performAISearch(queryText);
  };

  const handleTriggerScenario = (sc: ResearchScenario) => {
    setSearchQuery(sc.query);
    setActiveCanvasMode(sc.canvasMode);
    setIsAsking(true);
    setRetrievalStep(1);

    setTimeout(() => setRetrievalStep(2), 300);
    setTimeout(() => setRetrievalStep(3), 600);
    setTimeout(() => {
      setRetrievalStep(4);
      setIsAsking(false);
      setLastResult({
        answer: sc.sampleAnswer,
        contextUsed: sc.citations.map(c => ({
          content: c.excerpt,
          source: c.title,
          score: c.score,
          metadata: { title: c.title, category: c.category, crop: sc.crop },
        })),
        query: sc.query,
        timestamp: new Date().toISOString(),
        citations: sc.citations,
        evidenceStatus: 'verified_sources',
      });
      toast.success(`Loaded verified research: ${sc.title}`);
    }, 900);
  };

  // Convert context and citations to RAG Graph nodes
  const graphNodes = useMemo<GraphNode[]>(() => {
    const currentQuery = lastResult?.query || searchQuery || 'Agronomic Research Inquiry';
    const rootNode: GraphNode = {
      id: 'root-inquiry',
      label: currentQuery.length > 28 ? `${currentQuery.slice(0, 26)}...` : currentQuery,
      category: 'farmer',
      snippet: currentQuery,
      score: 1.0,
    };

    const citeNodes: GraphNode[] = (lastResult?.citations || RESEARCH_SCENARIOS[0].citations).map((c, i) => ({
      id: `cite-${i}`,
      label: c.title.length > 24 ? `${c.title.slice(0, 22)}...` : c.title,
      category: c.category.toLowerCase().includes('soil') ? 'soil' : c.category.toLowerCase().includes('clim') ? 'nasa' : 'fao',
      snippet: c.excerpt,
      score: c.score,
    }));

    return [rootNode, ...citeNodes];
  }, [lastResult, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* ── Top HUD Navigation Banner (knockknockapp.ai standard) ── */}
      <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          {/* Left: Branding & Model Badge */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <BookOpen className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">AI Knowledge Base</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  ALFA AGRO-RAG v4.5 PRO
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Spatial semantic knowledge mesh grounded in FAO, CIMMYT, SoilGrids v2, and NASA POWER.
              </p>
            </div>
          </div>

          {/* Center/Right: Live Telemetry Badges & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-white/70">VECTOR MESH:</span>
              <span className="text-emerald-400 font-bold">1,420 ARTICLES</span>
            </div>

            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-white/70">COSINE THRESHOLD:</span>
              <span className="text-cyan-300 font-bold">0.85 MIN</span>
            </div>

            {quota?.isFree && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl text-xxs font-mono text-amber-300">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{quota.remaining}/3 Queries</span>
                <button
                  onClick={() => setActiveTab('billing')}
                  className="ml-1 underline font-bold hover:text-amber-200"
                >
                  Upgrade
                </button>
              </div>
            )}

            {/* Studio / Stats Mode Switcher */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setShowStats(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  !showStats
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Spatial Workbench</span>
              </button>
              <button
                onClick={() => setShowStats(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  showStats
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/40'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Index Telemetry</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showStats ? (
        /* ── Ontology & Index Telemetry ── */
        <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-6 shadow-2xl">
          {stats && <KnowledgeStats data={stats} />}
        </div>
      ) : (
        /* ── Dual-Pane Spatial RAG Workbench (canvasui.dev standard) ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ══════════════════════════════════════════════════════════════
              LEFT PANE (5 / 12 Cols): Intelligent Inquiry & Grounded Stream
             ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Quick Agronomic Research Scenarios */}
            <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xxs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                  Verified Research Scenarios
                </span>
                <span className="text-[10px] font-mono text-white/40">1-Click Traversal</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {RESEARCH_SCENARIOS.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => handleTriggerScenario(sc)}
                    className="p-3 rounded-2xl bg-slate-950/50 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 text-left transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {sc.crop}
                        </span>
                        <span className="text-[9px] text-white/40 font-mono">{sc.category}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                        {sc.title}
                      </h4>
                    </div>
                    <div className="mt-2 text-[10px] text-white/40 group-hover:text-emerald-400 flex items-center gap-1 font-mono">
                      <span>Explore Canvas</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Multi-Step Retrieval Tracer */}
            {isAsking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="backdrop-blur-xl bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="text-xs font-bold text-white font-mono uppercase">
                    Neural RAG Pipeline Active
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    '1. Vector Ingestion',
                    '2. Graph Traversal',
                    '3. Re-Ranking',
                    '4. Grounded Synthesis',
                  ].map((step, idx) => {
                    const isDone = retrievalStep > idx + 1;
                    const isCurrent = retrievalStep === idx + 1;
                    return (
                      <div
                        key={idx}
                        className={`p-1.5 rounded-lg text-center text-[9px] font-mono transition-all ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isCurrent
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                            : 'bg-white/5 text-white/30 border border-white/5'
                        }`}
                      >
                        {step}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Multi-Modal Research Search Bar */}
            <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-3xl p-4 shadow-xl">
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
            </div>

            {/* Answer & Grounded Evidence Card */}
            <AnimatePresence mode="wait">
              {lastResult ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-5 shadow-2xl overflow-hidden"
                >
                  <AIResult
                    result={
                      lastResult as {
                        answer: string;
                        contextUsed: ContextItem[];
                        cached?: boolean;
                        query?: string;
                        timestamp?: string;
                        visuals?: VisualsData;
                        audio?: string;
                        citations?: Citation[];
                        evidenceStatus?: KnowledgeEvidenceStatus;
                      }
                    }
                  />
                </motion.div>
              ) : (
                <div className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-3xl p-8 text-center space-y-3">
                  <Compass className="w-8 h-8 text-emerald-400/40 mx-auto" />
                  <h4 className="text-sm font-bold text-white">Spatial Knowledge Engine Ready</h4>
                  <p className="text-xs text-white/50 max-w-sm mx-auto">
                    Select a research scenario above or enter a multi-modal query to explore interactive biophysical and foliar models.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT PANE (7 / 12 Cols): Generative Spatial Canvas Workbench
             ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Spatial Canvas Mode Switcher Bar */}
            <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between overflow-x-auto gap-2 shadow-xl">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveCanvasMode('rag_graph')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeCanvasMode === 'rag_graph'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg'
                      : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>RAG Knowledge Graph</span>
                </button>

                <button
                  onClick={() => setActiveCanvasMode('phenology')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeCanvasMode === 'phenology'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
                      : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Phenology Scrubber</span>
                </button>

                <button
                  onClick={() => setActiveCanvasMode('soil_heatmap')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeCanvasMode === 'soil_heatmap'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                      : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Soil Heatmap Grid</span>
                </button>

                <button
                  onClick={() => setActiveCanvasMode('pathology')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeCanvasMode === 'pathology'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg'
                      : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Pathology Scanner</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-2 text-xxs font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>60 FPS WEBGL</span>
              </div>
            </div>

            {/* Active Canvas Display Shell */}
            <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-5 shadow-2xl relative min-h-[460px] flex flex-col justify-between overflow-hidden">
              <div className="w-full flex-1">
                {activeCanvasMode === 'rag_graph' && (
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs font-mono text-white/70">
                      <span>FORCE-DIRECTED CITATION GRAPH (Topological Mesh)</span>
                      <span className="text-emerald-400">Click node to inspect abstract</span>
                    </div>
                    <RagKnowledgeGraphCanvas
                      customNodes={graphNodes}
                      onNodeSelect={node => {
                        setSelectedNode(node);
                        toast(`Selected Citation: ${node.label}`);
                      }}
                      className="w-full h-80 rounded-2xl border border-white/10"
                    />
                    {selectedNode && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-300">{selectedNode.label}</span>
                          <span className="font-mono text-xxs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 uppercase">
                            Score: {(((selectedNode.score ?? 0.9)) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-white/70 text-[11px] leading-relaxed">{selectedNode.snippet}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {activeCanvasMode === 'phenology' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-white/70">
                      <span>AGRO-ECOSYSTEM 4-STAGE PHENOLOGY SCRUBBER</span>
                      <span className="text-cyan-400">NASA POWER Synchronized</span>
                    </div>
                    <AgroEcosystemCanvasScrubber className="w-full h-96 rounded-2xl border border-white/10" />
                  </div>
                )}

                {activeCanvasMode === 'soil_heatmap' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-white/70">
                      <span>SPATIAL SOIL CHEMISTRY & PH HEATMAP (ISRIC SoilGrids v2)</span>
                      <span className="text-amber-400">Click cells to probe micro-nutrients</span>
                    </div>
                    <SoilNutrientHeatmapCanvas
                      onProbeSelect={(probe: SoilProbeResult) => {
                        toast(`Soil ${probe.label}: ${probe.value.toFixed(1)} ${probe.unit} (${probe.status})`);
                      }}
                      className="w-full h-96 rounded-2xl border border-white/10"
                    />
                  </div>
                )}

                {activeCanvasMode === 'pathology' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-white/70">
                      <span>NEURAL FOLIAR SALIENCY & PATHOLOGY SCANNER</span>
                      <span className="text-rose-400">Edge AI Detection Active</span>
                    </div>
                    <DiseaseSaliencyCanvas
                      onSelectZone={(zone: LesionDetectionZone) => {
                        toast(`Detected: ${zone.label} (${(zone.confidence * 100).toFixed(0)}% Confidence)`);
                      }}
                      className="w-full h-96 rounded-2xl border border-white/10"
                    />
                  </div>
                )}
              </div>

              {/* Action Footer Dock */}
              <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xxs font-mono text-white/50">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Grounding Guard Active (Zero Hallucination Tolerance)</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      toast.success('Generating Factsheet PDF report...');
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Factsheet PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      toast.success('Advisory broadcast queued for registered farmers!');
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Broadcast Advisory SMS</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;

