import React, { useState } from 'react';
import { synthesizeVisit, type BoxUpdateData } from '@/api/aiService';
import { createVisit } from '@/api/visitService';
import { useAppStore } from '@/store/useAppStore';
import { Sparkles, Loader2, FileText, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useDesignSystemMode } from '@/hooks/useDesignSystemMode';

export const VisitSynthesisForm: React.FC = () => {
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<BoxUpdateData | null>(null);
  const { setLoading, user } = useAppStore();
  const { t } = useLanguage();
  const { isModern, headingClass } = useDesignSystemMode();

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
        toast.success(t('visit_synthesis_success'));
      } else {
        toast.error(t('visit_synthesis_error'));
      }
    } catch (error) {
      toast.error(t('visit_synthesis_error'));
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
        toast.success('Report saved to visits successfully!');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
      case 'fair': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'poor': return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
      case 'diseased': return 'text-rose-500 bg-rose-50 dark:bg-rose-900/20';
      default: return 'text-slate-500 bg-slate-50 dark:bg-slate-900/20';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${headingClass}`}>{isModern ? 'Encounter Analysis' : 'Visit Synthesis'}</h2>
            <p className="text-slate-500 dark:text-slate-400">{t('visit_synthesis_subtitle')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('visit_synthesis_placeholder')}
            className="w-full min-h-[200px] p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none"
          />
          
          <button
            onClick={handleSynthesize}
            disabled={isProcessing || !notes.trim()}
            className="w-full flex items-center justify-center gap-2 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95"
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                {t('visit_synthesis_generate')}
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Summary & Status */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('exec_summary')}
                </h3>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                  {result.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{t('crop_health')}</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(result.cropHealthStatus)}`}>
                    {result.cropHealthStatus}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{t('follow_up')}</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${result.followUpRequired ? 'text-rose-500 bg-rose-50' : 'text-emerald-500 bg-emerald-50'}`}>
                    {result.followUpRequired ? t('common_yes') : t('common_no')}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('pest_status')}</h4>
                <p className="text-sm font-medium">{result.pestIssues}</p>
              </div>
            </div>

            {/* Observations & Actions */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {t('key_observations')}
                </h3>
                <ul className="space-y-2">
                  {result.keyObservations.map((obs, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  {t('rec_actions')}
                </h3>
                <ul className="space-y-2">
                  {result.recommendedActions.map((action, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{result.nextVisitDateHint}</span>
                </div>
                <button 
                  onClick={handleSaveRecords}
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {isSaving ? 'Saving...' : t('save_records')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
