import React, { useState, useEffect, useMemo, useRef } from 'react';
import { synthesizeVisit, type BoxUpdateData } from '@/api/aiService';
import { createVisit } from '@/api/visitService';
import { fetchFarmers, type Farmer } from '@/api/farmerService';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode, DEMO_FARMERS } from '@/demo';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import {
  Sparkles,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Mic,
  Radio,
  Leaf,
  Layers,
  ArrowRight,
  BookmarkPlus,
  UserCheck,
  Search,
  Check,
  ChevronDown,
  MapPin,
  Phone,
  UploadCloud,
  AudioLines,
  Square,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { AntiFraudVerificationBadge } from '@/components/AntiFraudVerificationBadge';

const FIELD_PRESETS = [
  {
    title: 'Fall Armyworm Infestation',
    icon: '🐛',
    text: 'Inspected 3-hectare maize plot. Severe whorl damage observed on 35% of crops at V4 vegetative stage. Characteristic windowpane feeding signs and sawdust-like frass detected. Recommended immediate biological spraying (Emamectin benzoate) and pheromone trap deployment.',
  },
  {
    title: 'Late Blight & Soil Acidity',
    icon: '🍂',
    text: 'Visited potato field in highland parcel. Water-soaked dark lesions on lower leaves with white fungal growth on undersides. Soil pH tested at 5.2 (acidic). Prescribed copper hydroxide fungicide application and agricultural lime top-dressing.',
  },
  {
    title: 'Moisture Stress & Stunting',
    icon: '💧',
    text: 'Field inspection of smallholder sorghum plot. Crops showing marked wilting and nitrogen deficiency yellowing due to 18-day dry spell. Advised organic mulching to conserve root zone moisture and scheduled foliar fertilizer application once rains resume.',
  },
];

const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  sw: 'sw-KE',
  fr: 'fr-FR',
  pt: 'pt-BR',
  es: 'es-ES',
  ar: 'ar-SA',
  hi: 'hi-IN',
  zh: 'zh-CN',
  ru: 'ru-RU',
  de: 'de-DE',
  it: 'it-IT',
};

function filterFarmersList(farmers: Farmer[], query: string): Farmer[] {
  if (!query.trim()) return farmers;
  const q = query.toLowerCase();
  return farmers.filter(
    f =>
      f.firstName?.toLowerCase().includes(q) ||
      f.lastName?.toLowerCase().includes(q) ||
      f.village?.toLowerCase().includes(q) ||
      f.phone?.toLowerCase().includes(q) ||
      f.region?.toLowerCase().includes(q)
  );
}

function formatSecondsToMMSS(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remainingSecs = sec % 60;
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'good':
      return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    case 'fair':
      return 'text-sky-400 border-sky-500/30 bg-sky-500/10';
    case 'poor':
      return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    case 'diseased':
      return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
    default:
      return 'text-slate-400 border-white/10 bg-white/5';
  }
}

function buildVisitSynthesisNotes(result: BoxUpdateData, isFraudVerified: boolean): string {
  return `[AI Synthesis Diagnosis]\nSummary: ${result.summary}\nCrop Health: ${result.cropHealthStatus.toUpperCase()}\nPest Issues: ${result.pestIssues}\n\nKey Observations:\n- ${result.keyObservations.join('\n- ')}\n\nRecommended Actions:\n- ${result.recommendedActions.join('\n- ')}\n\nFollow-up Required: ${result.followUpRequired ? 'YES' : 'NO'} (${result.nextVisitDateHint})\nAnti-Fraud Verification: ${isFraudVerified ? 'GPS VERIFIED' : 'PENDING'}`;
}

interface FarmerSelectorCardProps {
  selectedFarmer: Farmer | null;
  filteredFarmers: Farmer[];
  farmerSearch: string;
  isDropdownOpen: boolean;
  isLoadingFarmers: boolean;
  onSelectFarmer: (f: Farmer) => void;
  onSearchChange: (search: string) => void;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
}

const FarmerSelectorCard: React.FC<FarmerSelectorCardProps> = ({
  selectedFarmer,
  filteredFarmers,
  farmerSearch,
  isDropdownOpen,
  isLoadingFarmers,
  onSelectFarmer,
  onSearchChange,
  onToggleDropdown,
  onCloseDropdown,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onCloseDropdown();
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, onCloseDropdown]);

  return (
    <div
      ref={containerRef}
      className={`backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-5 shadow-xl space-y-3 relative transition-all duration-200 ${
        isDropdownOpen ? 'z-40' : 'z-10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-purple-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Target Farmer Parcel
          </h2>
        </div>
        {selectedFarmer && (
          <span className="text-xxs text-emerald-400 font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" /> Farmer Linked
          </span>
        )}
      </div>

      <div className="relative">
        <div
          onClick={onToggleDropdown}
          className="w-full p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer flex items-center justify-between transition-all"
        >
          {selectedFarmer ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                {selectedFarmer.firstName?.[0]}
                {selectedFarmer.lastName?.[0]}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {selectedFarmer.firstName} {selectedFarmer.lastName}
                </div>
                <div className="text-xs text-white/50 flex items-center gap-3 mt-0.5">
                  {selectedFarmer.village && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-purple-400" /> {selectedFarmer.village}
                    </span>
                  )}
                  {selectedFarmer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-white/40" /> {selectedFarmer.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-white/40">
              {isLoadingFarmers ? 'Loading registered farmers...' : 'Select a registered farmer...'}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-900/95 border border-purple-500/30 rounded-xl shadow-2xl backdrop-blur-2xl p-2 max-h-60 overflow-y-auto">
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
              <input
                type="text"
                value={farmerSearch}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search farmer by name, village, or phone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 outline-none focus:border-purple-400"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="space-y-1">
              {filteredFarmers.map(f => (
                <div
                  key={f.id}
                  onClick={() => onSelectFarmer(f)}
                  className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-all ${
                    selectedFarmer?.id === f.id ? 'bg-purple-500/20 text-white font-semibold' : 'text-white/80 hover:bg-white/[0.05]'
                  }`}
                >
                  <div>
                    <div>{f.firstName} {f.lastName}</div>
                    <div className="text-xxs text-white/40">{f.village || f.region || 'Registered Farmer'}</div>
                  </div>
                  {selectedFarmer?.id === f.id && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </div>
              ))}
              {filteredFarmers.length === 0 && (
                <div className="text-center py-3 text-xs text-white/40">No matching farmers found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface SynthesisResultsBentoProps {
  result: BoxUpdateData;
  selectedFarmer: Farmer | null;
  isSaving: boolean;
  onSaveRecords: () => void;
}

const SynthesisResultsBento: React.FC<SynthesisResultsBentoProps> = ({
  result,
  selectedFarmer,
  isSaving,
  onSaveRecords,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      {/* Bento Card 1: Diagnostic Summary & Pathology */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Diagnostic Executive Summary
              </h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusBadgeClass(result.cropHealthStatus)}`}>
              {result.cropHealthStatus}
            </span>
          </div>

          <p className="text-sm text-white/80 leading-relaxed font-normal p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            {result.summary}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-xxs font-bold text-white/40 uppercase tracking-wider">
                Follow-up Required
              </span>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${result.followUpRequired ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span>{result.followUpRequired ? 'Yes (Urgent)' : 'No (Routine)'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-xxs font-bold text-white/40 uppercase tracking-wider">
                Next Field Visit Hint
              </span>
              <div className="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>{result.nextVisitDateHint || '7–10 days'}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <span className="text-xxs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Pest & Disease Stress Index
            </span>
            <p className="text-xs font-medium text-amber-200/90">{result.pestIssues}</p>
          </div>
        </div>
      </div>

      {/* Bento Card 2: Key Observations & Action Itinerary */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Observations & Recommendations
            </h3>
          </div>

          <div>
            <h4 className="text-xxs font-bold text-white/40 uppercase tracking-wider mb-2">
              Key Agronomic Observations
            </h4>
            <ul className="space-y-1.5">
              {result.keyObservations.map((obs, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/80">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xxs font-bold text-white/40 uppercase tracking-wider mb-2">
              Prescribed Treatment Protocol
            </h4>
            <ul className="space-y-1.5">
              {result.recommendedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/80">
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 1-Click Save Action */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
          <span className="text-xxs text-white/40">
            Logs synthesis to {selectedFarmer ? `${selectedFarmer.firstName}'s` : 'farmer'} record.
          </span>
          <button
            onClick={onSaveRecords}
            disabled={isSaving || !selectedFarmer}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Logging Visit...' : 'Save Visit Synthesis'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const VisitSynthesisForm: React.FC = () => {
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<BoxUpdateData | null>(null);

  // Farmer selection state
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingFarmers, setIsLoadingFarmers] = useState(false);

  // Anti-fraud verification tracking
  const [isFraudVerified, setIsFraudVerified] = useState(false);
  const [visitSessionId] = useState(() => `synth-${Date.now()}`);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setLoading } = useAppStore();
  const { language, t } = useLanguage();
  const { isDemo } = useDemoMode();

  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    interimText,
    toggleRecording,
    uploadAudioFile,
  } = useFieldVoiceRecorder({
    language,
    onTranscriptChunk: chunk => {
      setNotes(prev => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk));
    },
  });

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAudioFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadFarmers = async () => {
      if (isDemo) {
        setFarmers(DEMO_FARMERS as unknown as Farmer[]);
        setSelectedFarmer(prev => prev ?? (DEMO_FARMERS[0] as unknown as Farmer));
        return;
      }

      setIsLoadingFarmers(true);
      try {
        const res = await fetchFarmers();
        if (isMounted && res.success && res.data?.farmers) {
          setFarmers(res.data.farmers);
          setSelectedFarmer(prev => prev ?? res.data.farmers[0] ?? null);
        }
      } catch (err) {
        console.error('Failed to load farmers list:', err);
      } finally {
        if (isMounted) setIsLoadingFarmers(false);
      }
    };

    loadFarmers();
    return () => {
      isMounted = false;
    };
  }, [isDemo]);

  const filteredFarmers = useMemo(() => filterFarmersList(farmers, farmerSearch), [farmers, farmerSearch]);

  const handleSynthesize = async () => {
    if (notes.trim().length < 10) {
      toast.error(t('common_error') + ': Please enter more detailed notes (min 10 chars)');
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    try {
      const res = await synthesizeVisit(notes, selectedFarmer?.id);
      if (res.success && res.data) {
        setResult(res.data);
        toast.success(t('visit_synthesis_success') || 'Visit observations synthesized successfully!');
      } else {
        toast.error(t('visit_synthesis_error') || 'Synthesis failed');
      }
    } catch (error) {
      toast.error(t('visit_synthesis_error') || 'Synthesis failed');
      console.error('Synthesis error:', error);
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  };

  const handleSaveRecords = async () => {
    if (!result) return;

    if (!selectedFarmer) {
      toast.error('Please select a registered farmer for this visit record.');
      return;
    }

    setIsSaving(true);
    try {
      const visitPayload = {
        farmer_id: selectedFarmer.id,
        farmer_name: `${selectedFarmer.firstName} ${selectedFarmer.lastName}`,
        visit_type: 'ai_synthesis',
        status: 'completed',
        scheduled_at: new Date().toISOString(),
        notes: buildVisitSynthesisNotes(result, isFraudVerified),
      };

      const res = await createVisit(visitPayload);
      if (res.success) {
        toast.success(`Visit report saved for ${selectedFarmer.firstName} ${selectedFarmer.lastName}!`);
      } else {
        toast.error('Failed to save report to visits.');
      }
    } catch (error) {
      console.error('Failed to save records:', error);
      toast.error('Failed to save records. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header Telemetry & Preset Hub ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-950/40">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">Visit Synthesis</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  <Radio className="w-2.5 h-2.5 text-purple-400 animate-pulse" />
                  AI Field Copilot Active
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Convert unorganized voice dictation and field notes into structured agronomic diagnoses, pest indices, and follow-up itineraries.
              </p>
            </div>
          </div>

          {/* Quick-Preset Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xxs font-semibold text-white/40 uppercase tracking-wider">Presets:</span>
            {FIELD_PRESETS.map(p => (
              <button
                key={p.title}
                type="button"
                onClick={() => {
                  setNotes(p.text);
                  toast.success(`Observation "${p.title}" loaded!`);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/15 border border-white/10 hover:border-purple-500/30 text-xs text-white/80 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>{p.icon}</span>
                <span className="font-medium">{p.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Farmer Selection Card ── */}
      <FarmerSelectorCard
        selectedFarmer={selectedFarmer}
        filteredFarmers={filteredFarmers}
        farmerSearch={farmerSearch}
        isDropdownOpen={isDropdownOpen}
        isLoadingFarmers={isLoadingFarmers}
        onSelectFarmer={f => {
          setSelectedFarmer(f);
          setIsDropdownOpen(false);
          setIsFraudVerified(false);
        }}
        onSearchChange={setFarmerSearch}
        onToggleDropdown={() => setIsDropdownOpen(!isDropdownOpen)}
        onCloseDropdown={() => setIsDropdownOpen(false)}
      />

      {/* ── Input Terminal Card ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Field Observation Notes
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Hidden audio file upload input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAudioFileUpload}
              accept="audio/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecording || isTranscribing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/10 transition-all disabled:opacity-50"
              title="Upload field voice note (.mp3, .wav, .m4a, .ogg, .webm)"
            >
              <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isTranscribing ? 'Transcribing...' : 'Upload Voice Memo'}</span>
            </button>

            <button
              type="button"
              onClick={toggleRecording}
              disabled={isTranscribing}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all border ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border-purple-500/30'
              }`}
            >
              {isRecording ? <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" /> : <Mic className="w-3.5 h-3.5 text-purple-400" />}
              <span>{isRecording ? `Stop Recording (${formatSecondsToMMSS(recordingDuration)})` : `Live Dictate (${SPEECH_LANG_MAP[language]?.slice(0, 2).toUpperCase() || 'EN'})`}</span>
            </button>
          </div>
        </div>

        {/* Live Audio Streaming Feedback */}
        {isRecording && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-300 animate-pulse">
            <div className="flex items-center gap-2">
              <AudioLines className="w-4 h-4 text-rose-400" />
              <span>
                {interimText ? `"${interimText}..."` : 'Listening for field observations (Noise suppression active)...'}
              </span>
            </div>
            <span className="font-mono font-bold text-xs">{formatSecondsToMMSS(recordingDuration)}</span>
          </div>
        )}

        <div className="relative">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Type, live dictate, or upload field voice notes... (e.g. Inspected 2-acre plot in Rongai. Severe leaf yellowing with late blight lesions on lower leaves, soil moisture depleted, advised copper fungicide spraying and scheduled follow-up inspection in 10 days)"
            className="w-full min-h-[160px] p-4 rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-white/25 focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all resize-none text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <span className="text-xxs text-white/40">
            Min 10 characters required for multi-factor agronomic decomposition.
          </span>
          <button
            onClick={handleSynthesize}
            disabled={isProcessing || notes.trim().length < 10}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-xl shadow-purple-950/40 transition-all flex items-center justify-center gap-2 text-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synthesizing Pathology & Telemetry...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Synthesize Agronomic Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Zero-Trust Anti-Fraud Verification Badge ── */}
      {selectedFarmer ? (
        <AntiFraudVerificationBadge
          farmerId={selectedFarmer.id}
          farmerName={`${selectedFarmer.firstName} ${selectedFarmer.lastName}`}
          farmerLat={selectedFarmer.locationLat}
          farmerLng={selectedFarmer.locationLng}
          visitId={visitSessionId}
          onVerificationComplete={verified => setIsFraudVerified(verified)}
        />
      ) : (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 text-center text-xs text-white/50 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-purple-400" />
          <span>Select a registered farmer above to activate zero-trust GPS and biometric parcel verification.</span>
        </div>
      )}

      {/* ── Synthesis Key-Findings Bento Grid ── */}
      <AnimatePresence>
        {result && (
          <SynthesisResultsBento
            result={result}
            selectedFarmer={selectedFarmer}
            isSaving={isSaving}
            onSaveRecords={handleSaveRecords}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisitSynthesisForm;
