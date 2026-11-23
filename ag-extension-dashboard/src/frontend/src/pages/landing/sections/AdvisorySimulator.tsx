import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Play } from 'lucide-react';
import { SANDBOX_PRESETS, simulationSteps, type ChannelTab, type SandboxPreset } from '../sectionData';
import { useLanguage } from '@/lib/LanguageContext';
import { BUTTON_PRIMARY, CARD, choiceClass } from './sectionStyles';

const CHANNELS: Array<{ id: ChannelTab; label: string }> = [
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
];
const STEP_DELAY_MS = 350;

/** Plays the four example steps in turn. Nothing is sent and no farmer is involved. */
function useSimulation() {
  const [progress, setProgress] = useState(4);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const run = () => {
    timers.current.forEach(window.clearTimeout);
    setRunning(true);
    setProgress(1);
    timers.current = [2, 3, 4].map((step, index) =>
      window.setTimeout(() => {
        setProgress(step);
        if (step === 4) setRunning(false);
      }, STEP_DELAY_MS * (index + 1))
    );
  };
  return { progress, running, run };
}

const PANEL = `${CARD} p-5 sm:p-6 space-y-4`;
const PANEL_TITLE = 'text-sm font-medium text-white';
const MUTED = 'text-xs text-white/60';

function GuidanceCard({ preset }: { preset: SandboxPreset }) {
  const { t } = useLanguage();
  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
        <span className={PANEL_TITLE}>{t('ui_agent_os_example_guidance_card')}</span>
        <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-200">{t('ui_agent_os_not_verified')}</span>
      </div>
      <div className="text-sm font-medium text-emerald-300">{preset.skillTitle}</div>
      <p className="text-sm text-white/70 leading-relaxed">{preset.skillBody}</p>
      <div className={`flex flex-wrap justify-between gap-2 ${MUTED}`}>
        <span>{t('ui_agent_os_source_scripted_example')}</span>
        <span>{t('ui_agent_os_region', { targetRegion: preset.targetRegion })}</span>
      </div>
    </div>
  );
}

function ChannelPreview({ preset }: { preset: SandboxPreset }) {
  const { t } = useLanguage();
  const [channel, setChannel] = useState<ChannelTab>('sms');
  const counts = [
    { value: preset.affectedFarmers, label: t('ui_agent_os_example_farmers') },
    { value: preset.alertsDispatched, label: t('ui_agent_os_example_alerts') },
    { value: preset.visitsQueued, label: t('ui_agent_os_example_visits') },
  ];
  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <span className={PANEL_TITLE}>{t('ui_agent_os_multi_channel_message_preview')}</span>
        <div role="group" aria-label={t('ui_agent_os_multi_channel_message_preview')} className="flex gap-1.5">
          {CHANNELS.map(option => (
            <button key={option.id} type="button" aria-pressed={channel === option.id} onClick={() => setChannel(option.id)} className={`${choiceClass(channel === option.id)} px-3 py-1.5 text-xs`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`flex flex-wrap justify-between gap-2 ${MUTED}`}>
        <span>{t('ui_agent_os_channel')} {CHANNELS.find(option => option.id === channel)?.label}</span>
        <span className="text-amber-200">{t('ui_agent_os_preview_only_not_sent')}</span>
      </div>
      <p className="p-4 rounded-xl bg-[#0d1a14]/60 border border-white/[0.06] text-sm text-white/80 leading-relaxed">{preset.channelPreview[channel]}</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        {counts.map(count => (
          <div key={count.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="text-lg font-medium text-white tabular-nums">{count.value}</div>
            <div className="text-xs text-white/60">{count.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** An example advisory workflow over fictional scenarios: choose one, play its steps, preview messages. */
export function AdvisorySimulator() {
  const { t } = useLanguage();
  const [preset, setPreset] = useState<SandboxPreset>(SANDBOX_PRESETS[0]);
  const { progress, running, run } = useSimulation();

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className={`${PANEL_TITLE} flex items-center gap-2`}>
              {t('ui_agent_os_crop_advisory_simulator')}
              <span className="text-xs font-normal px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">{t('ui_agent_os_interactive')}</span>
            </div>
            <div className={MUTED}>{t('ui_agent_os_select_an_example_scenario_no_real_f')}</div>
          </div>
          <button type="button" onClick={run} disabled={running} className={BUTTON_PRIMARY}>
            <Play className="w-4 h-4" aria-hidden="true" />
            {running ? 'Playing simulation…' : 'Run advisory simulation'}
          </button>
        </div>

        <div className="space-y-2">
          <div className={MUTED}>{t('ui_agent_os_select_agronomic_goal_scenario')}</div>
          <div role="group" aria-label={t('ui_agent_os_select_agronomic_goal_scenario')} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SANDBOX_PRESETS.map(option => (
              <button key={option.id} type="button" aria-pressed={preset.id === option.id} onClick={() => setPreset(option)} className={`${choiceClass(preset.id === option.id)} p-3`}>
                <div className="text-xs font-medium leading-tight">{option.title}</div>
                <div className="text-xs text-white/50 mt-1">{option.targetRegion}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0d1a14]/60 border border-white/[0.06] space-y-1.5">
          <div className={`flex flex-wrap justify-between gap-2 ${MUTED}`}>
            <span>{t('ui_agent_os_objective_prompt')}</span>
            <span>{t('ui_agent_os_region', { targetRegion: preset.targetRegion })}</span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{t('ui_agent_os_text', { goalPrompt: preset.goalPrompt })}</p>
        </div>

        <div className="space-y-2">
          <div className={`flex justify-between gap-2 ${MUTED}`}>
            <span>{t('ui_agent_os_illustrative_workflow')}</span>
            <span className="text-emerald-300 tabular-nums" aria-live="polite">{t('ui_agent_os_4_steps_completed', { simProgress: progress })}</span>
          </div>
          <ol className="space-y-2">
            {simulationSteps(preset).map((item, index) => {
              const done = index + 1 <= progress;
              const Icon = done ? CheckCircle2 : Circle;
              return (
                <li key={item.step} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${done ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.06] opacity-60'}`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${done ? 'text-emerald-400' : 'text-white/30'}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white">{item.step}</div>
                    <p className="text-xs text-white/70 mt-0.5 leading-normal break-words">{item.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="space-y-6">
        <GuidanceCard preset={preset} />
        <ChannelPreview preset={preset} />
      </div>
    </div>
  );
}
