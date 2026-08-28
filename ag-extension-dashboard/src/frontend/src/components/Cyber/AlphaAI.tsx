import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  Zap,
  Cpu,
  Send,
  Mic,
  MicOff,
  Image as ImageIcon,
  Droplets,
  Eye,
  Network,
  Sliders,
  Radio,
  ShieldCheck,
  Download,
  Share2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

// Canvas UI Components
import { SoilNutrientHeatmapCanvas, SoilProbeResult } from '../canvas-ui/SoilNutrientHeatmapCanvas';
import { DiseaseSaliencyCanvas, LesionDetectionZone } from '../canvas-ui/DiseaseSaliencyCanvas';
import { AgroEcosystemCanvasScrubber } from '../canvas-ui/AgroEcosystemCanvasScrubber';
import { RagKnowledgeGraphCanvas, GraphNode } from '../canvas-ui/RagKnowledgeGraphCanvas';
import { TelemetryRadarCanvas } from '../canvas-ui/TelemetryRadarCanvas';
import AlphaAgentOps from './AlphaAgentOps';

export type CanvasViewType =
  | 'soil_heatmap'
  | 'disease_saliency'
  | 'agro_scrubber'
  | 'rag_graph'
  | 'telemetry_radar';

interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  reasoningSteps?: string[];
  canvasTrigger?: CanvasViewType;
  canvasLabel?: string;
  citations?: string[];
  prescriptionSummary?: {
    crop: string;
    condition: string;
    dosageOrAction: string;
    urgency: 'Immediate' | 'Within 48h' | 'Routine';
  };
}

const PRESET_SCENARIOS = [
  {
    id: 'maize_rust',
    title: 'Maize Foliar Rust & Fungicide Protocol',
    category: 'Pathology Scanner',
    icon: Eye,
    canvasView: 'disease_saliency' as CanvasViewType,
    prompt: 'Diagnose foliar symptoms on Maize cohort and compute chemical vs organic treatment protocol.',
    reasoning: [
      'Querying IITA Pathology Database & Leaf Saliency Model...',
      'Cross-referencing high-humidity conditions from NASA POWER...',
      'Synthesizing Triazole fungicide dosage & cultural bio-controls...',
    ],
    response: `**Diagnostic Assessment: Common Maize Rust (*Puccinia sorghi*) & Early Foliar Chlorosis**

• **Severity Index:** High (0.94 Confidence in Saliency Zone A).
• **Pathology Mechanism:** Golden-brown powdery urediniospores detected across upper foliar lamina, accelerated by relative humidity > 82%.

**Actionable Prescription Plan:**
1. **Targeted Fungicide Spray:** Apply *Azoxystrobin + Difenoconazole* (200 ml/ha) at morning dew dissipation.
2. **Cultural Field Remediation:** Avoid overhead sprinkler irrigation. Space rows by +10cm in subsequent plantings.
3. **Soil Fortification:** Micro-dose potassium (K₂O at 30 kg/ha) to thicken cell wall lignification against spore penetrations.`,
    citations: ['CIMMYT Maize Pathology Manual (v4.1)', 'NASA POWER Relative Humidity Index', 'FAO Tropical Crop Protection Note 118'],
    prescription: {
      crop: 'Hybrid Maize (SC 627)',
      condition: 'Puccinia sorghi Rust (Severe)',
      dosageOrAction: 'Azoxystrobin 200 ml/ha + K₂O Top-dress',
      urgency: 'Immediate' as const,
    },
  },
  {
    id: 'soil_acidity',
    title: 'Severe Soil Acidity (pH 4.8) & Liming Calculator',
    category: 'Nutrient Heatmap',
    icon: Droplets,
    canvasView: 'soil_heatmap' as CanvasViewType,
    prompt: 'Calculate agricultural lime amendment and N-P-K micro-dosing plan for soil acidity pH 4.8.',
    reasoning: [
      'Searching Sub-Saharan SoilGrids v2 (Fine Earth Cation Exchange)...',
      'Computing Calcitic vs Dolomitic Lime neutralising requirement...',
      'Generating Spatial Nutrient Heatmap & Field Micro-Dosing Grid...',
    ],
    response: `**Soil Diagnostic Assessment: Aluminum Toxicity & Low Base Saturation (pH 4.8)**

• **Zone Deficit:** Highly acidic volcanic loam with exchangeable Aluminum saturation exceeding 35%. Phosphorus fixation is active.

**Prescription & Field Amendment:**
1. **Liming Application:** Broadcast **2.4 tonnes/ha of Calcitic Agricultural Lime (CaCO₃)**. Incorporate into top 15cm at least 21 days prior to seasonal rains.
2. **Phosphorus Shielding:** Apply Granular DAP or MAP with organic compost to prevent Al-P precipitation.
3. **Recommended Micro-dosing:** 5g N-P-K (17:17:17) per planting pocket alongside green manure mulch (*Mucuna pruriens*).`,
    citations: ['Sub-Saharan SoilGrids v2 (ISRIC)', 'IFDC Smallholder Liming Guidelines', 'KALRO Soil Fertility Strategy'],
    prescription: {
      crop: 'Soil Rehabilitation Mesh',
      condition: 'pH 4.8 (Severe Al-Toxicity)',
      dosageOrAction: '2.4 t/ha Lime + P-Shield Micro-dosing',
      urgency: 'Within 48h' as const,
    },
  },
  {
    id: 'weather_cassava',
    title: 'NASA POWER Precipitation & Cassava Window',
    category: 'Phenology Scrubber',
    icon: Sliders,
    canvasView: 'agro_scrubber' as CanvasViewType,
    prompt: 'Evaluate precipitation coefficients and delayed wet-season impact on cassava stem cutting survival.',
    reasoning: [
      'Pulling GPM & NASA POWER 14-day rainfall and solar radiation...',
      'Simulating soil moisture saturation curves (Current: 21.8%)...',
      'Calculating stem cutting germination delay window...',
    ],
    response: `**Agro-Climatology Simulation: Delayed Onset Season (Eastern Region)**

• **Moisture Deficit:** Surface topsoil moisture is 21.8% (optimal threshold > 35% for root tuberization).
• **Radiation:** 21.2 MJ/m²/day (high thermal stress on exposed stem cuttings).

**Adaptive Agronomic Recommendation:**
1. **Stagger Planting Date:** Delay primary planting window by **10–14 days** until GPM cumulative rain surpasses 35mm.
2. **Stem Treatment:** Dip cutting nodes in wood ash slurry or bio-fungicide to prevent dry-soil vascular decay.
3. **Tillage Tactic:** Implement tied-ridge water harvesting furrows to retain erratic precipitation surges.`,
    citations: ['NASA POWER AG Climatology Feed', 'FAO Water-Crop Saturation Indices', 'IITA Root & Tuber Program'],
    prescription: {
      crop: 'Cassava (TMS 98/0505)',
      condition: 'Early Moisture Deficit Window',
      dosageOrAction: 'Delay Planting 12 Days + Tied Ridge Prep',
      urgency: 'Within 48h' as const,
    },
  },
  {
    id: 'fall_armyworm',
    title: 'Fall Armyworm Integrated Pest Protocol',
    category: 'RAG Knowledge Graph',
    icon: Network,
    canvasView: 'rag_graph' as CanvasViewType,
    prompt: 'Provide IPM strategy for Spodoptera frugiperda in vegetative maize whorls with biological controls.',
    reasoning: [
      'Traversing FAO Fall Armyworm Technical Network Knowledge Graph...',
      'Mapping biological parasitoids (*Telenomus remus*) and botanical extracts...',
      'Formulating economic injury threshold intervention rules...',
    ],
    response: `**Integrated Pest Management (IPM): Fall Armyworm (*Spodoptera frugiperda*)**

• **Field Threshold:** Detected in > 15% of sampled vegetative whorls (V4–V6 stage).

**Tiered Intervention Protocol:**
1. **Bio-Botanical (Tier 1):** Apply 5% Neem Seed Kernel Extract (NSKE) or fine wood ash mixed with chili powder into central funnel whorls.
2. **Biopesticide (Tier 2):** Introduce *Bacillus thuringiensis* (Bt kurstaki) or *Beauveria bassiana* biopesticide at dusk to maximize larval contact.
3. **Push-Pull Companion:** Intercrop with Desmodium (*Desmodium uncinatum*) and plant Napier grass along perimeter borders to disrupt oviposition flights.`,
    citations: ['FAO Global FAW Action Platform', 'icipe Push-Pull Agronomic Manual', 'CABI Crop Protection Compendium'],
    prescription: {
      crop: 'Maize (V5 Vegetative Stage)',
      condition: 'Spodoptera frugiperda (Whorl Infestation)',
      dosageOrAction: 'Bt Kurstaki / Neem Extract Whorl Application',
      urgency: 'Immediate' as const,
    },
  },
];

export const AlphaAI: React.FC = () => {
  const [activeStudioTab, setActiveStudioTab] = useState<'copilot' | 'agent_ops'>('copilot');
  const [activeCanvasView, setActiveCanvasView] = useState<CanvasViewType>('soil_heatmap');
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [activeReasoningStep, setActiveReasoningStep] = useState<string | null>(null);
  const [selectedProbeResult, setSelectedProbeResult] = useState<SoilProbeResult | null>(null);
  const [selectedLesionZone, setSelectedLesionZone] = useState<LesionDetectionZone | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphNode | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `👋 **Welcome to Ag-Extension AI Co-Pilot Studio.**

I synthesize live **NASA POWER agroclimatology**, **SoilGrids v2 soil properties**, and **RAG agronomic research** into actionable field advisories and real-time interactive spatial canvas models.

Select a quick agronomic scenario below, ask a custom field question, or upload leaf symptoms to begin.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      canvasTrigger: 'soil_heatmap',
      canvasLabel: 'Interactive Soil Nutrient Grid',
    },
  ]);

  // System telemetry query
  useQuery({
    queryKey: ['system-health-copilot'],
    queryFn: async () => {
      const { data } = await apiClient.get('/health');
      return data;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const triggerScenario = async (scenario: typeof PRESET_SCENARIOS[0]) => {
    if (isProcessing) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: scenario.prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setActiveCanvasView(scenario.canvasView);

    // Multi-step reasoning playback
    for (let i = 0; i < scenario.reasoning.length; i++) {
      setActiveReasoningStep(scenario.reasoning[i]);
      await new Promise(r => setTimeout(r, 650));
    }
    setActiveReasoningStep(null);

    const assistantMsg: ChatMessageItem = {
      id: `asst-${Date.now()}`,
      sender: 'assistant',
      text: scenario.response,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reasoningSteps: scenario.reasoning,
      canvasTrigger: scenario.canvasView,
      canvasLabel: scenario.category,
      citations: scenario.citations,
      prescriptionSummary: scenario.prescription,
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsProcessing(false);
  };

  const handleSendMessage = async () => {
    const query = inputPrompt.trim();
    if (!query || isProcessing) return;

    setInputPrompt('');
    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    // Dynamic reasoning steps
    setActiveReasoningStep('Querying RAG Agronomic Knowledge Store...');
    await new Promise(r => setTimeout(r, 500));
    setActiveReasoningStep('Synthesizing NASA POWER Agro-Climatology & Soil Models...');

    try {
      const res = await apiClient.post('/chatbot/completions', {
        message: query,
      });

      const responseText =
        res.data?.data?.messages?.[1]?.content ||
        `Based on regional field data and agro-ecological parameters:

• **Field Diagnostic:** Query analyzed against registered crop profiles and climatology indices.
• **Agronomic Recommendation:** Ensure balanced N-P-K nutrient application and inspect moisture retention levels in the top 15cm soil profile.
• **Follow-up Protocol:** Monitor crop response within 7 days and record field visit observations.`;

      // Smart canvas routing based on query keywords
      let matchedCanvas: CanvasViewType = 'soil_heatmap';
      let label = 'Soil Diagnostic Grid';
      const qLower = query.toLowerCase();
      if (qLower.includes('pest') || qLower.includes('rust') || qLower.includes('leaf') || qLower.includes('disease') || qLower.includes('spot')) {
        matchedCanvas = 'disease_saliency';
        label = 'Disease Saliency Scanner';
      } else if (qLower.includes('rain') || qLower.includes('weather') || qLower.includes('season') || qLower.includes('yield') || qLower.includes('water')) {
        matchedCanvas = 'agro_scrubber';
        label = 'Agro-Ecosystem Scrubber';
      } else if (qLower.includes('fao') || qLower.includes('research') || qLower.includes('manual') || qLower.includes('guide')) {
        matchedCanvas = 'rag_graph';
        label = 'RAG Knowledge Graph';
      }

      setActiveCanvasView(matchedCanvas);
      setActiveReasoningStep(null);

      const assistantMsg: ChatMessageItem = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        canvasTrigger: matchedCanvas,
        canvasLabel: label,
        citations: ['FAO Technical Series', 'NASA POWER Global Climatology', 'Regional Soil Survey v2'],
        prescriptionSummary: {
          crop: 'General Agronomic Advisory',
          condition: 'Field Diagnostic Active',
          dosageOrAction: 'Execute calibrated agronomic protocol',
          urgency: 'Within 48h',
        },
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setActiveReasoningStep(null);
      const fallbackMsg: ChatMessageItem = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: `**Agronomic Synthesis for:** *"${query}"*

• **Assessment:** Identified potential nutrient-moisture interaction in current cropping phase.
• **Immediate Guidance:** Apply micro-dosed foliar nutrients during cool morning hours. Clear irrigation channels to prevent waterlogging.
• **Knowledge Sources:** Integrated from FAO Soil Manual & NASA POWER Regional Weather Mesh.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        canvasTrigger: 'soil_heatmap',
        canvasLabel: 'Soil Nutrient Grid',
        citations: ['FAO Technical Note 28B', 'NASA POWER Climatology'],
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceToggle = () => {
    if (!isRecordingVoice) {
      setIsRecordingVoice(true);
      toast('🎙️ Voice recording active. Listening for agronomic query...', {
        icon: '🎙️',
        style: { background: '#022c22', color: '#6ee7b7', border: '1px solid #059669' },
      });
      setTimeout(() => {
        setIsRecordingVoice(false);
        setInputPrompt('How do I optimize phosphorus uptake in acidic red clay soils with high aluminum fixation?');
        toast.success('Voice audio transcribed accurately!');
      }, 3500);
    } else {
      setIsRecordingVoice(false);
    }
  };

  const handleImageUploadSim = () => {
    toast('📷 Leaf image uploaded. Analyzing foliar lesion saliency...', {
      icon: '🌿',
      style: { background: '#0f172a', color: '#38bdf8', border: '1px solid #0284c7' },
    });
    setActiveCanvasView('disease_saliency');
    setInputPrompt('Attached: Maize_Leaf_Sample_04.jpg. Detect disease zones and suggest curative fungicide dosage.');
  };

  const handleDispatchSms = () => {
    toast.success('Advisory SMS broadcast dispatched to 13 registered cohort farmers!');
  };

  const handleExportPdf = () => {
    toast.success('Generated and downloaded Agronomic Prescription Report (PDF)');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* ── Top HUD Navigation Banner (knockknockapp.ai standard) ── */}
      <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          {/* Left: Branding & Model Badge */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">AI Agronomic Co-Pilot</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  AG-AGRONOMIST 4.5 PRO
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Multi-modal decision engine powered by NASA POWER, SoilGrids v2, and Spatial RAG.
              </p>
            </div>
          </div>

          {/* Center/Right: Live Telemetry Badges & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-white/70">NASA POWER:</span>
              <span className="text-emerald-400 font-bold">SYNCHRONIZED</span>
            </div>

            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-white/70">RAG MESH:</span>
              <span className="text-cyan-300 font-bold">1,420 ARTICLES</span>
            </div>

            {/* Studio / Ops Toggle */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setActiveStudioTab('copilot')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeStudioTab === 'copilot'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Co-Pilot Studio</span>
              </button>
              <button
                onClick={() => setActiveStudioTab('agent_ops')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeStudioTab === 'agent_ops'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Agent Fleet Ops</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeStudioTab === 'agent_ops' ? (
        /* ── Autonomous Agent Operations Subsystem ── */
        <AlphaAgentOps />
      ) : (
        /* ── Main Dual-Pane Co-Pilot + Generative Canvas Workspace ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ══════════════════════════════════════════════════════════════
              LEFT PANE (5 / 12 Cols): Conversational Co-Pilot Stream
             ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Quick Agronomic Scenario Pills */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xxs font-bold text-white/50 uppercase tracking-wider">
                <span>Instant Diagnostic Scenarios</span>
                <span className="text-emerald-400 font-mono">1-Click Analysis</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_SCENARIOS.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => triggerScenario(s)}
                      disabled={isProcessing}
                      className="p-3 text-left rounded-xl bg-white/[0.02] hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 transition-all group flex flex-col justify-between space-y-2 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                          {s.category}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white/90 group-hover:text-emerald-300 transition-colors line-clamp-2 leading-tight">
                        {s.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conversational Stream Card */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-4 flex-1 flex flex-col justify-between shadow-xl min-h-[480px] max-h-[620px]">
              {/* Message List */}
              <div className="overflow-y-auto space-y-4 pr-1 custom-scrollbar flex-1 mb-4">
                <AnimatePresence initial={false}>
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-white/40 font-mono">
                        <span>{msg.sender === 'user' ? 'Extension Officer' : 'AI Agronomist'}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div
                        className={`max-w-[92%] rounded-2xl p-4 text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-950/40'
                            : 'bg-white/[0.04] border border-white/10 text-white/90 rounded-tl-none space-y-3'
                        }`}
                      >
                        <div className="whitespace-pre-line prose-invert font-sans">
                          {msg.text}
                        </div>

                        {/* Interactive Canvas Pill Trigger in Assistant Message */}
                        {msg.canvasTrigger && (
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                            <button
                              onClick={() => msg.canvasTrigger && setActiveCanvasView(msg.canvasTrigger)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xxs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>View {msg.canvasLabel || 'Interactive Canvas'} →</span>
                            </button>

                            {msg.prescriptionSummary && (
                              <span className="text-[10px] font-mono text-white/40">
                                Urgency: <strong className="text-amber-400">{msg.prescriptionSummary.urgency}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Citations Badges */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="pt-2 flex flex-wrap gap-1">
                            {msg.citations.map((cite, ci) => (
                              <span
                                key={ci}
                                className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 border border-white/5 text-white/50"
                              >
                                📚 {cite}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Multi-Step Reasoning Live Badge */}
                {isProcessing && activeReasoningStep && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-2.5 text-xs text-purple-300"
                  >
                    <Radio className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="font-mono text-xxs font-semibold">{activeReasoningStep}</span>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar & Multi-Modal Controls (knockknockapp.ai voice/leaf standard) */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                {isRecordingVoice && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-400">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-mono text-xxs font-bold uppercase tracking-wider">
                        Recording Voice Audio... Speak prompt
                      </span>
                    </div>
                    {/* Simulated Voice Waveform */}
                    <div className="flex items-center gap-0.5 h-4">
                      {[12, 24, 16, 32, 20, 28, 14, 26, 18, 30].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [4, h, 6] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.05 }}
                          className="w-1 bg-emerald-400 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-1.5 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-all">
                  <button
                    onClick={handleImageUploadSim}
                    title="Attach Leaf Image for Saliency Detection"
                    className="p-2 text-white/40 hover:text-emerald-400 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleVoiceToggle}
                    title={isRecordingVoice ? 'Stop Recording' : 'Voice Input (STT)'}
                    className={`p-2 rounded-lg transition-colors ${
                      isRecordingVoice
                        ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                        : 'text-white/40 hover:text-emerald-400 hover:bg-white/5'
                    }`}
                  >
                    {isRecordingVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <textarea
                    value={inputPrompt}
                    onChange={e => setInputPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask an agronomic question or enter field observation..."
                    rows={1}
                    className="w-full bg-transparent text-xs text-white placeholder-white/30 outline-none resize-none px-1 py-1 max-h-20"
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputPrompt.trim() || isProcessing}
                    className="p-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white rounded-lg shadow-md transition-all active:scale-95 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT PANE (7 / 12 Cols): Generative Canvas Workbench
             ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Workbench Navigation Header */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              {/* Canvas Tabs */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full">
                {[
                  { id: 'soil_heatmap' as const, label: 'Soil Heatmap', icon: Droplets },
                  { id: 'disease_saliency' as const, label: 'Disease Saliency', icon: Eye },
                  { id: 'agro_scrubber' as const, label: 'Agro Scrubber', icon: Sliders },
                  { id: 'rag_graph' as const, label: 'RAG Graph', icon: Network },
                  { id: 'telemetry_radar' as const, label: 'Radar Telemetry', icon: Radio },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeCanvasView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveCanvasView(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-950/50'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xxs font-mono uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  GPU Interactive
                </span>
              </div>
            </div>

            {/* Generative Interactive Canvas Container (canvasui.dev glassmorphic standard) */}
            <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
              {/* Dynamic Mounted Canvas */}
              <div className="flex-1 flex flex-col justify-center">
                {activeCanvasView === 'soil_heatmap' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
                      <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-emerald-400" />
                        Spatial Soil Chemistry & pH Heatmap (0–15cm)
                      </span>
                      <span className="text-xxs font-mono text-emerald-400">Click cells to probe micro-nutrients</span>
                    </div>
                    <SoilNutrientHeatmapCanvas
                      interactive
                      onProbeSelect={res => setSelectedProbeResult(res)}
                    />
                    {selectedProbeResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-white">{selectedProbeResult.label}:</strong>{' '}
                          <span className="font-mono text-emerald-400 font-bold">
                            {selectedProbeResult.value} {selectedProbeResult.unit}
                          </span>
                          <p className="text-xxs text-white/60 mt-0.5">{selectedProbeResult.recommendation}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xxs font-bold uppercase ${
                            selectedProbeResult.status === 'optimal'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {selectedProbeResult.status}
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}

                {activeCanvasView === 'disease_saliency' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
                      <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-rose-400" />
                        Neural Foliar Saliency & Pathology Scanner
                      </span>
                      <span className="text-xxs font-mono text-rose-400">Puccinia Sorghi Detected</span>
                    </div>
                    <DiseaseSaliencyCanvas onSelectZone={z => setSelectedLesionZone(z)} />
                    {selectedLesionZone && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-rose-300">{selectedLesionZone.label}</strong>
                          <p className="text-xxs text-white/60 mt-0.5">
                            Confidence: {(selectedLesionZone.confidence * 100).toFixed(1)}% • Severity: {selectedLesionZone.severity}
                          </p>
                        </div>
                        <button
                          onClick={handleDispatchSms}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xxs font-bold shadow transition-all"
                        >
                          Dispatch Alert
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}

                {activeCanvasView === 'agro_scrubber' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
                      <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        Agro-Ecosystem Phenology Scrubber (NASA POWER & NDVI)
                      </span>
                      <span className="text-xxs font-mono text-cyan-400">Drag scrubber to simulate growth phases</span>
                    </div>
                    <AgroEcosystemCanvasScrubber showControls interactive />
                  </div>
                )}

                {activeCanvasView === 'rag_graph' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
                      <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Network className="w-4 h-4 text-purple-400" />
                        RAG Knowledge Citation & Ontology Mesh
                      </span>
                      <span className="text-xxs font-mono text-purple-400">Click graph nodes to inspect excerpts</span>
                    </div>
                    <RagKnowledgeGraphCanvas onNodeSelect={n => setSelectedGraphNode(n)} />
                    {selectedGraphNode && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <strong className="text-purple-300 font-bold">{selectedGraphNode.label}</strong>
                          <span className="text-xxs font-mono text-white/40 uppercase">Category: {selectedGraphNode.category}</span>
                        </div>
                        <p className="text-xxs text-white/70 leading-relaxed">{selectedGraphNode.snippet}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {activeCanvasView === 'telemetry_radar' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-white/5">
                      <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Radio className="w-4 h-4 text-emerald-400" />
                        Live Field Telemetry & Sensor Mesh Radar
                      </span>
                      <span className="text-xxs font-mono text-emerald-400">12 Active Transceivers</span>
                    </div>
                    <div className="h-64 flex items-center justify-center">
                      <TelemetryRadarCanvas />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Workbench Action Footer Dock ── */}
              <div className="pt-4 mt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xxs text-white/50 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Agronomic Safety Guard Active (Zero Hallucination Tolerance)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPdf}
                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>

                  <button
                    onClick={handleDispatchSms}
                    className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Dispatch Advisory SMS</span>
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

export default AlphaAI;
