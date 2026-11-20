import React, { useState } from 'react';
import { dosagePreviewText } from './advisoryStudio/dosagePreview';
import { AdvisoryRatesNotice } from './advisoryStudio/AdvisoryRatesNotice';
import {
  Smartphone,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Layers,
  Save,
  ShieldCheck,
  Download,
  Sprout,
  Bug,
  Camera,
  Scale,
  FlaskConical,
  AlertCircle,
} from 'lucide-react';
import apiClient from '@/api/client';
import { useLanguage } from '@/lib/LanguageContext';

interface WorkflowStep {
  id: string;
  type: 'crop_select' | 'soil_test' | 'pest_scout' | 'photo_leaf' | 'dosage_advisory' | 'text_input';
  title: string;
  icon?: string;
  condition?: string;
  config: Record<string, string | number | boolean>;
}

function renderStepIcon(type: WorkflowStep['type']) {
  switch (type) {
    case 'crop_select':
      return <Sprout className="w-4 h-4 text-emerald-400" />;
    case 'soil_test':
      return <FlaskConical className="w-4 h-4 text-slate-400" />;
    case 'pest_scout':
      return <Bug className="w-4 h-4 text-amber-400" />;
    case 'photo_leaf':
      return <Camera className="w-4 h-4 text-slate-400" />;
    case 'dosage_advisory':
      return <Scale className="w-4 h-4 text-emerald-400" />;
    default:
      return <Layers className="w-4 h-4 text-slate-400" />;
  }
}

const DEFAULT_TEMPLATES: Record<string, { title: string; category: string; description: string; steps: WorkflowStep[] }> = {
  maize_armyworm: {
    title: 'Kenya Maize & Fall Armyworm Bio-Protocol',
    category: 'crop_protection',
    description: 'Autonomous field scouting checklist for scouting leaf funnels and computing cold-pressed Neem bio-dosages.',
    steps: [
      {
        id: 'step-crop',
        type: 'crop_select',
        title: 'Crop & Phenology Phase',
        config: { crop: 'Maize', stage: 'V4 - Early Whorl' },
      },
      {
        id: 'step-pest',
        type: 'pest_scout',
        title: 'Fall Armyworm Severity Assessment',
        condition: 'Crop == "Maize"',
        config: { threshold: 30, action: 'Trigger Neem Bio-Dosage' },
      },
      {
        id: 'step-photo',
        type: 'photo_leaf',
        title: 'Leaf Funnel Photo Scan',
        condition: 'Severity > 20%',
        config: { model: 'MobileNetV3-Agro-Edge', gpsTag: true },
      },
      {
        id: 'step-dosage',
        type: 'dosage_advisory',
        title: 'Precision Bio-Dosage Calculator',
        config: { rateLitersPerAcre: 0.4, waterPerAcreLiters: 133 },
      },
    ],
  },
  soil_lime: {
    title: 'Acidic Soil Remediation & Lime Advisory',
    category: 'soil_health',
    description: 'Diagnostic survey calculating dolomitic lime requirement based on regional soil pH.',
    steps: [
      {
        id: 'step-soil',
        type: 'soil_test',
        title: 'Soil pH Sensor Input',
        config: { baselinePh: 4.8, targetPh: 6.5 },
      },
      {
        id: 'step-crop-remediation',
        type: 'crop_select',
        title: 'Target Cereal Crop',
        config: { crop: 'Wheat / Cereal', stage: 'Pre-Planting' },
      },
      {
        id: 'step-lime-calc',
        type: 'dosage_advisory',
        title: 'Agricultural Lime Rate Formula',
        condition: 'pH < 5.5',
        config: { ratePerHectareMin: 2.0, ratePerHectareMax: 2.5 },
      },
    ],
  },
};

interface PaletteItem {
  type: WorkflowStep['type'];
  title: string;
  icon?: string;
  description: string;
  defaultConfig: Record<string, string | number | boolean>;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'crop_select',
    title: 'Crop & Phenology',
    description: 'Crop species, variety, and growth stage selector.',
    defaultConfig: { crop: 'Maize', stage: 'V4 - Early Whorl' },
  },
  {
    type: 'soil_test',
    title: 'Soil Chemistry & pH',
    description: 'pH sensor input, texture class & ISRIC telemetry.',
    defaultConfig: { baselinePh: 5.5, targetPh: 6.5 },
  },
  {
    type: 'pest_scout',
    title: 'Pest & Disease Rater',
    description: 'Severity slider (1-100%) and threshold alert.',
    defaultConfig: { threshold: 30, action: 'Flag Outbreak Alert' },
  },
  {
    type: 'photo_leaf',
    title: 'Camera Diagnostic',
    description: 'Offline MobileNet leaf photo scan & GPS tag.',
    defaultConfig: { model: 'MobileNetV3-Agro-Edge', gpsTag: true },
  },
  {
    type: 'dosage_advisory',
    title: 'Bio-Dosage Calculator',
    description: 'Dynamic Neem oil or Lime dosage per acreage.',
    defaultConfig: { rateLitersPerAcre: 0.4, waterPerAcreLiters: 133 },
  },
];

function StepCard({
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
            className="p-1 text-slate-400 hover:text-rose-400 transition rounded ml-1"
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

function PhoneSimulator({ steps }: { steps: WorkflowStep[] }) {
  const { t } = useLanguage();
  const [selectedCrop, setSelectedCrop] = useState('Maize');
  const [severity, setSeverity] = useState(35);
  const [soilPh, setSoilPh] = useState(4.8);
  const [submitted, setSubmitted] = useState(false);

  const isArmywormVisible = selectedCrop === 'Maize';
  const isLimeVisible = soilPh < 5.5;

  return (
    <div className="w-full max-w-[280px] aspect-[9/18] rounded-[28px] border-2 border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#0d1a14] shadow-xl p-3 flex flex-col relative overflow-hidden">
      <div className="w-20 h-4 bg-slate-100 dark:bg-white/[0.07] rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-slate-50 dark:bg-white/[0.04]" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 text-[11px] pr-1">
        <div className="pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
          <div className="text-slate-900 dark:text-white font-medium text-[12px] flex items-center justify-between">
            <span>{t('ui_advisory_studio_page_field_scouting_pwa')}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-slate-300 border border-slate-900/[0.08] dark:border-white/[0.08]">
              OFFLINE
            </span>
          </div>
          <div className="text-[10px] text-slate-400">{t('ui_advisory_studio_page_kitale_sector_4_plot_12a')}</div>
        </div>

        {steps.map((step, idx) => {
          if (step.type === 'crop_select') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <label className="text-[10px] text-slate-400 block mb-1">
                  {t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_select_crop')}
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="w-full bg-white dark:bg-[#0d1a14] border border-slate-900/[0.08] dark:border-white/[0.08] rounded px-1.5 py-1 text-slate-900 dark:text-white text-[11px]"
                >
                  <option value="Maize">{t('ui_advisory_studio_page_maize_mahindi')}</option>
                  <option value="Cassava">{t('ui_advisory_studio_page_cassava_mhogo')}</option>
                  <option value="Sorghum">{t('ui_advisory_studio_page_sorghum_mtama')}</option>
                </select>
              </div>
            );
          }

          if (step.type === 'pest_scout') {
            if (!isArmywormVisible) return null;
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">{t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_infestation')}</label>
                  <span className="text-amber-400 font-mono text-[10px]">{severity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1 bg-slate-100 dark:bg-white/[0.07] rounded"
                />
                {severity >= 30 && (
                  <div className="mt-1 text-[9px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{t('ui_advisory_studio_page_threshold_exceeded_action_required')}</span>
                  </div>
                )}
              </div>
            );
          }

          if (step.type === 'soil_test') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">{t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_soil_ph')}</label>
                  <span className="text-slate-400 font-mono text-[10px]">{soilPh.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="7.5"
                  step="0.1"
                  value={soilPh}
                  onChange={(e) => setSoilPh(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1 bg-slate-100 dark:bg-white/[0.07] rounded"
                />
              </div>
            );
          }

          if (step.type === 'photo_leaf') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <label className="text-[10px] text-slate-400 block mb-1">{t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_leaf_diagnostic')}</label>
                <div className="p-2 rounded bg-white dark:bg-[#0d1a14] border border-dashed border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col items-center text-center">
                  <Camera className="w-4 h-4 text-slate-400 mb-0.5" />
                  <span className="text-[9px] text-slate-400">{t('ui_advisory_studio_page_tap_to_scan_whorl_with_camera')}</span>
                </div>
              </div>
            );
          }

          if (step.type === 'dosage_advisory') {
            const isLime = step.condition?.includes('pH');
            if (isLime && !isLimeVisible) return null;

            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <label className="text-[10px] text-emerald-400 font-medium block mb-0.5">
                  {t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_automated_recommendation')}
                </label>
                <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-snug">{dosagePreviewText(step.config, Boolean(isLime))}</p>
              </div>
            );
          }

          return null;
        })}

        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="w-full py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-colors"
        >
          {submitted ? '✓ Saved to offline cache' : 'Record field diagnostic'}
        </button>
      </div>

      <div className="w-16 h-1 bg-slate-200 dark:bg-white/[0.1] rounded-full mx-auto mt-2 shrink-0" />
    </div>
  );
}

export function AdvisoryStudioPage() {
  const { t } = useLanguage();
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [title, setTitle] = useState(DEFAULT_TEMPLATES.maize_armyworm.title);
  const [description, setDescription] = useState(DEFAULT_TEMPLATES.maize_armyworm.description);
  const [category, setCategory] = useState(DEFAULT_TEMPLATES.maize_armyworm.category);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [version, setVersion] = useState(1);
  const [steps, setSteps] = useState<WorkflowStep[]>(DEFAULT_TEMPLATES.maize_armyworm.steps);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectTemplate = (key: string) => {
    const tpl = DEFAULT_TEMPLATES[key];
    if (!tpl) return;
    setTitle(tpl.title);
    setDescription(tpl.description);
    setCategory(tpl.category);
    setSteps(tpl.steps);
    setStatus('draft');
    setWorkflowId(null);
  };

  const handleAddBlock = (item: PaletteItem) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type: item.type,
      title: item.title,
      icon: item.icon,
      config: { ...item.defaultConfig },
    };
    setSteps((prev) => [...prev, newStep]);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    setSteps((prev) => {
      const copy = [...prev];
      const temp = copy[index]!;
      copy[index] = copy[targetIdx]!;
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleDeleteStep = (index: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateCondition = (index: number, condition: string) => {
    setSteps((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], condition: condition || undefined };
      }
      return copy;
    });
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      if (workflowId) {
        const res = await apiClient.put(`/workflows/${workflowId}`, {
          title,
          description,
          category,
          status,
          stepsJson: steps,
        });
        if (res.data?.data?.version) setVersion(res.data.data.version);
      } else {
        const res = await apiClient.post('/workflows', {
          title,
          description,
          category,
          status: 'draft',
          stepsJson: steps,
        });
        if (res.data?.data?.id) {
          setWorkflowId(res.data.data.id);
          setVersion(res.data.data.version || 1);
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.warn('Failed to save workflow:', err);
      setErrorMsg('Failed to save workflow. Please verify connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    setErrorMsg('');

    try {
      let activeId = workflowId;
      if (!activeId) {
        const createRes = await apiClient.post('/workflows', {
          title,
          description,
          category,
          status: 'draft',
          stepsJson: steps,
        });
        activeId = createRes.data?.data?.id;
        setWorkflowId(activeId);
      }

      if (activeId) {
        const publishRes = await apiClient.post(`/workflows/${activeId}/publish`);
        setStatus('published');
        if (publishRes.data?.data?.version) {
          setVersion(publishRes.data.data.version);
        }
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.warn('Failed to publish workflow:', err);
      setErrorMsg('Failed to publish workflow to field officers.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportJson = () => {
    const payload = JSON.stringify({ title, description, category, version, status, steps }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${title.toLowerCase().replace(/\s+/g, '-')}-v${version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1a14] text-slate-800 dark:text-slate-100 flex flex-col rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] overflow-hidden">
      <header className="h-16 border-b border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] backdrop-blur-md px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title} onChange={(e) => setTitle(e.target.value)}
                size={Math.max(12, Math.min(title.length + 1, 48))} aria-label={t('advisory_studio_protocol_name', { defaultValue: 'Protocol name' })}
                className="font-medium text-base bg-transparent border-b border-transparent hover:border-slate-900/[0.08] dark:hover:border-white/[0.08] focus:border-emerald-400 focus:outline-none text-slate-900 dark:text-white transition px-1"
              />
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-slate-300 border border-slate-900/[0.08] dark:border-white/[0.08]">
                v{version} • {status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 px-1">{t('ui_advisory_studio_page_visual_no_code_agronomic_protocol_fo')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md bg-slate-100 dark:bg-white/[0.07] border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="maize_armyworm">{t('ui_advisory_studio_page_template_maize_fall_armyworm')}</option>
            <option value="soil_lime">{t('ui_advisory_studio_page_template_soil_ph_lime')}</option>
          </select>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 border border-slate-900/[0.08] dark:border-white/[0.08] transition flex items-center gap-1.5"
            title="Export workflow schema JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('common_export')}</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveDraft}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 border border-slate-900/[0.08] dark:border-white/[0.08] transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handlePublish}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{t('ui_advisory_studio_page_publish_to_field_pwa')}</span>
          </button>
        </div>
      </header>
      <AdvisoryRatesNotice />
      {saveSuccess && (
        <div className="bg-slate-50 dark:bg-white/[0.04] border-b border-emerald-500/30 px-6 py-2 flex items-center justify-between text-xs text-emerald-300 font-normal">
          <span>{t('ui_advisory_studio_page_workflow_schema_synchronized_and_rea')}</span>
          <button type="button" onClick={() => setSaveSuccess(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-slate-50 dark:bg-white/[0.04] border-b border-rose-500/30 px-6 py-2 text-xs text-rose-300 font-normal flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] p-5 flex flex-col gap-4 shrink-0 overflow-y-auto">
          <div>
            <h3 className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('ui_advisory_studio_page_agronomic_blocks')}</span>
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">{t('ui_advisory_studio_page_click_block_to_insert_into_workflow')}</p>

            <div className="space-y-2">
              {PALETTE_ITEMS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddBlock(item)}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.07] border border-slate-900/[0.08] dark:border-white/[0.08] hover:border-slate-900/[0.08] dark:hover:border-white/[0.08] transition-colors group"
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.07] border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-center shrink-0">
                      {renderStepIcon(item.type)}
                    </span>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-900/[0.08] dark:border-white/[0.08]">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                {t('ui_advisory_studio_page_zero_code_logic_conditional_branchin')}
              </span>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-white dark:bg-[#0d1a14] p-6 overflow-y-auto flex flex-col items-center">
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('ui_advisory_studio_page_protocol_decision_canvas')}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.07] text-slate-400 border border-slate-900/[0.08] dark:border-white/[0.08] font-mono">
                  {t('ui_advisory_studio_page_steps', { length: steps.length })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSteps([])}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                {t('ui_advisory_studio_page_clear_canvas')}
              </button>
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={idx}
                  totalSteps={steps.length}
                  onMoveUp={() => handleMoveStep(idx, 'up')}
                  onMoveDown={() => handleMoveStep(idx, 'down')}
                  onDelete={() => handleDeleteStep(idx)}
                  onUpdateCondition={(cond) => handleUpdateCondition(idx, cond)}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => handleAddBlock(PALETTE_ITEMS[0]!)}
                className="px-4 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-dashed border-slate-900/[0.08] dark:border-white/[0.08] hover:border-slate-500 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{t('ui_advisory_studio_page_add_step_to_protocol')}</span>
              </button>
            </div>
          </div>
        </main>

        <aside className="w-84 border-l border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.04] p-5 flex flex-col items-center shrink-0 overflow-y-auto">
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span>{t('ui_advisory_studio_page_mobile_pwa_preview')}</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-slate-300 border border-slate-900/[0.08] dark:border-white/[0.08]">
              {t('ui_advisory_studio_page_offline_ready')}
            </span>
          </div>

          <PhoneSimulator steps={steps} />

          <div className="mt-4 w-full p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-400 text-[11px] text-center">
            {t('ui_advisory_studio_page_rule_updates_on_canvas_reflect_immed')}
          </div>
        </aside>
      </div>
    </div>
  );
}
