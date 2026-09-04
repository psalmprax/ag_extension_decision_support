import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Sparkles,
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

import type { SoilProbeResult } from '../canvas-ui/SoilNutrientHeatmapCanvas';
import type { LesionDetectionZone } from '../canvas-ui/DiseaseSaliencyCanvas';
import type { GraphNode } from '../canvas-ui/RagKnowledgeGraphCanvas';
import AlphaAgentOps from './AlphaAgentOps';
import { AgronomicIntakeCard, isAgronomicQueryAmbiguous } from '../AgronomicIntakeCard';
import type { CanvasViewType } from './alpha/rules';
import { nowStamp, drainAlphaOfflineQueue } from './alpha/offlineQueue';
import {
  type ChatMessageItem,
  stashQueryOffline,
  requestAdvisoryMessage,
  handleAdvisoryFailure,
} from './alpha/response';
import { StudioTabSwitcher, CanvasWorkbench, type LastImageAnalysis } from './alpha/StudioTabs';
import { MessageStream } from './alpha/MessageStream';
import { NasaPowerBadge, RagMeshBadge } from './alpha/badges';
import { analyzeLeafImage } from './alpha/utils/leafAnalysis';

/** Begin voice capture and hand the recorded blob to onReady; null when unsupported. */
async function startVoiceCapture(
  onReady: (blob: Blob, mimeType: string) => Promise<void>
): Promise<MediaRecorder | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast.error('Voice input unavailable in this browser');
    return null;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    await onReady(new Blob(chunks, { type: recorder.mimeType }), recorder.mimeType);
  };
  recorder.start();
  return recorder;
}

/** Transcribe a recorded voice blob via the backend Whisper endpoint; null when unusable. */
async function transcribeVoiceBlob(blob: Blob, mimeType: string): Promise<string | null> {
  const base64 = await new Promise<string | null>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || null);
    reader.readAsDataURL(blob);
  });
  if (!base64) {
    toast.error('Could not read audio');
    return null;
  }
  try {
    const { data } = await apiClient.post('/pillars/voice/transcribe', { audio: base64, mimeType });
    const text = (data?.data?.transcription || data?.transcription || '').toString().trim();
    if (text && !text.startsWith('[STUB')) return text;
    if (text) toast(`Transcribed (demo): ${text.slice(0, 80)}…`);
    else toast.error('Transcription returned no text');
    return null;
  } catch (e) {
    toast.error(
      (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Transcription failed — check OPENAI_API_KEY'
    );
    return null;
  }
}

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
  const [lastImageAnalysis, setLastImageAnalysis] = useState<LastImageAnalysis | null>(null);
  const [intakeDismissed, setIntakeDismissed] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const handleSendRef = useRef<
    (overrideQuery?: string, opts?: { fromQueue?: boolean }) => Promise<boolean>
  >(async () => false);

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

  // Drain offline queue when back online — the sender is read through a ref so the
  // subscription survives re-renders without re-binding the listener.
  useEffect(() => {
    const drain = () => {
      void drainAlphaOfflineQueue(queued => handleSendRef.current(queued, { fromQueue: true }));
    };
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, []);

  /** Returns true when an advisory was delivered, false when it failed/was queued. */
  const handleSendMessage = async (
    overrideQuery?: string,
    opts: { fromQueue?: boolean } = {}
  ): Promise<boolean> => {
    const query = (overrideQuery || inputPrompt).trim();
    if (!query || isProcessing) return false;

    if (isOffline()) {
      if (!opts.fromQueue) stashQueryOffline(query, setMessages);
      setInputPrompt('');
      return false;
    }

    await processMessage(query, opts);
    return true;
  };
  handleSendRef.current = handleSendMessage;

  function isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  }

  async function processMessage(query: string, opts: { fromQueue?: boolean }): Promise<void> {
    setInputPrompt('');
    appendUserMessage(query);
    setIsProcessing(true);
    setActiveReasoningStep('Retrieving knowledge-base context...');

    try {
      const assistantMsg = await requestAdvisoryMessage(query);
      if (assistantMsg.canvasTrigger) setActiveCanvasView(assistantMsg.canvasTrigger);
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      handleSendFailure(err, query, opts);
    } finally {
      setActiveReasoningStep(null);
      setIsProcessing(false);
    }
  }

  function appendUserMessage(text: string): void {
    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text, timestamp: nowStamp() } as ChatMessageItem,
    ]);
  }

  function handleSendFailure(err: unknown, query: string, opts: { fromQueue?: boolean }): void {
    if (opts.fromQueue) {
      setMessages(prev => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: 'Still unable to reach the advisory service — your queued question will be retried when the connection recovers.',
          timestamp: nowStamp(),
        } as ChatMessageItem,
      ]);
    } else {
      handleAdvisoryFailure(err, query, setMessages);
    }
  }

  const handleVoiceToggle = async () => {
    if (isRecordingVoice) {
      voiceRecorderRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }
    try {
      const recorder = await startVoiceCapture(async (blob, mimeType) => {
        setActiveReasoningStep('Transcribing voice (Whisper)...');
        try {
          const text = await transcribeVoiceBlob(blob, mimeType);
          if (text) {
            setInputPrompt(text);
            toast.success(`Transcribed: ${text.slice(0, 60)}…`);
          }
        } finally {
          setActiveReasoningStep(null);
        }
      });
      if (!recorder) return;
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
      setActiveReasoningStep('Analyzing leaf image (vision)…');
      try {
        const { summary, analysis } = await analyzeLeafImage(file);
        setLastImageAnalysis(analysis);
        setActiveCanvasView('disease_saliency');
        setMessages(prev => [
          ...prev,
          {
            id: `img-${Date.now()}`,
            sender: 'assistant',
            text: `🖼️ **Image diagnosis:** ${summary}`,
            timestamp: nowStamp(),
            canvasTrigger: 'disease_saliency',
            canvasLabel: 'Leaf Image Assessment',
          },
        ]);
        toast.success('Image analyzed — check Disease Diagnosis for lab verification');
      } catch (e) {
        toast.error(
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            (e as Error)?.message ||
            'Image analysis failed'
        );
      } finally {
        setActiveReasoningStep(null);
      }
    };
    input.click();
  };

  const handleDispatchSms = async () => {
    const lastAnswer = [...messages].reverse().find(m => m.sender === 'assistant')?.text;
    if (!lastAnswer) {
      toast.error('No advisory to dispatch — ask a question first');
      return;
    }
    try {
      const { useAppStore } = await import('@/store/useAppStore');
      // SMS body limit: 160 GSM-7 chars per segment; keep to ~2 segments and mark truncation.
      const body = lastAnswer.replace(/\*\*/g, '').trim();
      const truncated = body.length > 300 ? `${body.slice(0, 297)}…` : body;
      useAppStore.getState().setPendingSMS({ phone: '', message: truncated });
      const storeTab = (useAppStore.getState() as { setActiveTab?: (t: string) => void })
        .setActiveTab;
      storeTab?.('sms');
      toast(
        truncated.length < body.length
          ? 'Opening SMS composer (advisory truncated to 300 chars)…'
          : 'Opening SMS composer with last advisory…'
      );
    } catch {
      toast.error('SMS dispatch requires SMS page');
    }
  };

  const handleExportPdf = async () => {
    const lastAnswer = [...messages].reverse().find(m => m.sender === 'assistant')?.text;
    if (!lastAnswer) {
      toast.error('No advisory to export — ask a question first');
      return;
    }
    try {
      const { generateReport, downloadReportPdf } = await import('@/api/reportService');
      const lastQuestion = [...messages].reverse().find(m => m.sender === 'user')?.text;
      const gen = await generateReport(
        'knowledge_factsheet',
        `Advisory: ${(lastQuestion || lastAnswer).slice(0, 80)}`,
        undefined,
        { content: lastAnswer, question: lastQuestion }
      );
      const reportId =
        (gen as { data?: { id?: string } })?.data?.id || (gen as { id?: string })?.id;
      if (!reportId) throw new Error('No report id');
      const blob = await downloadReportPdf(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `co-pilot-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Prescription PDF downloaded');
    } catch (e) {
      toast.error((e as Error).message || 'PDF export failed');
    }
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
                <h1 className="text-xl font-bold tracking-tight text-white">
                  AI Agronomic Co-Pilot
                </h1>
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
            <NasaPowerBadge data={healthData} />
            <RagMeshBadge data={kbStats} />

            {/* Studio / Ops Toggle */}
            <StudioTabSwitcher active={activeStudioTab} onSelect={setActiveStudioTab} />
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
              <MessageStream
                messages={messages}
                isProcessing={isProcessing}
                activeReasoningStep={activeReasoningStep}
                onSelectCanvas={setActiveCanvasView}
                messagesEndRef={messagesEndRef}
              />

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
                    {isRecordingVoice ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
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
              {' '}
              {/* Dynamic Mounted Canvas */}
              <div className="flex-1 flex flex-col justify-center">
                <CanvasWorkbench
                  view={activeCanvasView}
                  selectedProbeResult={selectedProbeResult}
                  onProbeSelect={setSelectedProbeResult}
                  selectedLesionZone={selectedLesionZone}
                  onLesionZoneSelect={setSelectedLesionZone}
                  selectedGraphNode={selectedGraphNode}
                  onGraphNodeSelect={setSelectedGraphNode}
                  onDispatchSms={handleDispatchSms}
                  citations={
                    [...messages]
                      .reverse()
                      .find(m => m.sender === 'assistant' && m.citations?.length)?.citations ?? []
                  }
                  lastImageAnalysis={lastImageAnalysis}
                />
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
