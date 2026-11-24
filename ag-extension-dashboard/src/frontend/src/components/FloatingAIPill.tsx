import React, { useState, useRef, useEffect } from 'react';
import { appLocale } from '@/lib/appLocale';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Camera, Mic, Send, MessageSquare, Smartphone, UploadCloud, Volume2, Leaf, ArrowRight, Video, Loader2, Square, Link2, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { getChatCompletion, analyzeImage } from '@/api/aiService';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import { ProgressiveProfileChips, ProfileParameter } from './ProgressiveProfileChips';
import { useAppStore } from '@/store/useAppStore';
import { SCREENS_WITH_COMPOSER } from '@/lib/composerScreens';
import toast from 'react-hot-toast';
import { AudioReaderButton } from './audio/AudioReaderButton';
import { VoiceNoteTaker } from './audio/VoiceNoteTaker';
import { copyWithToast } from '@/lib/copyText';
import { safeStorage } from '@/lib/safeStorage';

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
                ? 'bg-emerald-600 text-white rounded-ee-none shadow-md'
                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-es-none shadow-sm whitespace-pre-wrap'
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
        <div className="flex items-center gap-2 p-3 bg-slate-900 border border-slate-800 rounded rounded-es-none max-w-[80%] text-xs text-slate-400 animate-pulse">
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
          <div className="w-10 h-10 rounded-md bg-slate-800 border border-white/[0.08] flex items-center justify-center text-slate-300 mx-auto mb-2">
            <Camera className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-medium text-white mb-1">Take or upload a leaf photo</h4>
          <p className="text-[11px] text-slate-400 mb-3">
            The photo is checked for signs of disease, pest damage and nutrient shortage.
          </p>
        </>
      )}

      <button
        type="button"
        disabled={isScanning}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors shadow-sm flex items-center gap-2 mx-auto"
      >
        {isScanning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking the photo…</span>
          </>
        ) : (
          <>
            <UploadCloud className="w-4 h-4" />
            <span>{previewImage ? 'Check again' : 'Choose a leaf photo'}</span>
          </>
        )}
      </button>
    </div>

    {scanAnalysis && (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 rounded bg-slate-900 border border-white/[0.08] shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between text-xs font-medium text-emerald-400">
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5" />
            Diagnosis and treatment
          </div>
          <AudioReaderButton
            text={scanAnalysis}
            size="xs"
            variant="ghost"
            className="text-emerald-400 hover:bg-slate-800"
          />
        </div>
        <div className="text-xs text-slate-200 bg-slate-950 p-3 rounded border border-slate-800 leading-relaxed whitespace-pre-wrap">
          {scanAnalysis}
        </div>
        {onNavigateToDiagnosis && (
          <button
            onClick={onNavigateToDiagnosis}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
          >
            <span>Open disease diagnosis</span>
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
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md ${
          isRecording
            ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/20'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {isRecording ? <Square className="w-5 h-5 fill-white" /> : <Mic className="w-6 h-6" />}
      </button>

      <p className="text-xs font-medium text-white mt-4">
        {isRecording
          ? `Recording (${formatDuration(recordingDuration)})…`
          : isTranscribing
          ? 'Transcribing with Whisper STT...'
          : 'Tap to record a voice note'}
      </p>
      <p className="text-[11px] text-slate-400 mt-1">
        Live speech recognition with Whisper AI noise suppression
      </p>
    </div>

    {interimText && isRecording && (
      <div className="p-3 rounded bg-slate-900 border border-white/[0.08] text-xs text-emerald-300 italic">
        "{interimText}..."
      </div>
    )}

    {capturedVoiceNote && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded bg-slate-900 border border-slate-800 text-start space-y-2"
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <Volume2 className="w-3.5 h-3.5" />
          Transcript
        </div>
        <p className="text-xs font-mono text-slate-200 leading-relaxed p-2 bg-slate-950 rounded border border-slate-800">
          {capturedVoiceNote}
        </p>
        <button
          onClick={onInsertVoiceToChat}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded transition-colors flex items-center justify-center gap-1.5"
        >
          <span>Ask the assistant with this note</span>
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
    <div className="p-5 rounded bg-slate-900 border border-white/[0.08] space-y-3">
      <div className="w-10 h-10 rounded-md bg-slate-800 border border-white/[0.08] flex items-center justify-center text-slate-300 mx-auto">
        <Video className="w-5 h-5" />
      </div>
      <h4 className="text-xs font-medium text-white">Video call with an agronomist</h4>
      <p className="text-[11px] text-slate-400">
        Start a secure WebRTC video call, then copy the invite link and share it with the farmer to join from their phone.
      </p>
      <button
        onClick={onStartCall}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded transition-colors shadow-sm flex items-center justify-center gap-1.5"
      >
        <Video className="w-3.5 h-3.5" />
        <span>Start a call</span>
      </button>
    </div>
  </div>
);

/**
 * Shown when no answer came back. The assistant never substitutes canned crop
 * advice for a failed answer: a dose or a planting window it did not retrieve
 * for this question could be wrong for this farm.
 */
const NO_ANSWER_TEXT =
  'No answer came back for this question, so none is shown. Try again in a moment, or ask your extension officer.';

function isUsableReply(reply: string | undefined): reply is string {
  if (!reply?.trim()) return false;
  const lower = reply.toLowerCase();
  return !lower.includes('internal error') && !lower.includes('unable to retrieve');
}

const INITIAL_WELCOME_MESSAGE = {
  sender: 'ai' as const,
  text: 'Ask a crop question, add a leaf photo, or record a voice note. Check advice with an extension officer before acting on it.',
  time: 'Online',
};

export const FloatingAIPill: React.FC<FloatingAIPillProps> = ({
  onOpenUSSDSandbox,
  onNavigateToDiagnosis,
}) => {
  // On phones the button would sit over these screens' own message box.
  const hideOnPhone = SCREENS_WITH_COMPOSER.has(useAppStore(state => state.activeTab));
  const { t } = useLanguage();
  const { language } = useLanguage();
  const storeUser = useAppStore(s => s.user);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [chatInput, setChatInput] = useState('');
  const [profileParams] = useState<ProfileParameter[]>(INITIAL_PROFILE);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; time: string }>>(() => {
    const saved = safeStorage.json<unknown>('gpexts_ai_chat_messages', null);
    if (Array.isArray(saved) && saved.length > 0) return saved;
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
        safeStorage.set('gpexts_ai_chat_messages', JSON.stringify(messages));
      }
    } catch (_err) {
      // LocalStorage write failed
    }
  }, [messages]);

  const handleResetChat = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    try {
      if (typeof window !== 'undefined') {
        safeStorage.remove('gpexts_ai_chat_messages');
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
    const now = new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, time: now }]);
    setChatInput('');
    setIsLoadingAi(true);

    const answeredAt = () => new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' });
    try {
      const res = await getChatCompletion(userText, undefined, language);
      const reply = res.data?.messages?.find(m => m.role === 'assistant')?.content;
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: isUsableReply(reply) ? reply : NO_ANSWER_TEXT, time: answeredAt() },
      ]);
    } catch (err) {
      console.warn('AI chat query failed:', err);
      setMessages(prev => [...prev, { sender: 'ai', text: NO_ANSWER_TEXT, time: answeredAt() }]);
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
        time: new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }),
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
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            className={`fixed bottom-[calc(env(safe-area-inset-bottom)+0.625rem)] end-3 md:bottom-6 md:end-6 z-[1000] items-center gap-2 ${hideOnPhone ? 'hidden md:flex' : 'flex'}`}
          >
            {/* Phones: a round glass button beside the tab bar, as iOS places its search button. */}
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center justify-center gap-2 h-16 w-16 md:h-11 md:w-auto md:ps-3 md:pe-4 rounded-full max-md:ios-glass md:bg-emerald-700 md:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 md:text-white md:dark:text-white text-sm font-medium md:shadow-lg md: transition-colors"
              aria-label={t('nav_aiassistant')}
              title={t('ui_floating_aipill_live_chat_leaf_scan_voice_memo')}
            >
              <Bot className="w-6 h-6 md:w-5 md:h-5" aria-hidden="true" />
              <span className="hidden md:inline">{t('nav_aiassistant')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded Multimodal Drawer ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] end-2 sm:end-6 md:bottom-6 md:end-6 z-[1100] w-[calc(100vw-1rem)] sm:w-[440px] max-w-[440px] max-h-[calc(100dvh-6rem)] h-[calc(100dvh-6rem)] md:max-h-[85vh] md:h-[85vh] bg-slate-950 border border-white/[0.08] rounded-xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-slate-100"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-white/[0.06] bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-slate-800 border border-white/[0.08] flex items-center justify-center text-slate-300">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white">{t('nav_aiassistant')}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/[0.08] font-mono">
                      {t('ui_floating_aipill_gpexts_intelligence')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{t('ui_floating_aipill_multimodal_decision_support')}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Reset conversation history"
                  aria-label="Reset conversation history"
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                {onOpenUSSDSandbox && (
                  <button
                    onClick={onOpenUSSDSandbox}
                    title="Launch USSD Simulator"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
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
            <div className="px-3 py-2 bg-slate-900/30 border-b border-white/[0.06] flex items-center justify-around text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-slate-800 text-white border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {t('action_chat')}
              </button>
              <button
                onClick={() => setActiveTab('scan')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'scan'
                    ? 'bg-slate-800 text-white border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                {t('ui_floating_aipill_leaf_scan')}
              </button>
              <button
                onClick={() => setActiveTab('voice')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'voice'
                    ? 'bg-slate-800 text-white border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                {t('ui_floating_aipill_voice')}
              </button>
              <button
                onClick={() => setActiveTab('telecall')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'telecall'
                    ? 'bg-slate-800 text-white border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                {t('ui_floating_aipill_tele_call')}
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
                            time: new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }),
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
                                  time: new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }),
                                },
                              ]);
                              return;
                            }
                            setMessages(prev => [
                              ...prev,
                              {
                                sender: 'ai',
                                text: reply,
                                time: new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }),
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
                                time: new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }),
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
                      className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded transition-colors shadow-sm"
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
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-950 border border-slate-800 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-slate-800 border border-white/[0.08] flex items-center justify-center text-slate-300">
                  <Video className="w-4 h-4" />
                </div>
                <h4 className="font-medium text-sm text-white">{t('ui_floating_aipill_tele_agronomy_video_consultation')}</h4>
              </div>
              <button
                onClick={() => {
                  const inviteLink = `${window.location.origin}/tele-call/${callSessionId}`;
                  void copyWithToast(inviteLink, 'Invite link copied — share it with the farmer to join this call.');
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
                <div className="p-8 text-center text-xs font-mono text-slate-400">{t('ui_floating_aipill_loading_video_consultation')}</div>
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
