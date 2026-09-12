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
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import apiClient from '@/api/client';
import { EncryptedStorageService } from '@/services/encryptedStorageService';
import { fadeUp, stagger } from '../variants';

interface AgronomicEntitySlots {
  crop?: string | null;
  pest_disease?: string | null;
  field_size?: string | null;
  location_climate?: string | null;
  soil_profile?: string | null;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  language?: 'en' | 'sw';
  sourceBadge?: string;
  timestamp: string;
  citations?: Array<{ sourceId: string; title: string; category: string; excerpt: string; score: number }>;
}

interface SampleQuestion {
  icon: string;
  label: string;
  text: string;
  lang: 'en' | 'sw';
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const SAMPLE_QUESTIONS: SampleQuestion[] = [
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

const PRESET_ANSWERS: Record<
  string,
  { en: { text: string; source: string }; sw: { text: string; source: string } }
> = {
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

const CROP_MATCHERS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Maize', regex: /\b(maize|mahindi|corn)\b/i },
  { name: 'Cassava', regex: /\b(cassava|mhogo|mihogo)\b/i },
  { name: 'Tomato', regex: /\b(tomato|nyanya)\b/i },
  { name: 'Sorghum', regex: /\b(sorghum|mtama)\b/i },
  { name: 'Coffee', regex: /\b(coffee|kahawa)\b/i },
  { name: 'Wheat', regex: /\b(wheat|ngano)\b/i },
  { name: 'Rice', regex: /\b(rice|mchele|mpunga)\b/i },
  { name: 'Beans', regex: /\b(bean|beans|maharage)\b/i },
  { name: 'Potato', regex: /\b(potato|potatoes|viazi)\b/i },
];

const PEST_MATCHERS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Fall Armyworm', regex: /\b(armyworm|funza|caterpillar)\b/i },
  { name: 'Tomato Blight', regex: /\b(blight|ukungu)\b/i },
  { name: 'Aphids', regex: /\b(aphid|aphids|vidukari)\b/i },
  { name: 'Stem Borer', regex: /\b(stem\s*borer|mabua)\b/i },
  { name: 'Leaf Rust', regex: /\b(rust|kutu)\b/i },
];

function extractCropSlot(text: string): string | null {
  for (const item of CROP_MATCHERS) {
    if (item.regex.test(text)) {
      return item.name;
    }
  }
  return null;
}

function extractPestSlot(text: string): string | null {
  for (const item of PEST_MATCHERS) {
    if (item.regex.test(text)) {
      return item.name;
    }
  }
  return null;
}

function extractFieldSizeSlot(text: string): string | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(acres?|acre|hectares?|hectare|ha|ekari|hekta)/i);
  if (!match) return null;
  const num = match[1];
  const unit = match[2]?.toLowerCase() ?? 'acres';
  if (unit.startsWith('he') || unit === 'ha') {
    return `${num} hectares`;
  }
  return `${num} acres`;
}

function extractLocationSlot(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('rift valley')) return 'Rift Valley';
  if (lower.includes('nakuru')) return 'Nakuru';
  if (lower.includes('machakos')) return 'Machakos';
  if (lower.includes('uasin gishu')) return 'Uasin Gishu';
  if (lower.includes('semi-arid') || lower.includes('arid')) return 'Semi-Arid';
  if (lower.includes('high rainfall') || lower.includes('mvua nyingi')) return 'High Rainfall';
  return null;
}

function extractSoilSlot(text: string): string | null {
  const phMatch = text.match(/pH\s*(\d+(?:\.\d+)?)/i);
  if (phMatch) return `Acidic pH ${phMatch[1]}`;
  const lower = text.toLowerCase();
  if (lower.includes('sandy loam') || lower.includes('kichanga')) return 'Sandy Loam';
  if (lower.includes('clay') || lower.includes('mfinyanzi')) return 'Clay';
  if (lower.includes('acidic') || lower.includes('tindikali') || lower.includes('acid')) return 'Acidic Soil';
  return null;
}

function extractSlots(text: string, current: AgronomicEntitySlots): AgronomicEntitySlots {
  return {
    crop: extractCropSlot(text) ?? current.crop ?? null,
    pest_disease: extractPestSlot(text) ?? current.pest_disease ?? null,
    field_size: extractFieldSizeSlot(text) ?? current.field_size ?? null,
    location_climate: extractLocationSlot(text) ?? current.location_climate ?? null,
    soil_profile: extractSoilSlot(text) ?? current.soil_profile ?? null,
  };
}

interface LocalTurnResult {
  isMatch: boolean;
  text: string;
  source: string;
  updatedSlots: AgronomicEntitySlots;
}

function resolveArmywormDosage(
  slots: AgronomicEntitySlots,
  language: 'en' | 'sw'
): LocalTurnResult {
  const acresMatch = slots.field_size?.match(/(\d+(?:\.\d+)?)\s*acre/i);
  const acres = acresMatch ? parseFloat(acresMatch[1] ?? '3') : 3;
  const liters = (acres * 0.4).toFixed(1);
  const waterLiters = Math.round(acres * 133.3);

  if (language === 'sw') {
    return {
      isMatch: true,
      text: `Kwa ekari ${acres} za mahindi, changanya lita ${liters} za mafuta ya mwarobaini (Neem oil mililita 3 kwa lita ya maji katika lita ${waterLiters} za maji) na unyunyize moja kwa moja kwenye funeli za mahindi.`,
      source: 'FAO Fall Armyworm Management Guide & Dosage Calculations',
      updatedSlots: slots,
    };
  }

  return {
    isMatch: true,
    text: `For ${acres} acres of maize, mix ${liters} liters of Neem oil (at 3ml/L water rate across ${waterLiters}L total spray volume) applied directly into the central leaf whorls.`,
    source: 'FAO Fall Armyworm Management Guide & Dosage Calculations',
    updatedSlots: slots,
  };
}

function resolveLimeDosage(
  slots: AgronomicEntitySlots,
  language: 'en' | 'sw'
): LocalTurnResult {
  const haMatch = slots.field_size?.match(/(\d+(?:\.\d+)?)\s*hectare/i);
  const ha = haMatch ? parseFloat(haMatch[1] ?? '1') : 1;
  const minTonnes = (ha * 2.0).toFixed(1);
  const maxTonnes = (ha * 2.5).toFixed(1);

  if (language === 'sw') {
    return {
      isMatch: true,
      text: `Kwa hekta ${ha} za udongo wenye tindikali, weka tani ${minTonnes} hadi ${maxTonnes} za chokaa ya kilimo ikichanganywa na udongo wa juu siku 30 kabla ya kupanda.`,
      source: 'ISRIC SoilGrids & Lime Requirement Advisory',
      updatedSlots: slots,
    };
  }

  return {
    isMatch: true,
    text: `For ${ha} hectare(s) of acidic soil, apply ${minTonnes} to ${maxTonnes} tonnes of agricultural calcitic or dolomitic lime incorporated into the top 15cm of soil 30 days prior to planting.`,
    source: 'ISRIC SoilGrids & Lime Requirement Advisory',
    updatedSlots: slots,
  };
}

const DOSAGE_REGEX = /\b(dosage|rate|how much|kipimo|lita|dose)\b/i;
const ARMYWORM_REGEX = /\b(armyworm|funza|caterpillar|wadudu)\b/i;
const LIME_REGEX = /\b(lime|chokaa|acidic|acid|tindikali)\b/i;
const SOIL_REGEX = /\b(soil|udongo|ph)\b/i;
const WEATHER_REGEX = /\b(weather|satellite|nasa|rain|ukame|hewa)\b/i;
const SECURITY_REGEX = /\b(offline|wipe|security|hack|salama|siri)\b/i;
const LIME_AREA_REGEX = /\b(hectare|hectares|ha|hekta|acre|acres|ekari)\b/i;
const ARMYWORM_AREA_REGEX = /\b(acre|acres|ekari)\b/i;

function isLimeFollowUp(q: string, slots: AgronomicEntitySlots): boolean {
  const hasLimeContext = LIME_REGEX.test(q) || Boolean(slots.soil_profile?.toLowerCase().includes('acid'));
  const hasDosageOrArea = DOSAGE_REGEX.test(q) || LIME_AREA_REGEX.test(q);
  return hasLimeContext && hasDosageOrArea;
}

function isArmywormFollowUp(q: string, slots: AgronomicEntitySlots): boolean {
  // If query is specifically about lime or soil remediation, do not hijack with maize context
  if (LIME_REGEX.test(q) || SOIL_REGEX.test(q)) {
    return false;
  }
  const hasPestContext = slots.pest_disease === 'Fall Armyworm' || slots.crop === 'Maize';
  const hasDosageOrArea = DOSAGE_REGEX.test(q) || ARMYWORM_AREA_REGEX.test(q);
  return hasPestContext && hasDosageOrArea;
}

function resolveLocalAgronomicTurn(
  query: string,
  slots: AgronomicEntitySlots,
  language: 'en' | 'sw'
): LocalTurnResult {
  // 1. Check Lime/Soil Remediation follow-up first
  if (isLimeFollowUp(query, slots)) {
    return resolveLimeDosage(slots, language);
  }

  // 2. Check Fall Armyworm bio-control follow-up second
  if (isArmywormFollowUp(query, slots)) {
    return resolveArmywormDosage(slots, language);
  }

  // 3. Preset topics
  if (ARMYWORM_REGEX.test(query)) {
    const res = PRESET_ANSWERS.armyworm[language];
    return {
      isMatch: true,
      text: res.text,
      source: res.source,
      updatedSlots: { ...slots, crop: 'Maize', pest_disease: 'Fall Armyworm' },
    };
  }

  if (LIME_REGEX.test(query) || SOIL_REGEX.test(query)) {
    const res = PRESET_ANSWERS.soil[language];
    return {
      isMatch: true,
      text: res.text,
      source: res.source,
      updatedSlots: { ...slots, soil_profile: slots.soil_profile ?? 'Acidic pH 4.8' },
    };
  }

  if (WEATHER_REGEX.test(query)) {
    const res = PRESET_ANSWERS.weather[language];
    return { isMatch: true, text: res.text, source: res.source, updatedSlots: slots };
  }

  if (SECURITY_REGEX.test(query)) {
    const res = PRESET_ANSWERS.security[language];
    return { isMatch: true, text: res.text, source: res.source, updatedSlots: slots };
  }

  return { isMatch: false, text: '', source: '', updatedSlots: slots };
}

interface ApiAssistantResult {
  text: string;
  source: string;
  citations?: Array<{ sourceId: string; title: string; category: string; excerpt: string; score: number }>;
  entitySlots?: AgronomicEntitySlots;
}

async function fetchPublicDemoAdvisory(
  query: string,
  history: Message[],
  language: 'en' | 'sw',
  slots: AgronomicEntitySlots
): Promise<ApiAssistantResult> {
  try {
    const response = await apiClient.post('/chatbot/public-demo', {
      query,
      language,
      history: history.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      entitySlots: slots,
    });

    const data = response.data?.data;
    return {
      text: data?.text || PRESET_ANSWERS.default[language].text,
      source: data?.source || PRESET_ANSWERS.default[language].source,
      citations: data?.citations,
      entitySlots: data?.entitySlots,
    };
  } catch (err: unknown) {
    const error = err as { response?: { status?: number } };
    if (error.response?.status === 429) {
      return {
        text:
          language === 'sw'
            ? 'Umetumia kikomo cha maswali ya majaribio (maswali 10 kwa saa). Tafadhali fungua akaunti ya bure ili uendelee bila kikomo.'
            : 'Demo rate limit reached (10 queries/hour). Please sign up for a free account to unlock unlimited agronomic consultations.',
        source: 'Rate Limit (10 queries/hour)',
      };
    }
    return {
      text: PRESET_ANSWERS.default[language].text,
      source: PRESET_ANSWERS.default[language].source,
    };
  }
}

const SESSION_STORAGE_KEY = 'ag_ext_talking_session';
let sessionKey: CryptoKey | null = null;

async function persistSessionState(
  messages: Message[],
  entitySlots: AgronomicEntitySlots
): Promise<void> {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    if (!sessionKey) {
      sessionKey = await EncryptedStorageService.deriveKeyFromSecret('talking_assistant_public_2026');
    }
    const payload = JSON.stringify({ messages, entitySlots });
    const encrypted = await EncryptedStorageService.encrypt(payload, sessionKey);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, encrypted);
  } catch {
    // Non-fatal session storage fallback
    try {
      window.sessionStorage.setItem(
        `${SESSION_STORAGE_KEY}_raw`,
        JSON.stringify({ messages, entitySlots })
      );
    } catch {
      // ignore
    }
  }
}

interface UseSpeechControllerProps {
  selectedLanguage: 'en' | 'sw';
  onTranscript: (transcript: string) => void;
}

function useSpeechController({ selectedLanguage, onTranscript }: UseSpeechControllerProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

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

        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

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

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

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

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          onTranscript(transcript);
        }
      };
      recognition.onerror = (event: { error: string }) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  }, [isSpeaking, onTranscript, selectedLanguage, stopSpeaking]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSpeaking,
    speakText,
    stopSpeaking,
    toggleListening,
  };
}

interface LanguageSelectorProps {
  selectedLanguage: 'en' | 'sw';
  onSelectLanguage: (lang: 'en' | 'sw') => void;
}

function LanguageSelector({ selectedLanguage, onSelectLanguage }: LanguageSelectorProps) {
  return (
    <div className="w-full flex items-center justify-between gap-2 mb-6">
      <div className="flex items-center gap-2 text-xs font-medium text-white/70">
        <Globe className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-mono uppercase tracking-wider">Voice Language</span>
      </div>
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950/70 border border-white/[0.08]">
        <button
          type="button"
          onClick={() => onSelectLanguage('en')}
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
          onClick={() => onSelectLanguage('sw')}
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
  );
}

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  onToggle: () => void;
}

function VoiceOrb({ isListening, isSpeaking, onToggle }: VoiceOrbProps) {
  const getOrbStyle = () => {
    if (isListening) {
      return 'bg-amber-500 text-slate-950 ring-amber-400/40 shadow-amber-500/50 scale-105';
    }
    if (isSpeaking) {
      return 'bg-emerald-500 text-slate-950 ring-emerald-400/40 shadow-emerald-500/50';
    }
    return 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white hover:scale-105 hover:shadow-emerald-500/30';
  };

  const getAriaLabel = () => {
    if (isListening) return 'Stop recording voice';
    if (isSpeaking) return 'Speaking response';
    return 'Start speaking voice inquiry';
  };

  return (
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
        onClick={onToggle}
        aria-label={getAriaLabel()}
        className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl focus:outline-none focus:ring-4 ${getOrbStyle()}`}
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
  );
}

interface WaveformProps {
  isListening: boolean;
  isSpeaking: boolean;
}

const BAR_HEIGHTS = [40, 70, 100, 60, 85, 45, 95, 60, 80, 50, 90, 65];

function Waveform({ isListening, isSpeaking }: WaveformProps) {
  const active = isListening || isSpeaking;
  const barColor = isListening ? 'bg-amber-400' : isSpeaking ? 'bg-emerald-400' : 'bg-white/15';

  return (
    <div className="h-8 flex items-center justify-center gap-1 my-2">
      {BAR_HEIGHTS.map((h, i) => (
        <motion.div
          key={i}
          animate={active ? { height: [8, (h * 32) / 100, 8] } : { height: 4 }}
          transition={
            active
              ? { duration: 0.8 + (i % 4) * 0.15, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 }
          }
          className={`w-1 rounded-full transition-colors ${barColor}`}
        />
      ))}
    </div>
  );
}

interface AudioControlsProps {
  autoSpeak: boolean;
  isSpeaking: boolean;
  onToggleAutoSpeak: () => void;
  onStopSpeaking: () => void;
}

function AudioControls({
  autoSpeak,
  isSpeaking,
  onToggleAutoSpeak,
  onStopSpeaking,
}: AudioControlsProps) {
  return (
    <div className="w-full mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs text-white/70">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleAutoSpeak}
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
          onClick={onStopSpeaking}
          className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-[11px] font-semibold"
        >
          Stop Audio
        </button>
      )}
    </div>
  );
}

interface ActiveContextBannerProps {
  slots: AgronomicEntitySlots;
  onClear: () => void;
}

function ActiveContextBanner({ slots, onClear }: ActiveContextBannerProps) {
  const activeEntries = Object.entries(slots).filter(([_, v]) => Boolean(v));
  if (activeEntries.length === 0) return null;

  return (
    <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[10px]">
          Active Context:
        </span>
        {slots.crop && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
            🌱 {slots.crop}
          </span>
        )}
        {slots.pest_disease && (
          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
            🐛 {slots.pest_disease}
          </span>
        )}
        {slots.field_size && (
          <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25">
            📐 {slots.field_size}
          </span>
        )}
        {slots.soil_profile && (
          <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25">
            🧪 {slots.soil_profile}
          </span>
        )}
        {slots.location_climate && (
          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
            📍 {slots.location_climate}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-white/50 hover:text-white inline-flex items-center gap-1 text-[11px] shrink-0"
        title="Reset conversation context"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Reset</span>
      </button>
    </div>
  );
}

interface HandoffCardProps {
  onHandoff: () => void;
}

function HandoffCard({ onHandoff }: HandoffCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 p-3 rounded-xl bg-gradient-to-r from-emerald-900/40 via-slate-900/80 to-teal-900/40 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-lg"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <p className="font-semibold text-white">Save this Diagnostic Advisory</p>
          <p className="text-white/60 text-[11px]">
            Generate an official Field Visit Report and persist your consultation history.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onHandoff}
        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all flex items-center gap-1 shrink-0 shadow-md"
      >
        <span>Sign up free</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

interface ChatMessageProps {
  msg: Message;
  onSpeak: (text: string, lang: 'en' | 'sw') => void;
}

function ChatMessage({ msg, onSpeak }: ChatMessageProps) {
  const isUser = msg.sender === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isUser
            ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-300'
            : 'bg-teal-500/20 border border-teal-500/30 text-teal-300'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
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
              onClick={() => onSpeak(msg.text, msg.language ?? 'en')}
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
  );
}

interface QuestionChipsProps {
  onSelect: (item: SampleQuestion) => void;
}

function QuestionChips({ onSelect }: QuestionChipsProps) {
  return (
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
            onClick={() => onSelect(item)}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 text-xs text-white/75 hover:text-white transition-all text-left flex items-center gap-1.5 group"
          >
            <span>{item.icon}</span>
            <span className="group-hover:text-emerald-300">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChatInputFormProps {
  inputText: string;
  isListening: boolean;
  isLoading: boolean;
  selectedLanguage: 'en' | 'sw';
  onChangeInput: (val: string) => void;
  onSubmit: () => void;
  onToggleListening: () => void;
}

function ChatInputForm({
  inputText,
  isListening,
  isLoading,
  selectedLanguage,
  onChangeInput,
  onSubmit,
  onToggleListening,
}: ChatInputFormProps) {
  const placeholder =
    selectedLanguage === 'sw'
      ? 'Uliza swali kuhusu kilimo, udongo, au hali ya hewa...'
      : 'Ask about crop diagnosis, weather anomalies, or soil health...';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative flex items-center gap-2"
    >
      <input
        type="text"
        value={inputText}
        disabled={isLoading}
        onChange={(e) => onChangeInput(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-white/[0.12] text-sm text-white placeholder-white/40 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all pr-24 disabled:opacity-50"
      />

      <div className="absolute right-2 flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleListening}
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
          disabled={!inputText.trim() || isLoading}
          aria-label="Send message"
          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition-all"
          title="Send message"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
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
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'sw'>('en');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [entitySlots, setEntitySlots] = useState<AgronomicEntitySlots>({
    crop: null,
    pest_disease: null,
    field_size: null,
    location_climate: null,
    soil_profile: null,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDispatchAssistantTurn = useCallback(
    async (
      query: string,
      lang: 'en' | 'sw',
      activeSlots: AgronomicEntitySlots,
      speakFn: (t: string, l: 'en' | 'sw') => void
    ) => {
      // 1. Check local edge preset / follow-up rules (0ms latency)
      const local = resolveLocalAgronomicTurn(query, activeSlots, lang);
      if (local.isMatch) {
        setTimeout(() => {
          const assistantMsg: Message = {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: local.text,
            language: lang,
            sourceBadge: local.source,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          setEntitySlots(local.updatedSlots);
          setMessages((prev) => {
            const next = [...prev, assistantMsg];
            void persistSessionState(next, local.updatedSlots);
            return next;
          });

          if (autoSpeak) {
            speakFn(local.text, lang);
          }
        }, 300);
        return;
      }

      // 2. Call dynamic public demo API
      setIsLoading(true);
      const apiResult = await fetchPublicDemoAdvisory(query, messages, lang, activeSlots);
      setIsLoading(false);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: apiResult.text,
        language: lang,
        sourceBadge: apiResult.source,
        citations: apiResult.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const updated = apiResult.entitySlots ?? activeSlots;
      setEntitySlots(updated);
      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        void persistSessionState(next, updated);
        return next;
      });

      if (autoSpeak) {
        speakFn(apiResult.text, lang);
      }
    },
    [autoSpeak, messages]
  );

  const handleSendMessageRef = useRef<(textToSend?: string) => void>(() => {});

  const { isListening, isSpeaking, speakText, stopSpeaking, toggleListening } =
    useSpeechController({
      selectedLanguage,
      onTranscript: (transcript: string) => handleSendMessageRef.current(transcript),
    });

  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const query = (textToSend || inputText).trim();
      if (!query || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: query,
        language: selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const updatedSlots = extractSlots(query, entitySlots);
      setEntitySlots(updatedSlots);

      setMessages((prev) => {
        const next = [...prev, userMsg];
        void persistSessionState(next, updatedSlots);
        return next;
      });

      setInputText('');
      void handleDispatchAssistantTurn(query, selectedLanguage, updatedSlots, speakText);
    },
    [entitySlots, handleDispatchAssistantTurn, inputText, isLoading, selectedLanguage, speakText]
  );

  handleSendMessageRef.current = handleSendMessage;

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSelectPrompt = useCallback(
    (item: SampleQuestion) => {
      setSelectedLanguage(item.lang);
      handleSendMessage(item.text);
    },
    [handleSendMessage]
  );

  const handleClearContext = useCallback(() => {
    setEntitySlots({
      crop: null,
      pest_disease: null,
      field_size: null,
      location_climate: null,
      soil_profile: null,
    });
  }, []);

  const handleHandoff = useCallback(() => {
    window.location.href = '/register';
  }, []);

  const userTurnCount = messages.filter((m) => m.sender === 'user').length;
  const showHandoff = userTurnCount >= 2;

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
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onSelectLanguage={setSelectedLanguage}
            />

            <VoiceOrb
              isListening={isListening}
              isSpeaking={isSpeaking}
              onToggle={toggleListening}
            />

            <Waveform isListening={isListening} isSpeaking={isSpeaking} />

            <AudioControls
              autoSpeak={autoSpeak}
              isSpeaking={isSpeaking}
              onToggleAutoSpeak={() => setAutoSpeak((prev) => !prev)}
              onStopSpeaking={stopSpeaking}
            />
          </div>

          {/* Right Column: Interactive Chat & Context Tracking */}
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-white/[0.08] backdrop-blur-xl flex flex-col justify-between shadow-2xl shadow-black/60">
            <div>
              <ActiveContextBanner slots={entitySlots} onClear={handleClearContext} />

              <div className="space-y-4 max-h-[340px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-white/10">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <ChatMessage key={msg.id} msg={msg} onSpeak={speakText} />
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 py-1 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Agronomic Engine consulting knowledge base...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {showHandoff && <HandoffCard onHandoff={handleHandoff} />}
            </div>

            <div>
              <QuestionChips onSelect={handleSelectPrompt} />

              <ChatInputForm
                inputText={inputText}
                isListening={isListening}
                isLoading={isLoading}
                selectedLanguage={selectedLanguage}
                onChangeInput={setInputText}
                onSubmit={handleSendMessage}
                onToggleListening={toggleListening}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
