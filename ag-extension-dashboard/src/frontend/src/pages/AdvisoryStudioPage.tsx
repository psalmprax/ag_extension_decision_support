import React, { useState } from 'react';
import { AdvisoryRatesNotice } from './advisoryStudio/AdvisoryRatesNotice';
import { Smartphone, CheckCircle, Plus, Layers, Save, ShieldCheck, Download, AlertCircle, X } from 'lucide-react';
import apiClient from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { SavedProtocols } from './advisoryStudio/SavedProtocols';
import { SAVED_PROTOCOLS_KEY, type SavedProtocol } from './advisoryStudio/savedProtocols';
import { useLanguage } from '@/lib/LanguageContext';
import { DEFAULT_TEMPLATES, PALETTE_ITEMS, renderStepIcon, type PaletteItem, type WorkflowStep } from './advisoryStudio/studioModel';
import { StepCard } from './advisoryStudio/StepCard';
import { PhoneSimulator } from './advisoryStudio/PhoneSimulator';

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
  const queryClient = useQueryClient();
  const refreshSaved = () => queryClient.invalidateQueries({ queryKey: SAVED_PROTOCOLS_KEY });

  const handleOpenSaved = (protocol: SavedProtocol) => {
    setWorkflowId(protocol.id);
    setTitle(protocol.title);
    setDescription(protocol.description ?? '');
    setCategory(protocol.category);
    setStatus(protocol.status);
    setVersion(protocol.version);
    setSteps(protocol.stepsJson as WorkflowStep[]);
  };

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
      void refreshSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.warn('Failed to save workflow:', err);
      setErrorMsg(t('advisory_save_failed', { defaultValue: 'The draft could not be saved. Check your connection and try again.' }));
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
      void refreshSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.warn('Failed to publish workflow:', err);
      setErrorMsg(t('advisory_publish_failed', { defaultValue: 'The protocol could not be published. Try again.' }));
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
              <span className="px-2 py-0.5 text-xs tabular-nums rounded bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-slate-300">
                {status === 'published'
                  ? t('advisory_status_published', { version, defaultValue: 'Published, version {version}' })
                  : t('advisory_status_draft', { defaultValue: 'Draft' })}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1">{t('ui_advisory_studio_page_visual_no_code_agronomic_protocol_fo')}</p>
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
            <span>{isSaving ? t('common_saving', { defaultValue: 'Saving…' }) : t('advisory_save_draft', { defaultValue: 'Save draft' })}</span>
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
        <div className="bg-slate-50 dark:bg-white/[0.04] border-b border-emerald-500/30 px-6 py-2 flex items-center justify-between text-sm text-emerald-800 dark:text-emerald-200">
          <span role="status">
            {status === 'published'
              ? t('advisory_published', { defaultValue: 'Published.' })
              : t('ui_advisory_studio_page_workflow_schema_synchronized_and_rea')}
          </span>
          <button type="button" onClick={() => setSaveSuccess(false)} aria-label={t('common_close', { defaultValue: 'Close' })} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X className="w-4 h-4" aria-hidden="true" />
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
          <SavedProtocols activeId={workflowId} onOpen={handleOpenSaved} />
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
