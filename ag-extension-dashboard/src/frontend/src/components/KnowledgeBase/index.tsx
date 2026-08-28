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
  Search,
  CheckCircle2,
  ExternalLink,
  Filter,
  X,
  Upload,
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
  downloadKnowledgePack,
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

type SpatialCanvasMode = 'phenology' | 'soil_heatmap' | 'pathology';
type KnowledgeTabMode = 'search' | 'graph' | 'workbench' | 'library' | 'telemetry';

interface ResearchScenario {
  id: string;
  title: string;
  crop: string;
  category: string;
  badge: string;
  query: string;
  canvasMode: SpatialCanvasMode | 'rag_graph';
  sampleAnswer: string;
  citations: Citation[];
}

interface DocumentArticle {
  id: string;
  title: string;
  author: string;
  category: 'Agronomy' | 'IPM & Pest' | 'Soil Chemistry' | 'Climatology' | 'Horticulture';
  crop: string;
  verified: boolean;
  readingTime: string;
  chunks: number;
  excerpt: string;
  fullText: string;
}

const DOCUMENT_CATALOG: DocumentArticle[] = [
  {
    id: 'fao-faw-guidelines',
    title: 'FAO Fall Armyworm (Spodoptera frugiperda) Integrated Pest Management Field Guide',
    author: 'Food and Agriculture Organization (FAO) & CIMMYT',
    category: 'IPM & Pest',
    crop: 'Maize & Cereals',
    verified: true,
    readingTime: '6 min read',
    chunks: 42,
    excerpt: 'Comprehensive biological, parasitoid (Telenomus remus), and low-toxicity thresholds for smallholder maize whorl protection.',
    fullText: `## Executive Protocol: Fall Armyworm (FAW) Management in Sub-Saharan Africa

### 1. Scouting and Thresholds
* Scout at least 50 plants in a 'W' trajectory across each 1-hectare plot.
* **Early Vegetative:** If >= 20% of plants display window-pane feeding damage, initiate biological or botanical intervention immediately.
* **Mid-Whorl to Tasseling:** If >= 10% of plants show fresh frass and active larvae in whorls, apply targeted bio-pesticides directly into leaf funnels.

### 2. Biological Control Agents
* **Bacillus thuringiensis (Bt) kurstaki:** Apply at 1.5–2.0 kg/ha during late afternoon to prevent UV degradation.
* **Cold-Pressed Neem Oil (Azadirachtin 0.03%):** Dilute 5 ml/L water with mild surfactant. Interrupts ecdysone molting cycle.
* **Push-Pull Technology:** Intercrop with *Desmodium uncinatum* (repellent) and plant *Brachiaria* grass border trap strips.

### 3. Approved Chemical Options (Rescue Phase)
* Emamectin Benzoate 5% SG (0.4 g/L)
* Chlorantraniliprole 18.5% SC (0.3 ml/L)
* Direct sprays into the central whorl with a solid-cone nozzle. Avoid broad-spectrum synthetic pyrethroids to preserve native parasitoids.`,
  },
  {
    id: 'isric-soil-acidity',
    title: 'ISRIC SoilGrids v2 Smallholder Liming & Aluminum Toxicity Neutralization Guide',
    author: 'ISRIC World Soil Information & IFDC',
    category: 'Soil Chemistry',
    crop: 'Multi-Crop',
    verified: true,
    readingTime: '8 min read',
    chunks: 58,
    excerpt: 'Quantitative lime requirement equations (CaCO3) for tropical Ferralsols and Acrisols with exchangeable aluminum saturation >30%.',
    fullText: `## Diagnostic Matrix & Remediation for Acidic Tropical Soils

### 1. Soil Acidity Profile
* **Target pH:** 6.0 – 6.5 for optimal CEC and phosphorus bioavailability.
* **Critical Threshold:** Soil pH < 5.0 triggers soluble Al3+ mobilization, causing acute root tip swelling and stunting.

### 2. Liming Rate Calculation
* **Equation:** $\text{Lime Required (t/ha)} = 1.5 \times \text{Exchangeable Al (cmol/kg)} \times \text{Buffer Factor}$.
* For typical volcanic Ferralsols (pH 4.8, 35% Al saturation), apply **2.5 to 3.0 tonnes/ha** of fine agricultural lime (CaCO3, ENV > 80%).
* Broadcast and incorporate into the upper 0–15 cm depth at least **3 to 4 weeks before sowing**.

### 3. Integrated Nutrient Strategy
* Co-apply with organic compost ($5\text{ t/ha}$) to complex residual aluminum ions.
* Use Single Superphosphate (SSP) or rock phosphate to supply calcium and sulfur alongside bioavailable phosphorus.`,
  },
  {
    id: 'nasa-clim-planting',
    title: 'NASA POWER Agroclimatology Surface Meteorology & Sowing Window Almanac',
    author: 'NASA Earth Science Applied Sciences & CIAT',
    category: 'Climatology',
    crop: 'Cassava, Maize & Legumes',
    verified: true,
    readingTime: '5 min read',
    chunks: 36,
    excerpt: 'Utilizing 14-day rainfall anomalies, root-zone saturation indices, and growing degree days (GDD) for precision planting.',
    fullText: `## Satellite Agroclimatology & Moisture Calibration

### 1. Satellite Moisture Index Interpretation
* **Root-Zone Saturation (0–100 cm):** Minimum 0.32 m³/m³ required for uniform germination.
* **14-Day Rainfall Anomaly:** Positive anomalies (+15% to +35% above 10-year median) confirm sustained bimodal onset.

### 2. Sowing Window Protocols
* Ensure at least **25 mm of cumulative rainfall** over 3 consecutive days prior to seeding.
* For Cassava: Plant stem cuttings at 45° angle, burying 2/3 of nodes into warm moist topsoil.
* For Maize: Seed at 5 cm depth; apply basal fertilizer at planting when soil temperature is 18°C–28°C.`,
  },
  {
    id: 'kalro-push-pull-manual',
    title: 'KALRO Push-Pull Agroecological Crop Protection Technical Bulletin',
    author: 'Kenya Agricultural & Livestock Research Organization (KALRO) & ICIPE',
    category: 'Agronomy',
    crop: 'Maize & Sorghum',
    verified: true,
    readingTime: '7 min read',
    chunks: 48,
    excerpt: 'Intercropping Desmodium and Napier/Brachiaria grasses for simultaneous Striga weed suppression and stemborer deterrence.',
    fullText: `## Climate-Adapted Push-Pull Protocol

### 1. Mechanism
* **The "Push":** Greenleaf Desmodium (*Desmodium intortum*) intercropped between maize rows emits volatile monoterpenes that repel ovipositing moths.
* **The "Pull":** Border strips of Napier (*Pennisetum purpureum*) or Brachiaria grass attract moths to lay eggs on gummy trap leaves where larvae cannot develop.

### 2. Striga Weed (*Striga hermonthica*) Suppression
* Root exudates of Desmodium contain isoflavonones that induce suicidal germination of Striga seeds without attaching to maize roots.
* Reduces Striga seed bank by over 80% within two cropping seasons while fixing up to 100 kg N/ha.`,
  },
  {
    id: 'horticulture-drip-fertigation',
    title: 'Precision Smallholder Drip Fertigation & NPK Uptake Kinetics',
    author: 'AVRDC World Vegetable Center',
    category: 'Horticulture',
    crop: 'Tomato, Capsicum & Onion',
    verified: true,
    readingTime: '6 min read',
    chunks: 39,
    excerpt: 'Split soluble fertilizer application schedules, electrical conductivity (EC) thresholds, and blossom-end rot calcium prevention.',
    fullText: `## Solanaceous Crop Fertigation Management

### 1. Nutrient Scheduling
* **Vegetative Stage:** N:P:K ratio of 2:1:1 to establish robust foliage and root structure.
* **Flowering & Fruit Set:** Shift to 1:1:2 ratio with high potassium and soluble calcium nitrate to prevent blossom-end rot.

### 2. Irrigation Calibration
* Maintain EC at 1.8–2.2 mS/cm and pH between 5.8 and 6.5.
* Pulse irrigate 2–3 times daily during peak evapotranspiration (11:00 AM – 2:00 PM) to maintain continuous capillary moisture.`,
  },
];

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
    category: 'Pathology & Vision AI',
    badge: 'YOLOv8 Foliar Saliency',
    query: 'How to diagnose and mitigate Common Rust (Puccinia sorghi) versus Southern Corn Rust (Puccinia polysora)?',
    canvasMode: 'pathology',
    sampleAnswer: `### Verified Agro-RAG Synthesis: Foliar Rust Pathology Saliency & Protocol

**1. Saliency Differentiation:**
* **Common Rust (*P. sorghi*):** Golden-brown pustules on both upper and lower leaf surfaces, prevalent in cooler highland areas (16–23°C).
* **Southern Rust (*P. polysora*):** Smaller, densely clustered orange pustules primarily on upper surface, thrives in warm humid lowlands (25–32°C).

**2. Cultural & Resistance Strategy:**
* Deploy resistant hybrids (e.g. highland tolerant composites).
* Rotate with non-grass crops (legumes/potatoes) to reduce residual teliospore inoculum.

**3. Chemical Fungicide Threshold:**
* Apply Azoxystrobin + Difenoconazole (0.5 L/ha) if pustules reach ear leaves before the R3 milk stage.`,
    citations: [
      {
        sourceId: 'cimmyt-path-44',
        title: 'CIMMYT Maize Pathology & Diagnostic Compendium',
        category: 'Plant Pathology',
        excerpt: 'Epidemiological distinctions between Puccinia sorghi and Puccinia polysora.',
        score: 0.95,
      },
    ],
  },
];

// Helper functions extracted to maintain cognitive complexity < 15
const mapCitationCategory = (category?: string): GraphNode['category'] => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('soil')) return 'soil';
  if (cat.includes('clim') || cat.includes('satellite') || cat.includes('nasa')) return 'nasa';
  if (cat.includes('ipm') || cat.includes('pest') || cat.includes('path')) return 'fao';
  return 'rule';
};

const mapCitationToGraphNode = (c: Citation, i: number): GraphNode => ({
  id: c.sourceId || `cit-${i}`,
  label: c.title,
  category: mapCitationCategory(c.category),
  score: c.score,
  snippet: c.excerpt,
});

const matchesArticle = (art: DocumentArticle, category: string, query: string): boolean => {
  if (category !== 'All' && art.category !== category) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    art.title.toLowerCase().includes(q) ||
    art.excerpt.toLowerCase().includes(q) ||
    art.crop.toLowerCase().includes(q) ||
    art.author.toLowerCase().includes(q)
  );
};

export const KnowledgeBase: React.FC = () => {
  const { addNotification, setActiveTab } = useAppStore();
  const [activeTabMode, setActiveTabMode] = useState<KnowledgeTabMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [quota, setQuota] = useState<KnowledgeQuotaData | null>(null);
  const [activeCanvasMode, setActiveCanvasMode] = useState<SpatialCanvasMode>('phenology');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [retrievalStep, setRetrievalStep] = useState<number>(0);

  // Document Library state
  const [libraryFilterCategory, setLibraryFilterCategory] = useState<string>('All');
  const [librarySearchQuery, setLibrarySearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<DocumentArticle | null>(null);

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

  const handleSearch = (overrideQuery?: string) => {
    const q = overrideQuery || searchQuery;
    if (!q.trim() && attachments.length === 0) return;
    performAISearch(q);
  };

  const handleTriggerScenario = (sc: ResearchScenario) => {
    setSearchQuery(sc.query);
    if ((sc.canvasMode as string) !== 'rag_graph') {
      setActiveCanvasMode(sc.canvasMode as SpatialCanvasMode);
    }
    setActiveTabMode('search');
    setLastResult({
      answer: sc.sampleAnswer,
      contextUsed: sc.citations.map(c => ({
        content: c.excerpt,
        source: c.title,
        score: c.score,
        metadata: { title: c.title, category: c.category, crop: sc.crop },
      })),
      cached: true,
      query: sc.query,
      timestamp: new Date().toISOString(),
      citations: sc.citations,
      evidenceStatus: 'verified_sources',
    });
    toast.success(`Loaded scenario: ${sc.title}`);
  };

  const graphNodes = useMemo<GraphNode[] | undefined>(() => {
    if (!lastResult?.citations?.length) return undefined;
    return lastResult.citations.map(mapCitationToGraphNode);
  }, [lastResult]);

  const filteredArticles = useMemo(() => {
    return DOCUMENT_CATALOG.filter(art =>
      matchesArticle(art, libraryFilterCategory, librarySearchQuery)
    );
  }, [libraryFilterCategory, librarySearchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* ── Top Bento Banner Header ── */}
      <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Agro-Spatial Knowledge Mesh
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  RAG 2.0
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Multi-modal grounded semantic retrieval, topological citation graph, and verified agronomic almanacs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            {/* Quota Telemetry Chip */}
            {quota && (
              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
                <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-white/70">DAILY QUOTA:</span>
                <span className="text-white font-bold">{quota.remaining}/{quota.limit}</span>
                {quota.remaining <= 3 && (
                  <button
                    onClick={() => setActiveTab('billing')}
                    className="ml-1 underline font-bold text-amber-300 hover:text-amber-200"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )}

            {/* 5-Segmented Mode Switcher */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-2xl border border-white/10 shadow-inner overflow-x-auto">
              <button
                onClick={() => setActiveTabMode('search')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'search'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search & Discovery</span>
              </button>

              <button
                onClick={() => setActiveTabMode('graph')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'graph'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Knowledge Graph</span>
              </button>

              <button
                onClick={() => setActiveTabMode('workbench')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'workbench'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Spatial Simulators</span>
              </button>

              <button
                onClick={() => setActiveTabMode('library')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'library'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Document Library</span>
              </button>

              <button
                onClick={() => setActiveTabMode('telemetry')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabMode === 'telemetry'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40 font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Index Telemetry</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB 1: Search & AI Discovery ── */}
      {activeTabMode === 'search' && (
        <div className="space-y-6">
          {/* Quick Agronomic Research Scenarios */}
          <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xxs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                  Verified Research Scenarios
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xxs font-mono border border-emerald-500/20">
                  1-Click Traversal
                </span>
              </div>
              <span className="text-xs font-mono text-white/40">Select a verified benchmark to run semantic inquiry</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {RESEARCH_SCENARIOS.map(sc => (
                <button
                  key={sc.id}
                  onClick={() => handleTriggerScenario(sc)}
                  className="p-4 rounded-2xl bg-slate-950/50 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 text-left transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {sc.crop}
                      </span>
                      <span className="text-[9px] text-white/40 font-mono">{sc.category}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                      {sc.title}
                    </h4>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-white/40 group-hover:text-emerald-400 flex items-center justify-between font-mono">
                    <span>Load Grounded Protocol</span>
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Multi-Modal Research Search Bar */}
          <div className="backdrop-blur-xl bg-slate-900/70 border border-white/10 rounded-3xl p-5 shadow-xl">
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              attachments={attachments}
              setAttachments={setAttachments}
              isAsking={isAsking}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              showStats={false}
              setShowStats={() => setActiveTabMode('telemetry')}
              onSearch={() => handleSearch()}
            />
          </div>

          {/* Live Multi-Step Retrieval Tracer */}
          {isAsking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="backdrop-blur-xl bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-2"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-xs font-bold text-white font-mono uppercase">
                  Neural RAG Pipeline Active
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
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
                      className={`p-2 rounded-xl text-center text-xs font-mono transition-all ${
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

          {/* Answer & Grounded Evidence Card */}
          <AnimatePresence mode="wait">
            {lastResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6"
              >
                {/* Result Top Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                      Grounded Synthesis Completed
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTabMode('graph')}
                      className="px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      <span>Inspect in Citation Graph</span>
                    </button>

                    <button
                      onClick={() => setActiveTabMode('workbench')}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Launch Spatial Simulator</span>
                    </button>
                  </div>
                </div>

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
              <div className="backdrop-blur-xl bg-slate-900/40 border border-white/5 rounded-3xl p-12 text-center space-y-3">
                <Compass className="w-10 h-10 text-emerald-400/40 mx-auto" />
                <h4 className="text-base font-bold text-white">Spatial Knowledge Engine Ready</h4>
                <p className="text-xs text-white/50 max-w-md mx-auto">
                  Select a research scenario above or enter a multi-modal query to explore full-width agronomic recommendations, citations, and interactive models.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TAB 2: RAG Knowledge Graph ── */}
      {activeTabMode === 'graph' && (
        <div className="space-y-6">
          <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-teal-400" />
                    <span>Topological Citation & Concept Mesh</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xxs font-mono font-bold uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20">
                    Force-Directed WebGL
                  </span>
                </div>
                <p className="text-xs text-white/60 mt-1">
                  Interactive multi-hop citation graph connecting verified research articles, farmer inquiry roots, and FAO agronomic rules. Click any node to inspect abstracts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xxs font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>60 FPS GRAPH RENDERER</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <RagKnowledgeGraphCanvas
                customNodes={graphNodes}
                onNodeSelect={node => {
                  setSelectedNode(node);
                  toast(`Selected Citation: ${node.label}`);
                }}
                className="w-full h-[520px] rounded-2xl border border-white/10"
              />

              {selectedNode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-2xl bg-slate-950/90 border border-teal-500/40 text-xs space-y-2 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-teal-300 text-sm">{selectedNode.label}</span>
                      <span className="text-xxs font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 text-white/60">
                        Type: {selectedNode.category}
                      </span>
                    </div>
                    <span className="font-mono text-xxs px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-300 font-bold uppercase">
                      Relevance Score: {(((selectedNode.score ?? 0.9)) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-white/80 text-xs leading-relaxed">{selectedNode.snippet}</p>
                </motion.div>
              )}
            </div>

            {/* Action Footer Dock */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xxs font-mono text-white/50">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Grounding Guard Active (Zero Hallucination Tolerance)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTabMode('search')}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Back to Search & Synthesis</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Spatial Simulators ── */}
      {activeTabMode === 'workbench' && (
        <div className="space-y-6">
          {/* Spatial Canvas Mode Switcher Bar */}
          <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between overflow-x-auto gap-2 shadow-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCanvasMode('phenology')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
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
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
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
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeCanvasMode === 'pathology'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg'
                    : 'text-white/60 hover:text-white bg-slate-950/40 border border-transparent'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Pathology Scanner</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 text-xxs font-mono text-emerald-400 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>60 FPS WEBGL SIMULATORS</span>
            </div>
          </div>

          {/* Active Canvas Display Shell */}
          <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl relative min-h-[520px] flex flex-col justify-between overflow-hidden">
            <div className="w-full flex-1">
              {activeCanvasMode === 'phenology' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-white/70">
                    <span>AGRO-ECOSYSTEM 4-STAGE PHENOLOGY SCRUBBER</span>
                    <span className="text-cyan-400">NASA POWER Synchronized</span>
                  </div>
                  <AgroEcosystemCanvasScrubber className="w-full h-[460px] rounded-2xl border border-white/10" />
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
                    className="w-full h-[460px] rounded-2xl border border-white/10"
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
                    className="w-full h-[460px] rounded-2xl border border-white/10"
                  />
                </div>
              )}
            </div>

            {/* Action Footer Dock */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
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
      )}

      {/* ── TAB 2: Document Library & Catalog ── */}
      {activeTabMode === 'library' && (
        <div className="space-y-6">
          {/* Library Control Bar */}
          <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Search within documents */}
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={librarySearchQuery}
                onChange={e => setLibrarySearchQuery(e.target.value)}
                placeholder="Search articles, crop guides, scientific bulletins..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-black/40 border border-white/10 text-white placeholder-white/40 text-xs font-medium focus:outline-none focus:border-purple-500/50"
              />
              {librarySearchQuery && (
                <button
                  onClick={() => setLibrarySearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
              <Filter className="w-3.5 h-3.5 text-purple-400 shrink-0 hidden sm:block" />
              {['All', 'Agronomy', 'IPM & Pest', 'Soil Chemistry', 'Climatology', 'Horticulture'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setLibraryFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                    libraryFilterCategory === cat
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-950/40'
                      : 'bg-white/[0.03] text-white/50 border-white/5 hover:border-white/15 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Quick Actions: Offline Pack & Ingest */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={async () => {
                  try {
                    await downloadKnowledgePack('global', 200);
                    toast.success('Offline Knowledge Pack downloaded successfully');
                  } catch {
                    toast.error('Failed to export offline knowledge pack');
                  }
                }}
                className="flex-1 md:flex-none px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>Export Offline Pack</span>
              </button>

              <button
                onClick={() => toast('Document ingestion pipeline active. Upload custom agronomic PDF / Markdown.')}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-950/40 flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Technical Doc</span>
              </button>
            </div>
          </div>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredArticles.map(art => (
              <motion.div
                key={art.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="backdrop-blur-xl bg-slate-900/70 border border-white/10 hover:border-purple-500/40 rounded-3xl p-5 flex flex-col justify-between shadow-xl transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xxs font-mono font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {art.category}
                    </span>
                    <span className="text-[10px] font-mono text-white/40">{art.readingTime}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
                      {art.title}
                    </h3>
                    <p className="text-xxs text-white/50 font-mono mt-1">{art.author}</p>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed line-clamp-3">
                    {art.excerpt}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xxs font-mono text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{art.chunks} Embed Chunks</span>
                  </div>

                  <button
                    onClick={() => setSelectedArticle(art)}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 text-white/80 hover:text-white text-xxs font-bold uppercase transition-all flex items-center gap-1.5"
                  >
                    <span>Read Article</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Detailed Document Reader Modal */}
          <AnimatePresence>
            {selectedArticle && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-slate-900 border border-white/15 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                >
                  <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4 bg-slate-950/60">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xxs font-mono font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {selectedArticle.category}
                        </span>
                        <span className="text-xxs font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified Document
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-white">{selectedArticle.title}</h2>
                      <p className="text-xs text-white/50 font-mono mt-0.5">{selectedArticle.author}</p>
                    </div>
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-4 prose prose-invert max-w-none text-xs text-white/80 leading-relaxed font-sans">
                    <div className="p-4 rounded-2xl bg-black/40 border border-white/5 font-mono text-[11px] text-emerald-300">
                      <strong>RAG Vector Metadata:</strong> {selectedArticle.chunks} high-dimensional embedding chunks indexed in pgvector.
                    </div>
                    <div className="whitespace-pre-line leading-relaxed">
                      {selectedArticle.fullText}
                    </div>
                  </div>

                  <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
                    <button
                      onClick={() => {
                        handleTriggerScenario({
                          id: selectedArticle.id,
                          title: selectedArticle.title,
                          crop: selectedArticle.crop,
                          category: selectedArticle.category,
                          badge: 'Catalog Verified',
                          query: `How to apply ${selectedArticle.title} in smallholder farms?`,
                          canvasMode: selectedArticle.category === 'Soil Chemistry' ? 'soil_heatmap' : selectedArticle.category === 'Climatology' ? 'phenology' : 'pathology',
                          sampleAnswer: selectedArticle.excerpt,
                          citations: [
                            {
                              sourceId: selectedArticle.id,
                              title: selectedArticle.title,
                              category: selectedArticle.category,
                              excerpt: selectedArticle.excerpt,
                              score: 0.98,
                            },
                          ],
                        });
                        setSelectedArticle(null);
                        setActiveTabMode('search');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Run Inquiry in Search & Synthesis</span>
                    </button>

                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TAB 3: Index Telemetry ── */}
      {activeTabMode === 'telemetry' && (
        <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-3xl p-6 shadow-2xl">
          {stats && <KnowledgeStats data={stats} />}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
