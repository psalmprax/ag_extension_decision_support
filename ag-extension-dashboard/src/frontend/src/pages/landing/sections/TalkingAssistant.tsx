import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  Globe,
  Radio,
  Bot,
  User,
} from 'lucide-react';
import { fadeUp, stagger } from '../variants';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  language?: string;
  sourceBadge?: string;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  {
    icon: '🌽',
    label: 'Fall Armyworm bio-control',
    text: 'What is the recommended bio-control treatment for Fall Armyworm in maize?',
    lang: 'en',
  },
  {
    icon: '🧪',
    label: 'Acidic Soil Remediation',
    text: 'How should I remediate acidic soil with pH 4.8 for cereal production?',
    lang: 'en',
  },
  {
    icon: '🌦️',
    label: 'Satellite Weather',
    text: 'How does the NASA POWER satellite stream predict drought anomalies?',
    lang: 'en',
  },
  {
    icon: '📱',
    label: 'Offline Sync & Security',
    text: 'How does offline sync and remote device wipe protect farmer data?',
    lang: 'en',
  },
  {
    icon: '🌾',
    label: 'Ugonjwa wa Nyanya (Swahili)',
    text: 'Nini tiba bora ya ugonjwa wa ukungu (blight) kwenye mimea ya nyanya?',
    lang: 'sw',
  },
];

const PRESET_ANSWERS: Record<string, { en: { text: string; source: string }; sw: { text: string; source: string } }> = {
  armyworm: {
    en: {
      text: 'For early instar Fall Armyworm in maize, scout leaf whorls at dawn or dusk. Apply botanical bio-control using cold-pressed Neem oil (Azadirachtin 0.03% EC at 3ml/L) or alternate with Bacillus thuringiensis (Bt subsp. kurstaki). Apply spray nozzles directly into the central funnel during low wind conditions to maximize larval contact and protect beneficial parasitoids.',
      source: 'FAO Fall Armyworm Management Guide & CABI Biopesticide Manual',
    },
    sw: {
      text: 'Kwa funza wa vunguvungu (Fall Armyworm) kwenye mahindi, kagua mashina asubuhi au jioni. Tumia dawa ya asili ya mafuta ya mwarobaini (Neem oil mililita 3 kwa lita moja ya maji) au Bacillus thuringiensis. Nyunyizia moja kwa moja ndani ya funeli ya mmea ili kuua funza bila kudhuru wadudu rafiki.',
      source: 'Mwongozo wa FAO na Taasisi ya Utafiti wa Kilimo',
    },
  },
  soil: {
    en: {
      text: 'At pH 4.8, soils suffer from severe aluminum and iron toxicity while phosphorus and magnesium fixation occurs. Apply agricultural calcitic or dolomitic lime at 2.0 to 2.5 tonnes per hectare, incorporated into the top 15cm of soil 30 days prior to planting. Complement with organic compost or biochar to buffer soil cation exchange capacity (CEC).',
      source: 'SoilGrids ISRIC Global Soil Data & Regional Agronomic Norms',
    },
    sw: {
      text: 'Kiwango cha tindikali cha pH 4.8 kinazuia mizizi kufyonza fosforasi na magnesiamu. Weka chokaa ya kilimo (agricultural lime) tani 2 hadi 2.5 kwa hekta moja, ikichanganywa na udongo siku 30 kabla ya kupanda. Ongeza mbolea ya samadi ili kuongeza rutuba na uwezo wa udongo.',
      source: 'ISRIC SoilGrids na Miongozo ya Udongo ya Afrika Mashariki',
    },
  },
  weather: {
    en: {
      text: 'The platform ingests NASA POWER satellite telemetry via solar irradiance, surface air temperatures, and relative humidity coefficients. By calculating 14-day rolling Standardized Precipitation Evapotranspiration Indices (SPEI), autonomous agents forecast drought stress windows and issue preventive irrigation or soil mulching advisories to farmers.',
      source: 'NASA POWER Satellite Observations & FAO Evapotranspiration Model',
    },
    sw: {
      text: 'Mfumo unapokea data kutoka satelaiti ya NASA POWER inayopima jua, unyevu wa hewa, na upepo. Mawakala wa kijasusi wanachambua uwezekano wa ukame na kutuma ujumbe mfupi wa tahadhari kwa wakulima ili kuhifadhi unyevu kwa matandazo ya majani (mulching).',
      source: 'Satelaiti ya NASA POWER & Mfumo wa Tahadhari wa GP-Ext',
    },
  },
  security: {
    en: {
      text: 'Field officers store farmer records in local encrypted IndexedDB using AES-256-GCM. When cell reception drops, queries and photos queue securely with cryptographic timestamps. If a field device is lost or stolen, administrators dispatch a remote wipe signal from the dashboard that purges all local offline cache, tokens, and IndexedDB stores upon next connection.',
      source: 'GP-Ext Defense-in-Depth Cyber Architecture (SOC 2 / GDPR Compliant)',
    },
    sw: {
      text: 'Maafisa ugani wanarekodi taarifa za wakulima kwa njia fiche ya AES-256 bila kuhitaji intaneti. Kifaa kikipotea au kuibiwa, msimamizi anaweza kutuma amri ya mbali (Remote Wipe) kufuta data zote za wakulima mara moja ili kulinda usiri wao.',
      source: 'Usalama wa Data na Sheria ya Kulinda Taarifa za Wakulima',
    },
  },
  default: {
    en: {
      text: 'Our AI Agronomic Engine combines satellite weather telemetry, local soil chemistry mapping, and verified FAO extension guidelines to generate actionable recommendations. You can ask about crop diseases, planting calendars, fertilizer dosing, or platform security.',
      source: 'GP-Ext Autonomous Decision Support Engine',
    },
    sw: {
      text: 'Msaidizi wetu wa sauti anakusaidia kupata majibu sahihi kuhusu afya ya mimea, hali ya hewa, utunzaji wa udongo, na usalama wa mazao kwa lugha ya Kiswahili na Kiingereza.',
      source: 'Injini ya Ushauri wa Kilimo ya GP-Ext',
    },
  },
};

function resolveResponse(query: string, language: 'en' | 'sw'): { text: string; source: string } {
  const q = query.toLowerCase();
  if (q.includes('armyworm') || q.includes('funza') || q.includes('caterpillar') || q.includes('pest') || q.includes('wadudu')) {
    return PRESET_ANSWERS.armyworm[language];
  }
  if (q.includes('soil') || q.includes('ph') || q.includes('acid') || q.includes('lime') || q.includes('udongo') || q.includes('chokaa')) {
    return PRESET_ANSWERS.soil[language];
  }
  if (q.includes('weather') || q.includes('satellite') || q.includes('nasa') || q.includes('rain') || q.includes('ukame') || q.includes('hewa')) {
    return PRESET_ANSWERS.weather[language];
  }
  if (q.includes('offline') || q.includes('wipe') || q.includes('security') || q.includes('hack') || q.includes('salama') || q.includes('siri')) {
    return PRESET_ANSWERS.security[language];
  }
  return PRESET_ANSWERS.default[language];
}

export function TalkingAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your AI Agronomic Extension Assistant. You can speak to me using your microphone or type a question about crop pathology, soil health, satellite weather, or platform security.',
      language: 'en',
      sourceBadge: 'GP-Ext Voice Core',
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'sw'>('en');
  const [autoSpeak, setAutoSpeak] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Web Speech APIs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTtsSupported('speechSynthesis' in window);
      synthRef.current = window.speechSynthesis || null;
    }
    return () => {
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle Speech Synthesis
  const speakText = useCallback(
    (text: string, lang: 'en' | 'sw' = selectedLanguage) => {
      if (!synthRef.current || !ttsSupported) return;

      try {
        synthRef.current.cancel();
        setIsSpeaking(true);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'sw' ? 'sw-KE' : 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        utterance.onend = () => {
          setIsSpeaking(false);
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
        };

        synthRef.current.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis failed:', err);
        setIsSpeaking(false);
      }
    },
    [selectedLanguage, ttsSupported]
  );

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch {
        // ignore
      }
    }
    setIsSpeaking(false);
  }, []);

  // Send Message Logic
  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const query = (textToSend || inputText).trim();
      if (!query) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: query,
        language: selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, userMsg]);
      setInputText('');

      // Formulate response
      setTimeout(() => {
        const res = resolveResponse(query, selectedLanguage);
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: res.text,
          language: selectedLanguage,
          sourceBadge: res.source,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages(prev => [...prev, assistantMsg]);

        if (autoSpeak) {
          speakText(res.text, selectedLanguage);
        }
      }, 350);
    },
    [autoSpeak, inputText, selectedLanguage, speakText]
  );

  // Handle Voice Input via Web Speech API
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      if (isSpeaking) {
        stopSpeaking();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = selectedLanguage === 'sw' ? 'sw-KE' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  }, [handleSendMessage, isSpeaking, selectedLanguage, stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  return (
    <section
      id="talking-assistant"
      className="relative py-20 sm:py-28 border-t border-white/[0.04] overflow-hidden bg-slate-950/80 scroll-mt-10"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/[0.04] rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="text-center mb-12 sm:mb-16"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Interactive Voice & Speech AI</span>
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-4"
          >
            Talk Directly to the Agronomic Copilot
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="text-sm sm:text-base text-white/65 max-w-2xl mx-auto leading-relaxed"
          >
            Test our multilingual voice intelligence right here. Press the microphone to speak,
            or choose a prompt below to hear verified agronomic recommendations read aloud.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-6 sm:gap-8 items-stretch">
          {/* Left Column: Voice Orb, Controls, and Settings */}
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl flex flex-col justify-between items-center text-center relative overflow-hidden shadow-2xl shadow-black/60">
            <div className="w-full flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2 text-xs font-medium text-white/70">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono uppercase tracking-wider">Voice Language</span>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950/70 border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                    selectedLanguage === 'en'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('sw')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                    selectedLanguage === 'sw'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Kiswahili
                </button>
              </div>
            </div>

            {/* Audio-Reactive Voice Orb Visualizer */}
            <div className="my-6 relative flex items-center justify-center">
              {(isListening || isSpeaking) && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className={`absolute w-44 h-44 rounded-full border-2 ${
                      isListening ? 'border-amber-400' : 'border-emerald-400'
                    }`}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    className={`absolute w-44 h-44 rounded-full border ${
                      isListening ? 'border-amber-400' : 'border-emerald-400'
                    }`}
                  />
                </>
              )}

              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                aria-label={isListening ? 'Stop recording voice' : isSpeaking ? 'Speaking response' : 'Start speaking voice inquiry'}
                className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl focus:outline-none focus:ring-4 ${
                  isListening
                    ? 'bg-amber-500 text-slate-950 ring-amber-400/40 shadow-amber-500/50 scale-105'
                    : isSpeaking
                    ? 'bg-emerald-500 text-slate-950 ring-emerald-400/40 shadow-emerald-500/50'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white hover:scale-105 hover:shadow-emerald-500/30'
                }`}
                title={isListening ? 'Stop listening' : 'Tap to speak'}
              >
                {isListening ? (
                  <>
                    <Mic className="w-9 h-9 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Listening</span>
                  </>
                ) : isSpeaking ? (
                  <>
                    <Volume2 className="w-9 h-9 animate-bounce" />
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Speaking</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-9 h-9" />
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Tap to Speak</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Audio Equalizer Waveform */}
            <div className="h-8 flex items-center justify-center gap-1 my-2">
              {[40, 70, 100, 60, 85, 45, 95, 60, 80, 50, 90, 65].map((h, i) => (
                <motion.div
                  key={i}
                  animate={
                    isListening || isSpeaking
                      ? {
                          height: [8, (h * 32) / 100, 8],
                        }
                      : { height: 4 }
                  }
                  transition={
                    isListening || isSpeaking
                      ? {
                          duration: 0.8 + (i % 4) * 0.15,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }
                      : { duration: 0.3 }
                  }
                  className={`w-1 rounded-full transition-colors ${
                    isListening
                      ? 'bg-amber-400'
                      : isSpeaking
                      ? 'bg-emerald-400'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>

            <div className="w-full mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-white/70">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  {autoSpeak ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-white/40" />
                  )}
                  <span>Auto-Voice Playback: {autoSpeak ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-[11px] font-semibold"
                >
                  Stop Audio
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Chat & Spoken Transcript */}
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl flex flex-col justify-between shadow-2xl shadow-black/60">
            {/* Message Stream */}
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-white/10">
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-start gap-3 ${
                      msg.sender === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        msg.sender === 'user'
                          ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-300'
                          : 'bg-teal-500/20 border border-teal-500/30 text-teal-300'
                      }`}
                    >
                      {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-slate-950/80 border border-white/[0.08] text-white/90 rounded-tl-none'
                      }`}
                    >
                      <p>{msg.text}</p>

                      {msg.sourceBadge && (
                        <div className="mt-2 pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-emerald-400/90 font-mono">
                          <span className="truncate">Source: {msg.sourceBadge}</span>
                          <button
                            type="button"
                            onClick={() => speakText(msg.text, msg.language as any)}
                            className="ml-2 hover:text-emerald-300 inline-flex items-center gap-1 font-sans text-xs"
                            title="Listen to this advisory again"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Quick-Prompt Agronomic Chips */}
            <div className="mb-4">
              <div className="text-[11px] font-semibold tracking-wider text-white/50 uppercase mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Quick Agronomic Inquiries (Tap to Ask)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((item, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setSelectedLanguage(item.lang as any);
                      handleSendMessage(item.text);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 text-xs text-white/75 hover:text-white transition-all text-left flex items-center gap-1.5 group"
                  >
                    <span>{item.icon}</span>
                    <span className="group-hover:text-emerald-300">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input Box */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={
                  selectedLanguage === 'sw'
                    ? 'Uliza swali kuhusu kilimo, udongo, au hali ya hewa...'
                    : 'Ask about crop diagnosis, weather anomalies, or soil health...'
                }
                className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-white/[0.12] text-sm text-white placeholder-white/40 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all pr-24"
              />

              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  aria-label={isListening ? 'Stop recording voice' : 'Speak inquiry with microphone'}
                  className={`p-2 rounded-lg transition-all ${
                    isListening
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : 'hover:bg-white/10 text-white/60 hover:text-white'
                  }`}
                  title={isListening ? 'Stop recording' : 'Speak inquiry'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  aria-label="Send message"
                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition-all"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
