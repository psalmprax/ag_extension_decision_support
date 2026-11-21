import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { renderStepIcon, type WorkflowStep } from './studioModel';

export function StepCard({
  step,
  index,
  totalSteps,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdateCondition,
}: {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUpdateCondition: (condition: string) => void;
}) {
  const { t } = useLanguage();
  const [isEditingCondition, setIsEditingCondition] = useState(false);
  const [condInput, setCondInput] = useState(step.condition || '');

  const handleSaveCondition = () => {
    onUpdateCondition(condInput.trim());
    setIsEditingCondition(false);
  };

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] hover:border-slate-900/[0.08] dark:hover:border-white/[0.08] transition-colors shadow-sm relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded bg-slate-100 dark:bg-white/[0.07] flex items-center justify-center text-[11px] font-mono text-slate-400">
            {index + 1}
          </span>
          <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.07] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center shrink-0">
            {renderStepIcon(step.type)}
          </span>
          <h4 className="text-xs font-medium text-slate-800 dark:text-slate-100">{step.title}</h4>
        </div>

        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition rounded"
            title="Move step up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={index === totalSteps - 1}
            onClick={onMoveDown}
            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition rounded"
            title="Move step down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-rose-400 transition rounded ms-1"
            title="Delete step"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {step.condition && !isEditingCondition && (
        <div className="mt-2.5 flex items-center justify-between gap-2 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.07] border border-slate-900/[0.08] dark:border-white/[0.08] text-[11px] text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="font-medium text-amber-400">IF:</span>
            <span>{step.condition}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingCondition(true)}
            className="text-[10px] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {t('common_edit')}
          </button>
        </div>
      )}

      {isEditingCondition && (
        <div className="mt-2.5 p-2 rounded-lg bg-white dark:bg-[#0d1a14] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center gap-2">
          <input
            type="text"
            value={condInput}
            onChange={(e) => setCondInput(e.target.value)}
            placeholder="e.g. Crop == 'Maize' or pH < 5.5"
            className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] rounded text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
          />
          <button
            type="button"
            onClick={handleSaveCondition}
            className="px-2.5 py-1 text-xs rounded bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 border border-slate-900/[0.08] dark:border-white/[0.08] font-medium transition-colors"
          >
            {t('common_save')}
          </button>
        </div>
      )}

      {!step.condition && !isEditingCondition && (
        <button
          type="button"
          onClick={() => setIsEditingCondition(true)}
          className="mt-2 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 inline-flex items-center gap-1 transition-colors"
        >
          <span>{t('ui_advisory_studio_page_add_conditional_logic')}</span>
        </button>
      )}

      <div className="mt-3 p-2.5 rounded-lg bg-white dark:bg-[#0d1a14] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-300">
        {step.type === 'crop_select' && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">{t('ui_advisory_studio_page_default_crop')}</span>
              <span className="font-medium text-emerald-400">{String(step.config.crop || 'Maize')}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">{t('ui_advisory_studio_page_growth_stage')}</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{String(step.config.stage || 'Vegetative')}</span>
            </div>
          </div>
        )}
        {step.type === 'soil_test' && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{t('ui_advisory_studio_page_target_acidity_threshold')}</span>
            <span className="font-mono text-slate-400">pH {String(step.config.targetPh || '6.5')}</span>
          </div>
        )}
        {step.type === 'pest_scout' && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{t('ui_advisory_studio_page_severity_threshold')}</span>
            <span className="font-mono text-amber-400">{String(step.config.threshold || '30')}%</span>
          </div>
        )}
        {step.type === 'dosage_advisory' && (
          <div className="text-[11px] text-emerald-400 font-mono">
            {t('ui_advisory_studio_page_rate')} {String(step.config.rateLitersPerAcre || '0.4')} {t('ui_advisory_studio_page_l_acre_in')} {String(step.config.waterPerAcreLiters || '133')} {t('ui_advisory_studio_page_l_water')}
          </div>
        )}
        {step.type === 'photo_leaf' && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>{t('ui_advisory_studio_page_edge_diagnostic_mobilenetv3')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
