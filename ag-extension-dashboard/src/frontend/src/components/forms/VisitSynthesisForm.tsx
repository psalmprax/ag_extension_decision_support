import React, { useState, useEffect, useMemo, useRef } from 'react';
import { synthesizeVisit, type BoxUpdateData } from '@/api/aiService';
import { createVisit } from '@/api/visitService';
import { fetchFarmers, type Farmer } from '@/api/farmerService';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode, DEMO_FARMERS } from '@/demo';
import { useFieldVoiceRecorder } from '@/hooks/useFieldVoiceRecorder';
import { voiceMessages } from '@/hooks/voiceMessages';
import {
  FileCheck,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Mic,
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
    title: 'Fall armyworm infestation',
    text: 'Inspected 3-hectare maize plot. Severe whorl damage observed on 35% of crops at V4 vegetative stage. Characteristic windowpane feeding signs and sawdust-like frass detected. Recommended pheromone traps, Bt or neem on young larvae, and a registered insecticide only if damage passes the national action threshold.',
  },
  {
    title: 'Late blight & soil acidity',
    text: 'Visited potato field in highland parcel. Water-soaked dark lesions on lower leaves with white fungal growth on undersides. Soil pH tested at 5.2 (acidic). Prescribed copper hydroxide fungicide application and agricultural lime top-dressing.',
  },
  {
    title: 'Moisture stress & stunting',
    text: 'Field inspection of smallholder sorghum plot. Crops showing marked wilting and nitrogen deficiency yellowing due to 18-day dry spell. Advised organic mulching to conserve root zone moisture and scheduled foliar fertilizer application once rains resume.',
  },
];

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
      return 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    case 'fair':
      return 'text-slate-600 dark:text-theme-text-muted border-slate-500/30 bg-slate-500/10';
    case 'poor':
      return 'text-amber-800 dark:text-amber-300 border-amber-500/30 bg-amber-500/10';
    case 'diseased':
      return 'text-rose-700 dark:text-rose-400 border-rose-500/30 bg-rose-500/10';
    default:
      return 'text-slate-600 dark:text-theme-text-muted border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04]';
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
  const { t } = useLanguage();
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
      className={`backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-5 shadow-xl space-y-3 relative transition-all duration-200 ${
        isDropdownOpen ? 'z-40' : 'z-10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <h2 className="text-xs font-medium text-slate-900 dark:text-theme-text-primary">
            {t('ui_visit_synthesis_form_target_farmer_parcel')}
          </h2>
        </div>
        {selectedFarmer && (
          <span className="text-xxs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> {t('ui_visit_synthesis_form_farmer_linked')}
          </span>
        )}
      </div>

      <div className="relative">
        <div
          onClick={onToggleDropdown}
          className="w-full p-3 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] hover:bg-white/[0.05] cursor-pointer flex items-center justify-between transition-colors"
        >
          {selectedFarmer ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-medium text-xs">
                {selectedFarmer.firstName?.[0]}
                {selectedFarmer.lastName?.[0]}
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
                  {selectedFarmer.firstName} {selectedFarmer.lastName}
                </div>
                <div className="text-xs text-slate-600 dark:text-theme-text-muted flex items-center gap-3 mt-0.5">
                  {selectedFarmer.village && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-600 dark:text-theme-text-muted" /> {selectedFarmer.village}
                    </span>
                  )}
                  {selectedFarmer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-600 dark:text-theme-text-muted" /> {selectedFarmer.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-slate-600 dark:text-theme-text-muted">
              {isLoadingFarmers ? 'Loading registered farmers...' : 'Select a registered farmer...'}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-theme-text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {isDropdownOpen && (
          <div className="absolute top-full start-0 end-0 mt-2 z-50 bg-slate-50 dark:bg-theme-bg-secondary border border-slate-500/30 rounded-xl shadow-2xl backdrop-blur-2xl p-2 max-h-60 overflow-y-auto">
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-600 dark:text-theme-text-muted absolute start-3 top-2.5" />
              <input
                type="text"
                value={farmerSearch}
                onChange={e => onSearchChange(e.target.value)}
                placeholder="Search farmer by name, village, or phone..."
                className="w-full ps-8 pe-3 py-1.5 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-900 dark:text-theme-text-primary placeholder-white/30 outline-none focus:border-slate-400"
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="space-y-1">
              {filteredFarmers.map(f => (
                <div
                  key={f.id}
                  onClick={() => onSelectFarmer(f)}
                  className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-all ${
                    selectedFarmer?.id === f.id ? 'bg-slate-500/20 text-white font-medium' : 'text-white/80 hover:bg-white/[0.05]'
                  }`}
                >
                  <div>
                    <div>{f.firstName} {f.lastName}</div>
                    <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{f.village || f.region || 'Registered Farmer'}</div>
                  </div>
                  {selectedFarmer?.id === f.id && <Check className="w-3.5 h-3.5 text-slate-600 dark:text-theme-text-muted" />}
                </div>
              ))}
              {filteredFarmers.length === 0 && (
                <div className="text-center py-3 text-xs text-slate-600 dark:text-theme-text-muted">{t('ui_visit_synthesis_form_no_matching_farmers_found')}</div>
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
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      {/* Bento Card 1: Diagnostic Summary & Pathology */}
      <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h3 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
                {t('ui_visit_synthesis_form_diagnostic_executive_summary')}
              </h3>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadgeClass(result.cropHealthStatus)}`}>
              {result.cropHealthStatus}
            </span>
          </div>

          <p className="text-sm text-slate-700 dark:text-theme-text-secondary leading-relaxed font-normal p-3.5 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
            {result.summary}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-theme-text-muted">
                {t('ui_visit_synthesis_form_follow_up_required')}
              </span>
              <div className="text-sm font-medium text-slate-900 dark:text-theme-text-primary flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${result.followUpRequired ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                <span>{result.followUpRequired ? 'Yes (Urgent)' : 'No (Routine)'}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-theme-text-muted">
                {t('ui_visit_synthesis_form_next_visit_hint')}
              </span>
              <div className="text-sm font-medium text-slate-700 dark:text-theme-text-secondary flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-600 dark:text-theme-text-muted" />
                <span>{result.nextVisitDateHint || '7–10 days'}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('ui_visit_synthesis_form_pest_disease_stress_index')}
            </span>
            <p className="text-xs font-medium text-amber-200/90">{result.pestIssues}</p>
          </div>
        </div>
      </div>

      {/* Bento Card 2: Key Observations & Action Itinerary */}
      <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
            <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h3 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
              {t('ui_visit_synthesis_form_observations_recommendations')}
            </h3>
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-600 dark:text-theme-text-muted mb-2">
              {t('ui_visit_synthesis_form_key_agronomic_observations')}
            </h4>
            <ul className="space-y-1.5">
              {result.keyObservations.map((obs, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-theme-text-secondary">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium text-slate-600 dark:text-theme-text-muted mb-2">
              {t('ui_visit_synthesis_form_prescribed_treatment_protocol')}
            </h4>
            <ul className="space-y-1.5">
              {result.recommendedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-theme-text-secondary">
                  <ArrowRight className="w-3.5 h-3.5 text-amber-800 dark:text-amber-300 mt-0.5 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 1-Click Save Action */}
        <div className="pt-4 border-t border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-4">
          <span className="text-xxs text-slate-600 dark:text-theme-text-muted">
            {t('ui_visit_synthesis_form_logs_synthesis_to')} {selectedFarmer ? `${selectedFarmer.firstName}'s` : 'farmer'} {t('ui_visit_synthesis_form_record')}
          </span>
          <button
            onClick={onSaveRecords}
            disabled={isSaving || !selectedFarmer}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Logging Visit...' : 'Save visit synthesis'}</span>
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
    messages: voiceMessages(t),
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
      } else if (res.error?.includes('security filter')) {
        toast.error('Request blocked by security filter — your dictation included a phrase flagged as a potential prompt injection. Please rephrase and try again.');
      } else {
        toast.error(t('visit_synthesis_error') || 'Synthesis failed');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      if (err.response?.data?.error?.includes('security filter')) {
        toast.error('Request blocked by security filter — your dictation included a phrase flagged as a potential prompt injection. Please rephrase and try again.');
      } else {
        toast.error(t('visit_synthesis_error') || 'Synthesis failed');
      }
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
      <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-900 dark:text-theme-text-primary">{t('nav_visit_synthesis')}</h1>
              </div>
              <p className="text-xs text-slate-600 dark:text-theme-text-muted mt-0.5">
                {t('ui_visit_synthesis_form_convert_unorganized_voice_dictation')}
              </p>
            </div>
          </div>

          {/* Quick-Preset Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-600 dark:text-theme-text-muted">{t('ui_visit_synthesis_form_presets')}</span>
            {FIELD_PRESETS.map(p => (
              <button
                key={p.title}
                type="button"
                onClick={() => {
                  setNotes(p.text);
                  toast.success(`Observation "${p.title}" loaded!`);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] hover:bg-emerald-500/15 border border-slate-900/[0.08] dark:border-white/[0.08] hover:border-emerald-500/30 text-xs text-slate-700 dark:text-theme-text-secondary hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5"
              >
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
      <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
              {t('ui_visit_synthesis_form_field_observation_notes')}
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
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-900/[0.03] dark:bg-white/[0.04] hover:bg-white/[0.08] text-slate-700 dark:text-theme-text-secondary hover:text-slate-900 dark:hover:text-white border border-slate-900/[0.08] dark:border-white/[0.08] transition-colors disabled:opacity-50"
              title="Upload field voice note (.mp3, .wav, .m4a, .ogg, .webm)"
            >
              <UploadCloud className="w-3.5 h-3.5 text-slate-600 dark:text-theme-text-muted" />
              <span>{isTranscribing ? 'Transcribing...' : 'Upload voice memo'}</span>
            </button>

            <button
              type="button"
              onClick={toggleRecording}
              disabled={isTranscribing}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border-emerald-500/30'
              }`}
            >
              {isRecording ? <Square className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 fill-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
              <span>{isRecording ? `Stop Recording (${formatSecondsToMMSS(recordingDuration)})` : `Live Dictate (${language.slice(0, 2).toUpperCase()})`}</span>
            </button>
          </div>
        </div>

        {/* Live Audio Streaming Feedback */}
        {isRecording && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-700 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AudioLines className="w-4 h-4 text-rose-700 dark:text-rose-400" />
              <span>
                {interimText ? `"${interimText}..."` : 'Listening for field observations (Noise suppression active)...'}
              </span>
            </div>
            <span className="font-mono font-medium tabular-nums text-xs">{formatSecondsToMMSS(recordingDuration)}</span>
          </div>
        )}

        <div className="relative">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Type, live dictate, or upload field voice notes... (e.g. Inspected 2-acre plot in Rongai. Severe leaf yellowing with late blight lesions on lower leaves, soil moisture depleted, advised copper fungicide spraying and scheduled follow-up inspection in 10 days)"
            className="w-full min-h-[160px] p-4 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 focus:border-transparent outline-none transition-colors resize-none text-sm leading-relaxed"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <span className="text-xxs text-slate-600 dark:text-theme-text-muted">
            {t('ui_visit_synthesis_form_min_10_characters_required_for_multi')}
          </span>
          <button
            onClick={handleSynthesize}
            disabled={isProcessing || notes.trim().length < 10}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('ui_visit_synthesis_form_synthesizing_pathology_telemetry')}</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                <span>{t('ui_visit_synthesis_form_synthesize_agronomic_report')}</span>
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
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] text-center text-xs text-slate-600 dark:text-theme-text-muted flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-600 dark:text-theme-text-muted" />
          <span>{t('ui_visit_synthesis_form_select_a_registered_farmer_above_to')}</span>
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
