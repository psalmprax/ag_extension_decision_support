import React from 'react';
import { Sparkles, Layout, Layers } from 'lucide-react';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { triggerHaptic } from '@/lib/haptics';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';

interface ABTestToggleProps {
  compact?: boolean;
  className?: string;
  showLabel?: boolean;
}

export const ABTestToggle: React.FC<ABTestToggleProps> = ({
  compact = false,
  className = '',
  showLabel: _showLabel = true,
}) => {
  const { designVariant, setDesignVariant } = useFeatureFlags();
  const { t } = useLanguage();

  const isBase = designVariant === 'base' || designVariant === 'new';

  const handleSelect = (variant: 'classic' | 'base') => {
    triggerHaptic('medium');
    setDesignVariant(variant);
    if (variant === 'base') {
      toast.success(
        t('ab_variant_base_toast', {
          defaultValue: 'A/B Test: Base App Onchain Aesthetic Activated',
        }),
        { id: 'ab-test-toast', icon: '🔵' }
      );
    } else {
      toast.success(
        t('ab_variant_classic_toast', {
          defaultValue: 'A/B Test: Classic Enterprise Aesthetic Activated',
        }),
        { id: 'ab-test-toast', icon: '🏛️' }
      );
    }
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-md ${className}`}>
        <button
          onClick={() => handleSelect('classic')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xxs font-bold uppercase tracking-wider transition-all duration-200 ${
            !isBase
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Classic Enterprise Variant"
          aria-pressed={!isBase}
        >
          <Layout className="w-3 h-3" />
          <span>A</span>
        </button>

        <button
          onClick={() => handleSelect('base')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xxs font-bold uppercase tracking-wider transition-all duration-200 ${
            isBase
              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-950/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Base App Modern Variant"
          aria-pressed={isBase}
        >
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>B</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-xl ${className}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
          isBase ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        }`}>
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">
              {t('ab_experiment_title', { defaultValue: 'UI Aesthetic Experiment' })}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-semibold">
              A/B ACTIVE
            </span>
          </div>
          <p className="text-xxs text-slate-400 mt-0.5">
            {isBase
              ? t('ab_desc_base', { defaultValue: 'Variant B: Base App onchain floating island & haptic ergonomics' })
              : t('ab_desc_classic', { defaultValue: 'Variant A: Classic docked enterprise dashboard layout' })}
          </p>
        </div>
      </div>

      <div className="flex items-center p-1 rounded-xl bg-slate-950/90 border border-white/10 w-full sm:w-auto justify-center sm:justify-start">
        <button
          onClick={() => handleSelect('classic')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            !isBase
              ? 'bg-slate-800 text-white shadow-sm border border-white/10'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>{t('ab_option_classic', { defaultValue: 'Classic (A)' })}</span>
        </button>

        <button
          onClick={() => handleSelect('base')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            isBase
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-950/50 border border-blue-400/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-300" />
          <span>{t('ab_option_base', { defaultValue: 'Base App (B)' })}</span>
        </button>
      </div>
    </div>
  );
};
