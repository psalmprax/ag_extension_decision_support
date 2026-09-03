import React from 'react';
import { motion } from 'framer-motion';
import { Users, CloudSun, Target, Zap, Sparkles, Radio, CheckCircle2, MessageSquare } from 'lucide-react';
import { stagger, fadeUp } from '../variants';
import { SANDBOX_PRESETS, type SandboxPreset } from '../data';

export type ChannelTab = 'sms' | 'whatsapp' | 'telegram';

export function AgentOS({
  activePreset,
  setActivePreset,
  handleRunSimulation,
  isSimulating,
  simProgress,
  activeChannelTab,
  setActiveChannelTab,
}: {
  activePreset: SandboxPreset;
  setActivePreset: (p: SandboxPreset) => void;
  handleRunSimulation: () => void;
  isSimulating: boolean;
  simProgress: number;
  activeChannelTab: ChannelTab;
  setActiveChannelTab: (c: ChannelTab) => void;
}) {
  return (
        <section id="agent-os" className="relative py-16 sm:py-28 border-t border-white/[0.04] overflow-hidden">
          <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 relative z-10">
            {/* Live Telemetry Ribbons */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-4 shrink-0" />
                <span>Autonomous Agent Fleet: 24/7 Monitoring</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md backdrop-blur-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Radio className="w-3.5 h-3.5 shrink-0" />
                <span>NASA POWER Satellite Stream Synced</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md backdrop-blur-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Closed-Loop Regional Skill Synthesis</span>
              </div>
            </div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-10 sm:mb-16"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-3 sm:mb-4"
              >
                Agentic Extension Decision Architecture
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-2xl sm:text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight leading-tight max-w-xl mx-auto px-2"
              >
                Goal Mode:{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                  Autonomous Agronomic Tele-Advisory
                </span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-xs sm:text-base text-white/60 max-w-2xl mx-auto mt-3 px-2 leading-relaxed"
              >
                Extension directors define high-level agronomic goals. The agent analyzes micro-climates, queries farmer vital scores, injects localized skill cards, dispatches SMS/WhatsApp alerts, and schedules field visits.
              </motion.p>
            </motion.div>

            {/* Interactive Bento Sandbox */}
            <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4 sm:gap-6 items-start">
              {/* Left Column: Interactive Simulation Sandbox */}
              <div className="backdrop-blur-xl bg-slate-900/70 border border-white/[0.1] rounded-xl p-4 sm:p-6 lg:p-8 shadow-2xl shadow-emerald-950/30 space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.08] pb-3 sm:pb-4 gap-3 sm:gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        Live Goal Mode Sandbox
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          Interactive
                        </span>
                      </div>
                      <div className="text-xs text-white/40">Select an objective or run real-time orchestration</div>
                    </div>
                  </div>

                  <button
                    onClick={handleRunSimulation}
                    disabled={isSimulating}
                    className="relative group overflow-hidden w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:via-teal-400 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-2 border border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    <span className="relative z-10 flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${isSimulating ? 'animate-spin' : 'text-amber-300'}`} />
                      <span>{isSimulating ? 'Orchestrating...' : 'Run Simulation'}</span>
                    </span>
                  </button>
                </div>

                {/* Preset Chips */}
                <div className="space-y-2">
                  <div className="text-xxs font-bold uppercase tracking-wider text-white/50">
                    Select Agronomic Goal Scenario:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SANDBOX_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setActivePreset(preset);
                          handleRunSimulation();
                        }}
                        className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${
                          activePreset.id === preset.id
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-md'
                            : 'bg-slate-950/60 border-white/[0.06] text-white/60 hover:border-white/[0.15] hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight line-clamp-2">{preset.title}</div>
                        <div className="text-[10px] text-white/40 mt-1 font-mono">{preset.targetRegion}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goal Prompt Display */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/80 border border-white/[0.08] space-y-1.5 sm:space-y-2">
                  <div className="flex flex-wrap items-center justify-between text-xxs text-emerald-400 font-mono gap-1">
                    <span>OBJECTIVE PROMPT</span>
                    <span>REGION: {activePreset.targetRegion}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-mono break-words">
                    &quot;{activePreset.goalPrompt}&quot;
                  </p>
                </div>

                {/* Execution Trace Stepper */}
                <div className="space-y-2.5">
                  <div className="text-xxs font-bold uppercase tracking-wider text-white/50 flex items-center justify-between">
                    <span>Autonomous Execution Trace</span>
                    <span className="font-mono text-emerald-400">{simProgress}/4 Steps Completed</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { step: '1. Intent & Environmental Sensor Query', detail: `Analyzed weather anomaly for ${activePreset.targetRegion}. Cross-checked SoilGrids telemetry.`, icon: CloudSun },
                      { step: '2. Closed-Loop Skill Synthesis', detail: `Injected local skill: "${activePreset.skillTitle}" (${activePreset.confidence} confidence).`, icon: Sparkles },
                      { step: '3. Precision Cohort Mapping', detail: `Identified ${activePreset.affectedFarmers} vulnerable ${activePreset.targetCrop} farmers with vital scores < 70.`, icon: Users },
                      { step: '4. Multi-Channel Dispatch & Visit Queuing', detail: `Dispatched ${activePreset.alertsDispatched} localized advisories. Queued ${activePreset.visitsQueued} priority field visits.`, icon: Zap },
                    ].map((t, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all duration-300 ${
                          idx + 1 <= simProgress
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-white'
                            : 'bg-slate-950/30 border-white/[0.04] text-white/30 opacity-40'
                        }`}
                      >
                        <t.icon className={`w-4 h-4 mt-0.5 shrink-0 ${idx + 1 <= simProgress ? 'text-emerald-400' : 'text-white/20'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold flex items-center justify-between gap-1">
                            <span>{t.step}</span>
                            {idx + 1 <= simProgress && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xxs text-white/70 mt-0.5 leading-normal break-words">{t.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Multi-Channel Advisory & Skill Cards */}
              <div className="space-y-4 sm:space-y-6">
                {/* Closed-Loop Knowledge Card */}
                <div className="backdrop-blur-xl bg-slate-900/70 border border-white/[0.1] rounded-xl p-4 sm:p-6 shadow-2xl shadow-emerald-950/20 space-y-3 sm:space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="font-bold text-xs text-white">Closed-Loop Regional Skill Card</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                      {activePreset.confidence} Verified
                    </span>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-2">
                    <div className="font-bold text-xs sm:text-sm text-emerald-300">{activePreset.skillTitle}</div>
                    <p className="text-[11px] sm:text-xxs text-white/70 leading-relaxed font-mono break-words">
                      {activePreset.skillBody}
                    </p>
                    <div className="pt-2 border-t border-white/[0.04] flex flex-wrap items-center justify-between text-[9px] font-mono text-white/40 gap-1">
                      <span>SOURCE: FIELD_VISIT_CONSENSUS</span>
                      <span>REGION: {activePreset.targetRegion}</span>
                    </div>
                  </div>
                </div>

                {/* Multi-Channel Message Simulator Card */}
                <div className="backdrop-blur-xl bg-slate-900/70 border border-white/[0.1] rounded-xl p-4 sm:p-6 shadow-2xl shadow-emerald-950/20 space-y-3 sm:space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] pb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-xs text-white">Multi-Channel Advisory Dispatch</span>
                    </div>

                    <div className="flex bg-slate-950 rounded-lg p-0.5 border border-white/[0.06] shrink-0">
                      {(['sms', 'whatsapp', 'telegram'] as const).map(ch => (
                        <button
                          key={ch}
                          onClick={() => setActiveChannelTab(ch)}
                          className={`px-2.5 py-1 rounded text-xxs font-bold uppercase transition-all ${
                            activeChannelTab === ch
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'text-white/40 hover:text-white'
                          }`}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between text-xxs font-mono text-white/40">
                      <span>CHANNEL: {activeChannelTab.toUpperCase()}</span>
                      <span className="text-emerald-400">DISPATCHED (45/45)</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-white/[0.06] text-xs text-white/90 whitespace-pre-line leading-relaxed font-sans break-words">
                      {activePreset.channelPreview[activeChannelTab]}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-xxs font-mono pt-1">
                      <div className="p-2 rounded-lg bg-slate-900/50 border border-white/[0.04]">
                        <div className="text-emerald-400 font-bold">{activePreset.affectedFarmers}</div>
                        <div className="text-[9px] text-white/40">Farmers</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/50 border border-white/[0.04]">
                        <div className="text-amber-400 font-bold">{activePreset.alertsDispatched}</div>
                        <div className="text-[9px] text-white/40">Alerts</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/50 border border-white/[0.04]">
                        <div className="text-sky-400 font-bold">{activePreset.visitsQueued}</div>
                        <div className="text-[9px] text-white/40">Visits Queued</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
  );
}
