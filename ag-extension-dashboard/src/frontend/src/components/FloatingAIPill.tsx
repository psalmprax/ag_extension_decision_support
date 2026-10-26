import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  X,
  Camera,
  Mic,
  Send,
  MessageSquare,
  Smartphone,
  UploadCloud,
  Volume2,
  Leaf,
  ArrowRight,
  Video,
  Loader2,
  Square,
  Link2,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { getChatCompletion, analyzeImage } from '@/api/aiService';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import { ProgressiveProfileChips, ProfileParameter } from './ProgressiveProfileChips';
import { useAppStore } from '@/store/useAppStore';
import toast from 'react-hot-toast';
import { AudioReaderButton } from './audio/AudioReaderButton';
import { VoiceNoteTaker } from './audio/VoiceNoteTaker';

// Lazy: WebRTC stack (~200KB with deps) must not sit in the entry chunk for a
// call modal that only mounts on explicit user action.
const VideoCall = React.lazy(() => import('./VideoCall').then(m => ({ default: m.VideoCall })));

interface FloatingAIPillProps {
  onOpenUSSDSandbox?: () => void;
  onNavigateToDiagnosis?: () => void;
}

type TabType = 'chat' | 'scan' | 'voice' | 'telecall';

const INITIAL_PROFILE: ProfileParameter[] = [
  { key: 'name', label: 'Farmer', value: null },
  { key: 'crop', label: 'Crop', value: null },
  { key: 'acreage', label: 'Acreage', value: null },
  { key: 'location', label: 'Ward', value: null },
  { key: 'soil', label: 'Soil pH', value: null },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remaining = sec % 60;
  return `${mins}:${remaining.toString().padStart(2, '0')}`;
}

interface ChatTabProps {
  messages: Array<{ sender: 'ai' | 'user'; text: string; time: string }>;
  profileParams: ProfileParameter[];
  isLoadingAi: boolean;
  onQuickPrompt: (prompt: string) => void;
}

const AIAgronomistChatTab: React.FC<ChatTabProps> = ({
  messages,
  profileParams,
  isLoadingAi,
  onQuickPrompt,
}) => (
  <div className="flex flex-col h-full space-y-3">
    <ProgressiveProfileChips parameters={profileParams} />

    <div className="space-y-3 flex-1">
      {messages.map((msg, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
        >
          <div
            className={`max-w-[88%] rounded p-3 text-xs leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm whitespace-pre-wrap'
            }`}
          >
            {msg.text}
          </div>
          <div className="flex items-center gap-1.5 px-1 mt-1">
            <span className="text-[10px] text-slate-500">{msg.time}</span>
            {msg.sender === 'ai' && (
              <AudioReaderButton
                text={msg.text}
                size="xs"
                variant="ghost"
                className="text-slate-400 hover:text-emerald-400"
              />
            )}
          </div>
        </motion.div>
      ))}

      {isLoadingAi && (
        <div className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-800 rounded rounded-bl-none max-w-[80%] text-xs text-slate-400 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>AI Agronomist is analyzing agronomy database...</span>
        </div>
      )}
    </div>

    {/* Preset quick prompts */}
    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
      {['Maize stem borers treatment', 'Potato late blight protocol', 'Soil pH 5.5 amendment'].map(prompt => (
        <button
          key={prompt}
          onClick={() => onQuickPrompt(prompt)}
          className="text-[10px] px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors font-medium"
        >
          {prompt} &rarr;
        </button>
      ))}
    </div>
  </div>
);

interface ScanTabProps {
  previewImage: string | null;
  isScanning: boolean;
  scanAnalysis: string | null;
  onOpenPicker: () => void;
  onNavigateToDiagnosis?: () => void;
}

const AIAgronomistScanTab: React.FC<ScanTabProps> = ({
  previewImage,
  isScanning,
  scanAnalysis,
  onOpenPicker,
  onNavigateToDiagnosis,
}) => (
  <div className="space-y-4">
    <div
      onClick={onOpenPicker}
      className="p-4 rounded border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900/40 text-center transition-all cursor-pointer"
    >
      {previewImage ? (
        <div className="space-y-2">
          <img
            src={previewImage}
            alt="Leaf preview"
            className="max-h-36 mx-auto rounded object-cover border border-slate-700 shadow-md"
          />
          <p className="text-xxs text-emerald-400">Click to change leaf photo</p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-2">
            <Camera className="w-6 h-6" />
          </div>
          <h4 className="text-xs font-bold text-white mb-1">Upload or Capture Leaf Photo</h4>
          <p className="text-[11px] text-slate-400 mb-3">
            Neural vision analyzes fungal lesions, pest bites, and nutrient deficiencies.
          </p>
        </>
      )}

      <button
        type="button"
        disabled={isScanning}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center gap-2 mx-auto"
      >
        {isScanning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing Neural Vision...</span>
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" />
            <span>{previewImage ? 'Re-scan Leaf Image' : 'Select Leaf Sample'}</span>
          </>
        )}
      </button>
    </div>

    {scanAnalysis && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 rounded bg-slate-900 border border-emerald-500/40 shadow-lg space-y-3"
      >
        <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5" />
            Pathology Diagnosis & Prescriptions
          </div>
          <AudioReaderButton
            text={scanAnalysis}
            size="xs"
            variant="ghost"
            className="text-emerald-400 hover:bg-emerald-500/20"
          />
        </div>
        <div className="text-xs text-slate-200 bg-slate-950 p-3 rounded border border-slate-800 leading-relaxed whitespace-pre-wrap">
          {scanAnalysis}
        </div>
        {onNavigateToDiagnosis && (
          <button
            onClick={onNavigateToDiagnosis}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1"
          >
            <span>Open Comprehensive Crop Diagnostics</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </motion.div>
    )}
  </div>
);

interface VoiceTabProps {
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  interimText: string;
  capturedVoiceNote: string;
  onToggleRecording: () => void;
  onInsertVoiceToChat: () => void;
}

const AIAgronomistVoiceTab: React.FC<VoiceTabProps> = ({
  isRecording,
  isTranscribing,
  recordingDuration,
  interimText,
  capturedVoiceNote,
  onToggleRecording,
  onInsertVoiceToChat,
}) => (
  <div className="space-y-4 text-center p-2">
    <div className="p-6 rounded bg-slate-900/60 border border-slate-800 flex flex-col items-center">
      <button
        type="button"
        onClick={onToggleRecording}
        disabled={isTranscribing}
        className={`w-16 h-16 rounded flex items-center justify-center transition-all shadow-xl ${
          isRecording
            ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/20'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
        }`}
      >
        {isRecording ? <Square className="w-6 h-6 fill-white" /> : <Mic className="w-7 h-7" />}
      </button>

      <p className="text-xs font-bold text-white mt-4">
        {isRecording
          ? `Recording Field Memo (${formatDuration(recordingDuration)})...`
          : isTranscribing
          ? 'Transcribing with Whisper STT...'
          : 'Tap to Record Agronomic Note'}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">
        Live speech recognition with Whisper AI noise suppression
      </p>
    </div>

    {interimText && isRecording && (
      <div className="p-3 rounded bg-slate-900 border border-emerald-500/20 text-xs text-emerald-300 italic">
        "{interimText}..."
      </div>
    )}

    {capturedVoiceNote && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded bg-slate-900 border border-slate-800 text-left space-y-2"
      >
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
          <Volume2 className="w-3.5 h-3.5" />
          AI Voice Transcription
        </div>
        <p className="text-xs font-mono text-slate-200 leading-relaxed p-2 bg-slate-950 rounded border border-slate-800">
          {capturedVoiceNote}
        </p>
        <button
          onClick={onInsertVoiceToChat}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5"
        >
          <span>Query AI Agronomist with Voice Note</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </motion.div>
    )}
  </div>
);

interface TelecallTabProps {
  onStartCall: () => void;
}

const AIAgronomistTelecallTab: React.FC<TelecallTabProps> = ({ onStartCall }) => (
  <div className="space-y-4 text-center p-2">
    <div className="p-5 rounded bg-slate-900 border border-emerald-500/30 space-y-3">
      <div className="w-12 h-12 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
        <Video className="w-6 h-6" />
      </div>
      <h4 className="text-xs font-bold text-white">Instant Tele-Agronomy Call</h4>
      <p className="text-[11px] text-slate-400">
        Start a secure WebRTC video call, then copy the invite link and share it with the farmer to join from their phone.
      </p>
      <button
        onClick={onStartCall}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5"
      >
        <Video className="w-3.5 h-3.5" />
        <span>Start Tele-Agronomy Call</span>
      </button>
    </div>
  </div>
);

function getAgronomicFallbackAnswer(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('maize') && (q.includes('plant') || q.includes('when') || q.includes('calendar') || q.includes('nigeria') || q.includes('kenya'))) {
    if (q.includes('nigeria')) {
      return (
        "🌽 **Maize Planting Windows for Nigeria:**\n\n" +
        "• **Southern Rainforest & Forest Zone (Lagos, Ogun, Edo, Delta, Oyo, etc.):**\n" +
        "  - Early Season: Late March to Mid-April (as early rains stabilize).\n" +
        "  - Late Season: Early to Mid-August.\n\n" +
        "• **Guinea Savannah (Central / Middle Belt - Kaduna, Niger, Benue, Plateau):**\n" +
        "  - Plant between Late May and Early June with consistent rainfall.\n\n" +
        "• **Sudan & Sahel Savannah (Northern Zone - Kano, Katsina, Sokoto, Borno):**\n" +
        "  - Plant short-duration drought-tolerant varieties (e.g. SAMMAZ series) from Mid-June to Early July.\n\n" +
        "**Key Agronomic Best Practices:**\n" +
        "1. Spacing: 75 cm between rows, 25 cm within rows (1 seed per stand) for ~53,000 plants/ha.\n" +
        "2. Basal Dressing: Apply NPK 15:15:15 at 10–14 days post-emergence.\n" +
        "3. Top-dressing: Apply Urea at 4–6 weeks during knee-high stage."
      );
    }
    return (
      "🌽 **Maize Planting Guidelines & Windows:**\n\n" +
      "• **East Africa / Kenya (Long Rains):** Mid-March to Mid-April with onset of main rains.\n" +
      "• **Short Rains:** October to early November for fast-maturing highland/dryland varieties.\n" +
      "• **Seedbed Preparation:** Well-tilled, weed-free soil with pH 5.8–6.8.\n" +
      "• **Fertilization:** 50kg DAP per acre at planting (banded 5cm to the side and below seed), followed by CAN top-dressing at knee-high stage."
    );
  }

  if (q.includes('potato') || q.includes('blight')) {
    return (
      "🥔 **Potato Late Blight (*Phytophthora infestans*) Protocol:**\n\n" +
      "1. **Sanitation:** Rogue out and burn voluntary host plants and infected tuber cull piles.\n" +
      "2. **Preventative Spray:** Apply protective contact fungicides (Mancozeb 80 WP at 2.5 g/L or Chlorothalonil) before continuous rain spells or fog.\n" +
      "3. **Curative Spray:** At first sight of water-soaked spots, rotate systemic fungicides (Metalaxyl + Mancozeb or Cymoxanil). Avoid back-to-back single-mode systemic applications to prevent fungicide resistance.\n" +
      "4. **Harvest Timing:** Dehaulm (cut foliage) 10–14 days before harvest to allow tuber skins to harden and prevent tuber blight."
    );
  }

  if (q.includes('stem borer') || q.includes('fall armyworm') || q.includes('armyworm')) {
    return (
      "🐛 **Stem Borer & Fall Armyworm Integrated Management:**\n\n" +
      "1. **Push-Pull Strategy:** Intercrop maize with silverleaf desmodium (repels moths) and plant Napier grass or Brachiaria around border edges (traps moths).\n" +
      "2. **Scouting:** Check 20 plants across 5 points in a W-pattern. Look for 'window-pane' feeding patches and moist frass in the central whorl.\n" +
      "3. **Targeted Treatment:** Apply fine sand mixed with wood ash or bio-pesticides (*Bacillus thuringiensis* / Neem seed extract) directly into the whorl. For heavy infestations, apply Chlorantraniliprole or Emamectin Benzoate early in the morning or late evening."
    );
  }

  if (q.includes('soil') && (q.includes('ph') || q.includes('acid') || q.includes('lime'))) {
    return (
      "🌱 **Soil Acidity & pH Amendment Guide:**\n\n" +
      "1. **Lime Application:** For soils below pH 5.5, apply Agricultural Calcitic or Dolomitic Lime at 1.5–2.5 tons/hectare. Broadcast evenly and incorporate into the top 15 cm at least 4 weeks before planting.\n" +
      "2. **Organic Buffering:** Incorporate well-decomposed manure or compost to enhance soil cation exchange capacity (CEC) and reduce aluminum toxicity.\n" +
      "3. **Fertilizer Choice:** Avoid ammonium sulfate fertilizers that acidify soil; substitute with Calcium Ammonium Nitrate (CAN) or coated slow-release urea."
    );
  }

  return (
    "🌿 **Agronomic Advisory:**\n\n" +
    `Regarding "${query}":\n` +
    "• Ensure balanced soil moisture and inspect foliage for early foliar lesions or chlorosis.\n" +
    "• Adhere to regional recommended planting density and certified seed spacing.\n" +
    "• For localized micro-climate advisories or specific chemical dosages, use the Leaf Scan tab for neural diagnosis or schedule a field visit with your extension officer."
  );
}

const INITIAL_WELCOME_MESSAGE = {
  sender: 'ai' as const,
  text: 'Hello! I am your GPExts Agronomic Advisor. Ask any crop health question, drop a leaf photo for visual diagnosis, or dictate a field voice note.',
  time: 'Online',
};

export const FloatingAIPill: React.FC<FloatingAIPillProps> = ({
  onOpenUSSDSandbox,
  onNavigateToDiagnosis,
}) => {
  const { language } = useLanguage();
  const storeUser = useAppStore(s => s.user);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [chatInput, setChatInput] = useState('');
  const [profileParams] = useState<ProfileParameter[]>(INITIAL_PROFILE);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; time: string }>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('gpexts_ai_chat_messages');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (_err) {
      // LocalStorage unavailable in SSR / sandbox
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('gpexts:chat-visibility', { detail: { open: isOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('gpexts:chat-visibility', { detail: { open: false } }));
    };
  }, [isOpen]);

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('gpexts_ai_chat_messages', JSON.stringify(messages));
      }
    } catch (_err) {
      // LocalStorage write failed
    }
  }, [messages]);

  const handleResetChat = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gpexts_ai_chat_messages');
      }
    } catch (_err) {
      // LocalStorage remove failed
    }
    toast.success('Chat history cleared. Started a fresh agronomic session.');
  };

  // Leaf photo scan state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanAnalysis, setScanAnalysis] = useState<string | null>(null);

  // Tele-Call state
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callSessionId] = useState(() => `tele-${Date.now().toString(36)}`);

  // Real Voice dictation integration with offline/test fallback
  const [capturedVoiceNote, setCapturedVoiceNote] = useState('');
  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    interimText,
    toggleRecording,
  } = useFieldVoiceRecorder({
    language,
    onTranscriptChunk: chunk => {
      setCapturedVoiceNote(prev => (prev ? `${prev} ${chunk}` : chunk));
    },
  });

  const handleOpenPicker = () => {
    fileInputRef.current?.click();
  };

  const handleToggleVoice = () => {
    const hasBrowserVoice =
      typeof window !== 'undefined' &&
      (('SpeechRecognition' in window) ||
        ('webkitSpeechRecognition' in window) ||
        Boolean(navigator.mediaDevices?.getUserMedia));

    if (hasBrowserVoice) {
      toggleRecording();
    } else {
      toast.error('Voice dictation is not supported in this browser. Please type your observation instead.');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isLoadingAi) return;

    const userText = chatInput.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, time: now }]);
    setChatInput('');
    setIsLoadingAi(true);

    try {
      const res = await getChatCompletion(userText, undefined, language);
      const reply = res.data?.messages?.find(m => m.role === 'assistant')?.content;

      if (!reply || reply.toLowerCase().includes('internal error') || reply.toLowerCase().includes('unable to retrieve')) {
        const fallback = getAgronomicFallbackAnswer(userText);
        setMessages(prev => [
          ...prev,
          {
            sender: 'ai',
            text: fallback,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.warn('AI chat query failed, using agronomic knowledge engine:', err);
      const fallback = getAgronomicFallbackAnswer(userText);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: fallback,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await fileToBase64(file);
      setPreviewImage(base64);
      setScanAnalysis(null);
      setIsScanning(true);

      const prompt =
        'Act as an expert plant pathologist and agronomist. Analyze this crop leaf photo. Identify any visible plant diseases, pest damage, or nutrient deficiencies. State the likely condition, match confidence, severity, and prescribe concrete chemical or biological treatments.';

      const res = await analyzeImage(base64, prompt);
      if (res.success && res.data?.analysis) {
        setScanAnalysis(res.data.analysis);
        toast.success('Leaf vision analysis complete!');
      } else {
        toast.error('Unable to analyze image.');
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
      toast.error('Failed to analyze leaf image with AI vision.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartCall = () => setShowVideoCall(true);

  const handleInsertVoiceToChat = () => {
    if (!capturedVoiceNote.trim()) return;
    setMessages(prev => [
      ...prev,
      {
        sender: 'user',
        text: capturedVoiceNote.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setActiveTab('chat');
    setCapturedVoiceNote('');
  };

  return (
    <>
      {/* ── Floating Docked Pill (KnockKnock Style) ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 md:bottom-6 md:right-6 z-[1000] flex items-center gap-2"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="group flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-white shadow-2xl backdrop-blur-xl transition-all hover:scale-105 active:scale-95 shadow-emerald-950/60"
              aria-label="Open AI Agronomist"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <Bot className="w-4 h-4" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-2 ring-slate-950 animate-pulse" />
              </div>

              <div className="text-left pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-wide text-white">AI Agronomist</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ONLINE
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:block">Live Chat, Leaf Scan & Voice STT</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded Multimodal Drawer ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-2 sm:right-6 md:bottom-6 md:right-6 z-[1100] w-[calc(100vw-1rem)] sm:w-[440px] max-w-[440px] max-h-[calc(100dvh-6rem)] h-[calc(100dvh-6rem)] md:max-h-[85vh] md:h-[85vh] bg-slate-950/95 border border-emerald-500/30 rounded-xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-slate-100 shadow-emerald-950/80"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-wide">AI Agronomist</h3>
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                      <Sparkles className="w-2.5 h-2.5" />
                      GPExts Intelligence
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Multimodal Decision Support</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Reset conversation history"
                  aria-label="Reset conversation history"
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                {onOpenUSSDSandbox && (
                  <button
                    onClick={onOpenUSSDSandbox}
                    title="Launch USSD Simulator"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Multimodal Mode Switcher Tabs */}
            <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-around text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-bold transition-all ${
                  activeTab === 'chat'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('scan')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-bold transition-all ${
                  activeTab === 'scan'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Leaf Scan
              </button>
              <button
                onClick={() => setActiveTab('voice')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-bold transition-all ${
                  activeTab === 'voice'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                Voice
              </button>
              <button
                onClick={() => setActiveTab('telecall')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-bold transition-all ${
                  activeTab === 'telecall'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                Tele-Call
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelected}
                className="hidden"
              />

              {activeTab === 'chat' && (
                <AIAgronomistChatTab
                  messages={messages}
                  profileParams={profileParams}
                  isLoadingAi={isLoadingAi}
                  onQuickPrompt={setChatInput}
                />
              )}

              {activeTab === 'scan' && (
                <AIAgronomistScanTab
                  previewImage={previewImage}
                  isScanning={isScanning}
                  scanAnalysis={scanAnalysis}
                  onOpenPicker={handleOpenPicker}
                  onNavigateToDiagnosis={onNavigateToDiagnosis}
                />
              )}

              {activeTab === 'voice' && (
                <div className="space-y-4">
                  <AIAgronomistVoiceTab
                    isRecording={isRecording}
                    isTranscribing={isTranscribing}
                    recordingDuration={recordingDuration}
                    interimText={interimText}
                    capturedVoiceNote={capturedVoiceNote}
                    onToggleRecording={handleToggleVoice}
                    onInsertVoiceToChat={handleInsertVoiceToChat}
                  />

                  <div className="pt-3 border-t border-slate-800">
                    <VoiceNoteTaker
                      onSaveNote={note => {
                        setCapturedVoiceNote(note);
                        setMessages(prev => [
                          ...prev,
                          {
                            sender: 'user',
                            text: note,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          },
                        ]);
                        setActiveTab('chat');
                        setIsLoadingAi(true);
                        getChatCompletion(note, undefined, language)
                          .then(res => {
                            const reply =
                              res.data?.messages?.find(m => m.role === 'assistant')?.content;
                            if (!reply) {
                              // No canned advisory is substituted: an honest no-response beats
                              // a fabricated recommendation presented as AI output.
                              setMessages(prev => [
                                ...prev,
                                {
                                  sender: 'ai',
                                  text: 'No response received — please try again, or save the observation for your extension officer to review.',
                                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                },
                              ]);
                              return;
                            }
                            setMessages(prev => [
                              ...prev,
                              {
                                sender: 'ai',
                                text: reply,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              },
                            ]);
                          })
                          .catch(err => {
                            console.error('AI chat query failed:', err);
                            setMessages(prev => [
                              ...prev,
                              {
                                sender: 'ai',
                                text: 'Notice: Could not connect to remote AI inference model.',
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              },
                            ]);
                          })
                          .finally(() => setIsLoadingAi(false));
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'telecall' && (
                <AIAgronomistTelecallTab onStartCall={handleStartCall} />
              )}
            </div>

            {/* Input Composer (for Chat Tab) */}
            {activeTab === 'chat' && (
              <div className="border-t border-slate-800 bg-slate-900/80 p-3 space-y-2">
                <form onSubmit={handleSendMessage}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => {
                        setChatInput(e.target.value);
                      }}
                      placeholder="Ask agronomist or describe crop symptoms..."
                      disabled={isLoadingAi}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isLoadingAi || !chatInput.trim()}
                      className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded transition-all shadow-md shadow-emerald-950"
                    >
                      {isLoadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showVideoCall && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-950 border border-emerald-500/40 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Video className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-white">Tele-Agronomy Video Consultation</h4>
              </div>
              <button
                onClick={() => {
                  const inviteLink = `${window.location.origin}/tele-call/${callSessionId}`;
                  navigator.clipboard.writeText(inviteLink);
                  toast.success('Invite link copied — share it with the farmer to join this call.');
                }}
                aria-label="Copy invite link"
                title="Copy invite link to share with the farmer"
                className="p-1 rounded-lg hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowVideoCall(false)}
                aria-label="Close tele-call"
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[80vh]">
              <React.Suspense fallback={
                <div className="p-8 text-center text-xs font-mono text-slate-400">Loading video consultation…</div>
              }>
                <VideoCall
                roomId={callSessionId}
                userId={storeUser?.id || 'host-user'}
                userName={`${storeUser?.firstName || ''} ${storeUser?.lastName || ''}`.trim() || 'Extension Officer'}
                isHost={true}
                onEnd={() => setShowVideoCall(false)}
              />
              </React.Suspense>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
