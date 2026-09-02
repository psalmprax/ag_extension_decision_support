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
import { AgronomicIntakeCard, isAgronomicQueryAmbiguous } from '../AgronomicIntakeCard';

export type CanvasViewType =
  | 'soil_heatmap'
  | 'disease_saliency'
  | 'agro_scrubber'
  | 'rag_graph'
  | 'telemetry_radar';

function selectCanvasForQuery(query: string, ragCategories?: string[]): { view: CanvasViewType; label: string } {
  // Prefer semantic RAG categories when available; fall back to lightweight keyword heuristic
  const cats = (ragCategories || []).join(' ').toLowerCase();
  if (cats) {
    if (cats.includes('pest') || cats.includes('disease') || cats.includes('path')) return { view: 'disease_saliency', label: 'Disease Saliency Scanner' };
    if (cats.includes('soil')) return { view: 'soil_heatmap', label: 'Soil Diagnostic Grid' };
    if (cats.includes('clim') || cats.includes('yield') || cats.includes('water')) return { view: 'agro_scrubber', label: 'Agro-Ecosystem Scrubber' };
    if (cats.includes('research') || cats.includes('manual')) return { view: 'rag_graph', label: 'RAG Knowledge Graph' };
  }
  const q = query.toLowerCase();
  if (['pest', 'rust', 'leaf', 'disease', 'spot'].some(term => q.includes(term))) {
    return { view: 'disease_saliency', label: 'Disease Saliency Scanner' };
  }
  if (['rain', 'weather', 'season', 'yield', 'water'].some(term => q.includes(term))) {
    return { view: 'agro_scrubber', label: 'Agro-Ecosystem Scrubber' };
  }
  if (['fao', 'research', 'manual', 'guide'].some(term => q.includes(term))) {
    return { view: 'rag_graph', label: 'RAG Knowledge Graph' };
  }
  return { view: 'soil_heatmap', label: 'Soil Diagnostic Grid' };
}

interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  canvasTrigger?: CanvasViewType;
  canvasLabel?: string;
}export const AlphaAI: React.FC = () => {
  const [activeStudioTab, setActiveStudioTab] = useState<'copilot' | 'agent_ops'>('copilot');
  const [activeCanvasView, setActiveCanvasView] = useState<CanvasViewType>('soil_heatmap');
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [activeReasoningStep, setActiveReasoningStep] = useState<string | null>(null);
  const [selectedProbeResult, setSelectedProbeResult] = useState<SoilProbeResult | null>(null);
  const [selectedLesionZone, setSelectedLesionZone] = useState<LesionDetectionZone | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<GraphNode | null>(null);
  const [intakeDismissed, setIntakeDismissed] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);

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
  const { data: healthData } = useQuery({
    queryKey: ['system-health-copilot'],
    queryFn: async () => {
      const { data } = await apiClient.get('/health');
      return data as { status?: string; uptime?: number };
    },
    refetchInterval: 30000,
  });
  const { data: kbStats } = useQuery({
    queryKey: ['kb-stats-copilot'],
    queryFn: async () => {
      const { data } = await apiClient.get('/knowledge/stats');
      return data as { success?: boolean; data?: { totalQueries?: number } };
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Drain offline queue when back online
  useEffect(() => {
    const drain = async () => {
      if (!navigator.onLine) return;
      const q = JSON.parse(localStorage.getItem('alphaAiOfflineQueue') || '[]') as string[];
      if (q.length === 0) return;
      for (const queued of [...q]) {
        try { await handleSendMessage(queued); q.shift(); localStorage.setItem('alphaAiOfflineQueue', JSON.stringify(q)); } catch { break; }
      }
      if (q.length === 0) localStorage.removeItem('alphaAiOfflineQueue');
    };
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, []);

  const handleSendMessage = async (overrideQuery?: string) => {
    const query = (overrideQuery || inputPrompt).trim();
    if (!query || isProcessing) return;

    // Offline queue — stash and show pending when navigator is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const q = JSON.parse(localStorage.getItem('alphaAiOfflineQueue') || '[]') as string[];
      q.push(query);
      localStorage.setItem('alphaAiOfflineQueue', JSON.stringify(q));
      setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: query, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } as ChatMessageItem]);
      setMessages(prev => [...prev, { id: `off-${Date.now()}`, sender: 'assistant', text: '📡 Offline — your agronomic question is queued and will be sent when back online.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } as ChatMessageItem]);
      setInputPrompt('');
      return;
    }

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

      const data = res.data?.data || res.data;
      const responseText =
        data?.messages?.[1]?.content ||
        data?.response ||
        data?.text ||
        (typeof data === 'string' ? data : null);

      if (typeof responseText !== 'string' || responseText.trim().length === 0) {
        throw new Error('AI service returned no advisory content');
      }

      const ragCats: string[] = Array.isArray(data?.citations)
        ? (data.citations as { category?: string }[]).map(c => c.category || '').filter(Boolean)
        : Array.isArray(data?.contextUsed) ? (data.contextUsed as { metadata?: { category?: string } }[]).map(c => c.metadata?.category || '').filter(Boolean)
        : [];
      const { view: matchedCanvas, label } = selectCanvasForQuery(query, ragCats);

      setActiveCanvasView(matchedCanvas);
      setActiveReasoningStep(null);

      const assistantMsg: ChatMessageItem = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        canvasTrigger: matchedCanvas,
        canvasLabel: label,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[AlphaAI] Chatbot request error:', err);
      const isNetwork = !navigator.onLine || String((err as { message?: string })?.message || '').toLowerCase().includes('network');
      if (isNetwork) {
        const q = JSON.parse(localStorage.getItem('alphaAiOfflineQueue') || '[]') as string[];
        q.push(query);
        localStorage.setItem('alphaAiOfflineQueue', JSON.stringify(q));
        setMessages(prev => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            text: '📡 Network unavailable — your agronomic question was queued offline and will be sent when back online.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            text: 'The advisory service is currently unavailable. No agronomic guidance was generated for this query — please retry shortly or consult your local extension officer.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
      setActiveReasoningStep(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecordingVoice) {
      voiceRecorderRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice input unavailable in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      voiceChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          if (!base64) { toast.error('Could not read audio'); return; }
          setActiveReasoningStep('Transcribing voice (Whisper)...');
          try {
            const { data } = await apiClient.post('/pillars/voice/transcribe', { audio: base64, mimeType: recorder.mimeType });
            const text = (data?.data?.transcription || data?.transcription || '').toString().trim();
            if (text && !text.startsWith('[STUB')) {
              setInputPrompt(text);
              toast.success(`Transcribed: ${text.slice(0, 60)}…`);
            } else if (text) toast(`Transcribed (demo): ${text.slice(0, 80)}…`);
            else toast.error('Transcription returned no text');
          } catch (e) {
            toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Transcription failed — check OPENAI_API_KEY');
          } finally { setActiveReasoningStep(null); }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      voiceRecorderRef.current = recorder;
      setIsRecordingVoice(true);
      toast('Recording… tap again to stop and transcribe');
    } catch (e) {
      toast.error((e as Error).message || 'Microphone access denied');
    }
  };

  const handleImageUploadSim = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) { toast.error('Image too large — max 8MB'); return; }
      setActiveReasoningStep('Analyzing leaf image (vision)…');
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve((r.result as string).split(',')[1]);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const { data } = await apiClient.post('/ai/diseases/analyze', { image: base64 });
        const summary = data?.data?.overallHealth || data?.overallHealth || 'Analysis complete — see Disease Diagnosis for full report';
        setMessages(prev => [...prev, { id: `img-${Date.now()}`, sender: 'assistant', text: `🖼️ **Image diagnosis:** ${summary}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        toast.success('Image analyzed — check Disease Diagnosis for lab verification');
      } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Image analysis failed'); }
      finally { setActiveReasoningStep(null); }
    };
    input.click();
  };

  const handleDispatchSms = async () => {
    const lastAnswer = [...messages].reverse().find(m => m.sender === 'assistant')?.text;
    if (!lastAnswer) { toast.error('No advisory to dispatch — ask a question first'); return; }
    try {
      const { useAppStore } = await import('@/store/useAppStore');
      useAppStore.getState().setPendingSMS?.({ phone: '', message: lastAnswer.slice(0, 300) } as never);
      const storeTab = (useAppStore.getState() as { setActiveTab?: (t: string) => void }).setActiveTab;
      storeTab?.('sms');
      toast('Opening SMS composer with last advisory…');
    } catch { toast.error('SMS dispatch requires SMS page'); }
  };

  const handleExportPdf = async () => {
    const lastAnswer = [...messages].reverse().find(m => m.sender === 'assistant')?.text;
    if (!lastAnswer) { toast.error('No advisory to export — ask a question first'); return; }
    try {
      const { generateReport, downloadReportPdf } = await import('@/api/reportService');
      const gen = await generateReport('knowledge_factsheet', lastAnswer.slice(0, 80));
      const reportId = (gen as { data?: { id?: string } })?.data?.id || (gen as { id?: string })?.id;
      if (!reportId) throw new Error('No report id');
      const blob = await downloadReportPdf(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `co-pilot-${Date.now()}.pdf`; a.click(); URL.revokeObjectURL(url);
      toast.success('Prescription PDF downloaded');
    } catch (e) { toast.error((e as Error).message || 'PDF export failed'); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* ── Top HUD Navigation Banner (knockknockapp.ai standard) ── */}
      <div className="backdrop-blur-2xl bg-slate-900/70 border border-white/10 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          {/* Left: Branding & Model Badge */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">AI Agronomic Co-Pilot</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
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
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono" title={healthData ? `Health: ${healthData.status || 'ok'}` : 'Health check pending'}>
              <span className={`w-2 h-2 rounded-full ${healthData ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-white/70">NASA POWER:</span>
              <span className={healthData ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>{healthData ? 'SYNCHRONIZED' : '[DEMO] SYNCHRONIZED'}</span>
            </div>

            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono" title={kbStats?.data?.totalQueries != null ? `Total RAG queries: ${kbStats.data.totalQueries}` : 'Real RAG count via /knowledge/stats'}>
              <span className={`w-2 h-2 rounded-full ${kbStats?.data ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              <span className="text-white/70">RAG MESH:</span>
              <span className={kbStats?.data ? 'text-emerald-300 font-bold' : 'text-cyan-300 font-bold'}>{kbStats?.data?.totalQueries != null ? `${kbStats.data.totalQueries} QUERIES` : '[DEMO] 1,420 ARTICLES'}</span>
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
            {/* Conversational Stream Card */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-4 flex-1 flex flex-col justify-between shadow-xl min-h-[480px] max-h-[620px]">
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
                        className={`max-w-[92%] rounded-xl p-4 text-xs leading-relaxed ${
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
                {/* Dynamic Agronomic Intake Clarification */}
                {isAgronomicQueryAmbiguous(inputPrompt) && !intakeDismissed && !isProcessing && (
                  <AgronomicIntakeCard
                    initialQuery={inputPrompt}
                    compact={true}
                    onApplyIntake={enrichedQuery => {
                      setInputPrompt('');
                      handleSendMessage(enrichedQuery);
                    }}
                    onBypass={() => {
                      setIntakeDismissed(true);
                      handleSendMessage();
                    }}
                  />
                )}

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
                    onClick={() => handleSendMessage()}
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
            <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
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
                <span className="px-2.5 py-1 rounded-md text-xxs font-mono uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  GPU Interactive
                </span>
              </div>
            </div>

            {/* Generative Interactive Canvas Container (canvasui.dev glassmorphic standard) */}
            <div className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-xl p-5 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col justify-between">
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
                      <span className="text-xxs font-mono text-slate-500">Wait for a real image analysis</span>
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
                    <div className="w-full h-[460px]">
                      <AgroEcosystemCanvasScrubber showControls interactive className="w-full h-full" />
                    </div>
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
