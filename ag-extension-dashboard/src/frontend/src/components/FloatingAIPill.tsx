import React, { useState } from 'react';
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
  Radio,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { ProgressiveProfileChips, ProfileParameter } from './ProgressiveProfileChips';

interface FloatingAIPillProps {
  onOpenUSSDSandbox?: () => void;
  onNavigateToDiagnosis?: () => void;
}

type TabType = 'chat' | 'scan' | 'voice' | 'telecall';

const INITIAL_PROFILE: ProfileParameter[] = [
  { key: 'name', label: 'Farmer', value: 'Samuel Kiprop' },
  { key: 'crop', label: 'Crop', value: 'Potatoes / Maize' },
  { key: 'acreage', label: 'Acreage', value: '4.5 Ha' },
  { key: 'location', label: 'Ward', value: 'Njoro, Nakuru' },
  { key: 'soil', label: 'Soil pH', value: null },
];

export const FloatingAIPill: React.FC<FloatingAIPillProps> = ({
  onOpenUSSDSandbox,
  onNavigateToDiagnosis,
}) => {
  useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [chatInput, setChatInput] = useState('');
  const [profileParams, setProfileParams] = useState<ProfileParameter[]>(INITIAL_PROFILE);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; time: string }>>([
    {
      sender: 'ai',
      text: 'Hello! I am your AI Agronomist Assistant powered by Gemini & Ollama. Ask any crop health question, drop a leaf photo, or dictate a voice memo.',
      time: 'Just now',
    },
  ]);

  // Leaf photo scan state
  const [_scanFile, setScanFile] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    disease: string;
    confidence: number;
    severity: string;
    treatment: string;
  } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, time: now }]);
    setChatInput('');

    // Check if user mentioned soil parameter to demonstrate progressive profiling
    if (userText.toLowerCase().includes('ph') || userText.toLowerCase().includes('soil')) {
      setProfileParams(prev =>
        prev.map(p => (p.key === 'soil' ? { ...p, value: '6.4 (Optimal)' } : p))
      );
    }

    // Generate responsive agronomic advice
    setTimeout(() => {
      let aiReply = 'I have analyzed your query. For optimal yield, monitor soil moisture levels and ensure balanced NPK top-dressing.';
      if (userText.toLowerCase().includes('blight') || userText.toLowerCase().includes('spot') || userText.toLowerCase().includes('leaf')) {
        aiReply = 'Based on symptoms: Likely fungal infection (Late Blight or Leaf Spot). Immediate recommendation: Apply copper-based or Mancozeb fungicide, isolate infected rows, and avoid overhead irrigation.';
      } else if (userText.toLowerCase().includes('pest') || userText.toLowerCase().includes('armyworm') || userText.toLowerCase().includes('worm')) {
        aiReply = 'Pest Alert: For Fall Armyworm / stem borers, apply Emamectin benzoate early morning or late evening directly into the leaf whorls.';
      } else if (userText.toLowerCase().includes('maize') || userText.toLowerCase().includes('corn')) {
        aiReply = 'Maize Guidance: Check for nitrogen deficiency if bottom leaves turn yellow in a V-shape. Apply CAN fertilizer at knee-high stage.';
      }
      setMessages(prev => [...prev, { sender: 'ai', text: aiReply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }, 600);
  };

  const handleSimulateScan = () => {
    setScanFile('sample_leaf_scan.jpg');
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      setIsScanning(false);
      setScanResult({
        disease: 'Late Blight (Phytophthora infestans)',
        confidence: 94,
        severity: 'Severe (Outbreak Risk)',
        treatment: 'Apply Mancozeb / Metalaxyl spray immediately. Ensure 3-meter row clearance for airflow.',
      });
    }, 1200);
  };

  const handleToggleVoice = () => {
    if (!isRecording) {
      setIsRecording(true);
      setVoiceTranscript('Listening in English / Swahili...');
      setTimeout(() => {
        setIsRecording(false);
        setVoiceTranscript('"Farmer Otieno reports yellowing potato leaves in Ward 4 after continuous overnight rainfall. Soil pH tested at 6.2."');
        setProfileParams(prev =>
          prev.map(p => (p.key === 'soil' ? { ...p, value: '6.2 (Loam)' } : p))
        );
      }, 2500);
    } else {
      setIsRecording(false);
    }
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
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[1000] flex items-center gap-2"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="group flex items-center gap-3 px-4 py-3 rounded-full bg-slate-950/90 hover:bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-white shadow-2xl backdrop-blur-xl transition-all hover:scale-105 active:scale-95 shadow-emerald-950/60"
            >
              {/* Glowing Pulse Avatar */}
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <Bot className="w-4 h-4" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-950 animate-pulse" />
              </div>

              {/* Status & Label */}
              <div className="text-left pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black tracking-wide text-white">AI Agronomist</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ONLINE
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Click to chat, scan, or dictate</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded Glassmorphism Multimodal Drawer ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[1100] w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] max-h-[85vh] h-[85vh] bg-slate-950/95 border border-emerald-500/30 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-slate-100 shadow-emerald-950/80"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-wide">AI Agronomist</h3>
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                      <Sparkles className="w-2.5 h-2.5" />
                      Gemini/Ollama
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Multimodal Decision Support</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {onOpenUSSDSandbox && (
                  <button
                    onClick={onOpenUSSDSandbox}
                    title="Launch USSD Simulator"
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Multimodal Mode Switcher Tabs */}
            <div className="px-3 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center justify-around text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-all ${
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
              {/* TAB 1: AGRONOMIST CHAT */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full space-y-3">
                  {/* Progressive Conversational Profile Intake Header */}
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
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-slate-500 px-1 mt-1">{msg.time}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Preset quick prompts */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {['Maize stem borers', 'Tomato late blight', 'Soil pH 6.5 recommendations'].map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setChatInput(prompt);
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                      >
                        {prompt} &rarr;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: LEAF PHOTO SCAN */}
              {activeTab === 'scan' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900/40 text-center transition-all">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-2">
                      <Camera className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-white mb-1">Upload or Capture Leaf Photo</h4>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Drop diseased crop image for neural vision analysis
                    </p>
                    <button
                      onClick={handleSimulateScan}
                      disabled={isScanning}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center gap-2 mx-auto"
                    >
                      <UploadCloud className="w-4 h-4" />
                      {isScanning ? 'Analyzing Neural Models...' : 'Select Leaf Sample'}
                    </button>
                  </div>

                  {scanResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-lg space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <Leaf className="w-3.5 h-3.5" />
                          {scanResult.disease}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold text-[10px] rounded-full">
                          {scanResult.confidence}% Match
                        </span>
                      </div>
                      <div className="text-[11px] text-rose-400 font-bold">
                        Severity: {scanResult.severity}
                      </div>
                      <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                        <span className="font-bold text-white">Recommended Action:</span> {scanResult.treatment}
                      </div>
                      {onNavigateToDiagnosis && (
                        <button
                          onClick={onNavigateToDiagnosis}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <span>Open Full Disease Library</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* TAB 3: VOICE MEMO */}
              {activeTab === 'voice' && (
                <div className="space-y-4 text-center p-2">
                  <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center">
                    <button
                      onClick={handleToggleVoice}
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
                        isRecording
                          ? 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-500/20'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                      }`}
                    >
                      <Mic className="w-7 h-7" />
                    </button>
                    <p className="text-xs font-bold text-white mt-4">
                      {isRecording ? 'Listening in Field Mode...' : 'Tap to Record Agronomic Note'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports voice memos in English & Swahili
                    </p>
                  </div>

                  {voiceTranscript && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-2"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <Volume2 className="w-3.5 h-3.5" />
                        AI Voice Transcription
                      </div>
                      <p className="text-xs font-mono text-slate-200 italic leading-relaxed">
                        {voiceTranscript}
                      </p>
                      <button
                        onClick={() => {
                          setMessages(prev => [
                            ...prev,
                            {
                              sender: 'user',
                              text: voiceTranscript,
                              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            },
                          ]);
                          setActiveTab('chat');
                          setVoiceTranscript('');
                        }}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors"
                      >
                        Insert into Agronomist Chat &rarr;
                      </button>
                    </motion.div>
                  )}
                </div>
              )}

              {/* TAB 4: TELE-AGRONOMY CALL BRIDGE */}
              {activeTab === 'telecall' && (
                <div className="space-y-4 text-center p-2">
                  <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                      <Video className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-white">Instant Tele-Agronomy Call</h4>
                    <p className="text-[11px] text-slate-400">
                      Establish an encrypted low-bandwidth video & audio session with field farmers for visual leaf inspection.
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                      <Radio className="w-3 h-3 animate-pulse" />
                      WebRTC Mesh Ready (H.264 / Opus)
                    </div>
                    <button
                      onClick={() => {
                        setMessages(prev => [
                          ...prev,
                          {
                            sender: 'ai',
                            text: '📹 Tele-Agronomy consultation link generated: https://ag-extension.org/tele-call/session-8821. Farmer notified via SMS.',
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          },
                        ]);
                        setActiveTab('chat');
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Generate Live Call Link & Dispatch SMS
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Input Composer (for Chat Tab) */}
            {activeTab === 'chat' && (
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900/80">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Ask agronomist or crop symptom..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-md shadow-emerald-950"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
