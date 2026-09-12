import React, { useState } from 'react';
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
} from 'lucide-react';
import apiClient from '@/api/client';

interface WorkflowStep {
  id: string;
  type: 'crop_select' | 'soil_test' | 'pest_scout' | 'photo_leaf' | 'dosage_advisory' | 'text_input';
  title: string;
  icon: string;
  condition?: string;
  config: Record<string, string | number | boolean>;
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
        icon: '🌽',
        config: { crop: 'Maize', stage: 'V4 - Early Whorl' },
      },
      {
        id: 'step-pest',
        type: 'pest_scout',
        title: 'Fall Armyworm Severity Assessment',
        icon: '🐛',
        condition: 'Crop == "Maize"',
        config: { threshold: 30, action: 'Trigger Neem Bio-Dosage' },
      },
      {
        id: 'step-photo',
        type: 'photo_leaf',
        title: 'Leaf Funnel Photo Scan',
        icon: '📷',
        condition: 'Severity > 20%',
        config: { model: 'MobileNetV3-Agro-Edge', gpsTag: true },
      },
      {
        id: 'step-dosage',
        type: 'dosage_advisory',
        title: 'Precision Bio-Dosage Calculator',
        icon: '⚖️',
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
        icon: '🧪',
        config: { baselinePh: 4.8, targetPh: 6.5 },
      },
      {
        id: 'step-crop-remediation',
        type: 'crop_select',
        title: 'Target Cereal Crop',
        icon: '🌾',
        config: { crop: 'Wheat / Cereal', stage: 'Pre-Planting' },
      },
      {
        id: 'step-lime-calc',
        type: 'dosage_advisory',
        title: 'Agricultural Lime Rate Formula',
        icon: '⚖️',
        condition: 'pH < 5.5',
        config: { ratePerHectareMin: 2.0, ratePerHectareMax: 2.5 },
      },
    ],
  },
};

interface PaletteItem {
  type: WorkflowStep['type'];
  title: string;
  icon: string;
  description: string;
  defaultConfig: Record<string, string | number | boolean>;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'crop_select',
    title: 'Crop & Phenology',
    icon: '🌽',
    description: 'Crop species, variety, and growth stage selector.',
    defaultConfig: { crop: 'Maize', stage: 'V4 - Early Whorl' },
  },
  {
    type: 'soil_test',
    title: 'Soil Chemistry & pH',
    icon: '🧪',
    description: 'pH sensor input, texture class & ISRIC telemetry.',
    defaultConfig: { baselinePh: 5.5, targetPh: 6.5 },
  },
  {
    type: 'pest_scout',
    title: 'Pest & Disease Rater',
    icon: '🐛',
    description: 'Severity slider (1-100%) and threshold alert.',
    defaultConfig: { threshold: 30, action: 'Flag Outbreak Alert' },
  },
  {
    type: 'photo_leaf',
    title: 'Camera Diagnostic',
    icon: '📷',
    description: 'Offline MobileNet leaf photo scan & GPS tag.',
    defaultConfig: { model: 'MobileNetV3-Agro-Edge', gpsTag: true },
  },
  {
    type: 'dosage_advisory',
    title: 'Bio-Dosage Calculator',
    icon: '⚖️',
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
  const [isEditingCondition, setIsEditingCondition] = useState(false);
  const [condInput, setCondInput] = useState(step.condition || '');

  const handleSaveCondition = () => {
    onUpdateCondition(condInput.trim());
    setIsEditingCondition(false);
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-lg relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
            {index + 1}
          </span>
          <span className="text-base">{step.icon}</span>
          <h4 className="text-xs font-semibold text-white">{step.title}</h4>
        </div>

        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition rounded"
            title="Move step up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={index === totalSteps - 1}
            onClick={onMoveDown}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition rounded"
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
        <div className="mt-2.5 flex items-center justify-between gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-amber-400">IF:</span>
            <span>{step.condition}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingCondition(true)}
            className="text-[10px] text-amber-400 hover:underline"
          >
            Edit
          </button>
        </div>
      )}

      {isEditingCondition && (
        <div className="mt-2.5 p-2 rounded-lg bg-slate-950 border border-amber-500/30 flex items-center gap-2">
          <input
            type="text"
            value={condInput}
            onChange={(e) => setCondInput(e.target.value)}
            placeholder="e.g. Crop == 'Maize' or pH < 5.5"
            className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={handleSaveCondition}
            className="px-2 py-1 text-xs rounded bg-amber-500 text-slate-950 font-bold"
          >
            Save
          </button>
        </div>
      )}

      {!step.condition && !isEditingCondition && (
        <button
          type="button"
          onClick={() => setIsEditingCondition(true)}
          className="mt-2 text-[11px] text-slate-500 hover:text-slate-300 inline-flex items-center gap-1"
        >
          <span>+ Add conditional logic</span>
        </button>
      )}

      <div className="mt-3 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300">
        {step.type === 'crop_select' && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Default Crop</span>
              <span className="font-medium text-emerald-400">{String(step.config.crop || 'Maize')}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Growth Stage</span>
              <span className="font-medium text-white">{String(step.config.stage || 'Vegetative')}</span>
            </div>
          </div>
        )}
        {step.type === 'soil_test' && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Target Acidity Threshold:</span>
            <span className="font-mono text-cyan-400">pH {String(step.config.targetPh || '6.5')}</span>
          </div>
        )}
        {step.type === 'pest_scout' && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Severity Threshold:</span>
            <span className="font-semibold text-amber-400">{String(step.config.threshold || '30')}%</span>
          </div>
        )}
        {step.type === 'dosage_advisory' && (
          <div className="text-[11px] text-emerald-400 font-mono">
            Rate: {String(step.config.rateLitersPerAcre || '0.4')} L/acre in {String(step.config.waterPerAcreLiters || '133')} L water
          </div>
        )}
        {step.type === 'photo_leaf' && (
          <div className="flex items-center gap-1.5 text-[11px] text-violet-300">
            <span>Edge AI Diagnostic Engine: MobileNetV3</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneSimulator({ steps }: { steps: WorkflowStep[] }) {
  const [selectedCrop, setSelectedCrop] = useState('Maize');
  const [severity, setSeverity] = useState(35);
  const [soilPh, setSoilPh] = useState(4.8);
  const [submitted, setSubmitted] = useState(false);

  const isArmywormVisible = selectedCrop === 'Maize';
  const isLimeVisible = soilPh < 5.5;

  return (
    <div className="w-full max-w-[280px] aspect-[9/18] rounded-[36px] border-4 border-slate-700 bg-slate-950 shadow-2xl p-3 flex flex-col relative overflow-hidden">
      <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-slate-900" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 text-[11px] pr-1">
        <div className="pb-2 border-b border-slate-800">
          <div className="text-white font-bold text-[12px] flex items-center justify-between">
            <span>Field Scouting PWA</span>
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              OFFLINE
            </span>
          </div>
          <div className="text-[10px] text-slate-400">Kitale Sector 4 • Plot 12A</div>
        </div>

        {steps.map((step, idx) => {
          if (step.type === 'crop_select') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <label className="text-[10px] text-slate-400 block mb-1">
                  Step {idx + 1}: Select Crop
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-white text-[11px]"
                >
                  <option value="Maize">Maize (Mahindi)</option>
                  <option value="Cassava">Cassava (Mhogo)</option>
                  <option value="Sorghum">Sorghum (Mtama)</option>
                </select>
              </div>
            );
          }

          if (step.type === 'pest_scout') {
            if (!isArmywormVisible) return null;
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">Step {idx + 1}: Infestation</label>
                  <span className="text-amber-400 font-bold text-[10px]">{severity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded"
                />
                {severity >= 30 && (
                  <div className="mt-1 text-[9px] text-amber-300 font-medium">
                    ⚠️ Threshold exceeded: Action required!
                  </div>
                )}
              </div>
            );
          }

          if (step.type === 'soil_test') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">Step {idx + 1}: Soil pH</label>
                  <span className="text-cyan-400 font-bold text-[10px]">{soilPh.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="7.5"
                  step="0.1"
                  value={soilPh}
                  onChange={(e) => setSoilPh(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
                />
              </div>
            );
          }

          if (step.type === 'photo_leaf') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <label className="text-[10px] text-slate-400 block mb-1">Step {idx + 1}: Leaf Diagnostic</label>
                <div className="p-2 rounded bg-slate-950 border border-dashed border-slate-700 flex flex-col items-center text-center">
                  <span className="text-sm">📸</span>
                  <span className="text-[9px] text-slate-400 mt-1">Tap to scan whorl with camera</span>
                </div>
              </div>
            );
          }

          if (step.type === 'dosage_advisory') {
            const isLime = step.condition?.includes('pH');
            if (isLime && !isLimeVisible) return null;

            return (
              <div key={step.id} className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                <label className="text-[10px] text-emerald-400 font-semibold block mb-0.5">
                  Step {idx + 1}: Automated Recommendation
                </label>
                <p className="text-[10px] text-emerald-200 leading-snug">
                  {isLime
                    ? 'Apply 2.2 tonnes/ha calcitic lime incorporated into top 15cm.'
                    : 'Mix 1.2L cold-pressed Neem oil across 3 acres at dusk.'}
                </p>
              </div>
            );
          }

          return null;
        })}

        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition"
        >
          {submitted ? '✓ Saved to Offline Cache' : 'Record Field Diagnostic'}
        </button>
      </div>

      <div className="w-16 h-1 bg-slate-700 rounded-full mx-auto mt-2 shrink-0" />
    </div>
  );
}

export function AdvisoryStudioPage() {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20 text-lg">
            🌱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-400 focus:outline-none text-white transition px-1"
              />
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                v{version} • {status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 px-1">Visual No-Code Agronomic Protocol & Form Studio</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="maize_armyworm">Template: Maize Fall Armyworm</option>
            <option value="soil_lime">Template: Soil pH & Lime</option>
          </select>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            title="Export workflow schema JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveDraft}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handlePublish}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Publish to Field PWA</span>
          </button>
        </div>
      </header>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-6 py-2 flex items-center justify-between text-xs text-emerald-300 font-medium">
          <span>✓ Workflow schema synchronized and ready for offline deployment.</span>
          <button type="button" onClick={() => setSaveSuccess(false)} className="text-emerald-400">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-2 text-xs text-rose-300 font-medium">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-4 shrink-0 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Agronomic Blocks</span>
            </h3>
            <p className="text-[11px] text-slate-500 mb-3">Click block to insert into workflow canvas</p>

            <div className="space-y-2">
              {PALETTE_ITEMS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddBlock(item)}
                  className="w-full text-left p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 transition group"
                >
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="p-1 rounded bg-slate-900 text-base">{item.icon}</span>
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{item.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/30 text-[11px] text-emerald-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Zero-Code Logic: Conditional branching evaluates locally in browser and field SQLite/IndexedDB.
              </span>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-slate-950 p-6 overflow-y-auto flex flex-col items-center">
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-slate-200">Protocol Decision Canvas</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {steps.length} Steps
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSteps([])}
                className="text-xs text-rose-400 hover:text-rose-300 transition"
              >
                Clear Canvas
              </button>
            </div>

            <div className="space-y-4">
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
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500 text-slate-400 hover:text-emerald-400 text-xs font-medium transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Step to Protocol</span>
              </button>
            </div>
          </div>
        </main>

        <aside className="w-84 border-l border-slate-800 bg-slate-900/60 p-5 flex flex-col items-center shrink-0 overflow-y-auto">
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Mobile PWA Preview</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live Preview
            </span>
          </div>

          <PhoneSimulator steps={steps} />

          <div className="mt-4 w-full p-3 rounded-xl bg-slate-800/70 border border-slate-700 text-slate-400 text-[11px] text-center">
            Rule updates on canvas reflect immediately in field officer device preview.
          </div>
        </aside>
      </div>
    </div>
  );
}
