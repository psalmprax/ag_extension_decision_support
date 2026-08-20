import React, { useState } from 'react';
import { synthesizeVisit, type BoxUpdateData } from '@/api/aiService';
import { createVisit } from '@/api/visitService';
import { useAppStore } from '@/store/useAppStore';
import {
  Sparkles,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Mic,
  MicOff,
  Radio,
  Send,
  Leaf,
  Layers,
  ArrowRight,
  BookmarkPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';

const FIELD_PRESETS = [
  {
    title: 'Fall Armyworm Infestation',
    icon: '🐛',
    text: 'Inspected 3-hectare maize plot in Rongai. Severe whorl damage observed on 35% of crops at V4 vegetative stage. Characteristic windowpane feeding signs and sawdust-like frass detected. Recommended immediate biological spraying (Emamectin benzoate) and pheromone trap deployment.',
  },
  {
    title: 'Late Blight & Soil Acidity',
    icon: '🍂',
    text: 'Visited potato field in Kiambu highlands. Water-soaked dark lesions on lower leaves with white fungal growth on undersides. Soil pH tested at 5.2 (acidic). Prescribed copper hydroxide fungicide application and agricultural lime top-dressing.',
  },
  {
    title: 'Moisture Stress & Stunting',
    icon: '💧',
    text: 'Field inspection of smallholder sorghum in Machakos. Crops showing marked wilting and nitrogen deficiency yellowing due to 18-day dry spell. Advised organic mulching to conserve root zone moisture and scheduled foliar fertilizer application once rains resume.',
  },
];

export const VisitSynthesisForm: React.FC = () => {
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<BoxUpdateData | null>(null);
  const { setLoading, user } = useAppStore();
  const { t } = useLanguage();

  const handleToggleVoiceDictation = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Voice dictation is not supported by your browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      setIsListening(true);
      toast.success('Listening for field observations...');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNotes(prev => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error('Voice dictation stopped or unavailable.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      toast.error('Could not start voice recognition.');
    }
  };

  const handleSynthesize = async () => {
    if (notes.length < 10) {
      toast.error(t('common_error') + ': Please enter more detailed notes (min 10 chars)');
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    try {
      const res = await synthesizeVisit(notes);
      if (res.success) {
        setResult(res.data);
        toast.success(t('visit_synthesis_success') || 'Visit observations synthesized successfully!');
      } else {
        toast.error(t('visit_synthesis_error') || 'Synthesis failed');
      }
    } catch (error) {
      toast.error(t('visit_synthesis_error') || 'Synthesis failed');
      console.error(error);
    } finally {
      setIsProcessing(false);
      setLoading(false);
    }
  };

  const handleSaveRecords = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const visitPayload = {
        farmer_id: user?.id || 'unknown',
        farmer_name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        visit_type: 'ai_synthesis',
        status: 'completed',
        scheduled_at: new Date().toISOString(),
        notes: `AI Synthesis: ${result.summary}\n\nCrop Health: ${result.cropHealthStatus}\nPest Issues: ${result.pestIssues}\nKey Observations: ${result.keyObservations.join('; ')}\nRecommended Actions: ${result.recommendedActions.join('; ')}`,
      };
      const res = await createVisit(visitPayload);
      if (res.success) {
        toast.success('Report saved to field visits and itinerary generated!');
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

  const getStatusBadge = (status: string) => {
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
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header Telemetry & Preset Hub ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-950/40">
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

      {/* ── Input Terminal Card ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Field Observation Notes
            </h2>
          </div>
          <button
            type="button"
            onClick={handleToggleVoiceDictation}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all border ${
              isListening
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border-white/10'
            }`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-purple-400" />}
            <span>{isListening ? 'Stop Recording' : 'Voice Dictate'}</span>
          </button>
        </div>

        <div className="relative">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Type or dictate field observations... (e.g. Farmer Samuel in Rongai reported leaf yellowing on maize, observed late blight spots, soil moisture depleted, advised organic mulching and scheduled follow-up in 10 days)"
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

      {/* ── Synthesis Key-Findings Bento Grid ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Bento Card 1: Diagnostic Summary & Pathology */}
            <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                      Diagnostic Executive Summary
                    </h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getStatusBadge(result.cropHealthStatus)}`}>
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
            <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
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

              {/* 1-Click Save / Dispatch Dock */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                <span className="text-xxs text-white/40">
                  Saves to farmer timeline & updates triage priority.
                </span>
                <button
                  onClick={handleSaveRecords}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                  <span>{isSaving ? 'Logging Visit...' : 'Save & Dispatch Itinerary'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisitSynthesisForm;
