import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Smartphone,
  Database,
  ArrowLeft,
  Play,
  Activity,
  CheckCircle,
  MapPin,
  Radio,
  Zap,
  Bot,
} from 'lucide-react';
import { UssdGatewayTester } from '@/components/telecom/UssdGatewayTester';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';
import { useLanguage } from '@/lib/LanguageContext';
import { tabButtonClass } from '@/components/ui/controlStyles';

export function DemoPage({
  initialTab = 'scrubber',
}: { initialTab?: 'rag' | 'synthesis' | 'telemetry' | 'telecom' | 'scrubber' } = {}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'rag' | 'synthesis' | 'telemetry' | 'telecom' | 'scrubber'>(initialTab);

  // RAG states
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  // Audio synthesis states
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [synthesisOutput, setSynthesisOutput] = useState<{
    farmer?: string;
    status?: string;
    action?: string;
    crop?: string;
  } | null>(null);

  // Telemetry
  const telemetryLogs = [
    'Example: weather and soil observations may be displayed here.',
    'Example: field visits may be synchronized when connectivity is available.',
  ];

  const presets = [
    {
      query: 'How do I diagnose and treat Maize Rust?',
      response:
        'Leaf spots may have several causes. Record the affected crop, symptoms and location, then consult a local extension officer to confirm the cause and discuss locally authorized options.',
    },
    {
      query: 'Recommend soil recovery plan for high acidity (pH 4.8).',
      response:
        'A soil test can help assess acidity. Ask a local soil specialist to interpret the results and recommend amendments appropriate to the crop and field.',
    },
    {
      query: 'What is the rainfall forecast impact on Cassava planting in Eastern region?',
      response:
        'Planting decisions depend on the location, forecast and field conditions. Check an up-to-date local forecast and consult an extension officer before planting.',
    },
  ];

  const triggerAudioPlayback = () => {
    if (isPlayingAudio) return;
    setAudioError('');

    const noteText =
      'Example field note: maize leaves show discoloration. Ask a local extension officer to assess the symptoms.';

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsPlayingAudio(true);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(noteText);
      utterance.rate = 0.95;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setAudioError('Speech playback failed in this browser.');
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setAudioError('Speech playback is not available in this browser.');
    }
  };

  const triggerSynthesisToDashboard = () => {
    setSynthesisOutput({
      crop: 'Maize',
      status: 'Discoloration reported; cause unconfirmed',
      farmer: 'Example farmer',
      action: 'Example only: consult a local extension officer. No record or message was sent.',
    });
  };

  const tabs = [
    { key: 'scrubber' as const, icon: MapPin, label: t('demo_tab_farm_map', { defaultValue: 'Farm map' }) },
    { key: 'rag' as const, icon: Brain, label: t('demo_tab_ask', { defaultValue: 'Ask a question' }) },
    { key: 'synthesis' as const, icon: Smartphone, label: t('demo_tab_voice', { defaultValue: 'Voice advice' }) },
    { key: 'telemetry' as const, icon: Database, label: t('demo_tab_soil', { defaultValue: 'Soil readings' }) },
    { key: 'telecom' as const, icon: Radio, label: t('demo_tab_ussd', { defaultValue: 'SMS & USSD' }) },
  ];

  return (
    <div className="dark surface-dark min-h-screen bg-[#0d1a14] text-[#e6eee9]">
      <nav className="sticky top-0 z-50 bg-[#0d1a14]/90 backdrop-blur border-b border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 h-9 px-2 rounded-md text-sm text-[#9db2a6] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t('common_back')}
            </button>
            <div className="w-px h-5 bg-white/[0.12]" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
              <span className="text-base font-medium text-white">{t('app_title')}</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/register')}
            className="h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
          >
            {t('ui_demo_page_get_started')}
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-medium leading-tight text-white">{t('ui_demo_page_experience_gpexts')}</h1>
          <p className="mt-3 text-base text-[#c5d3cb]">{t('ui_demo_page_explore_illustrative_examples_this_s')}</p>
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label={t('demo_tabs_label', { defaultValue: 'Examples' })}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={tabButtonClass(activeTab === tab.key)}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-5 sm:p-8">
          {/* RAG Tab */}
          {activeTab === 'rag' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-[#9db2a6] mb-3 block">
                  {t('ui_demo_page_select_agronomic_scenario')}
                </label>
                <div className="grid md:grid-cols-3 gap-3">
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPreset(idx)}
                      className={`p-4 text-xs text-start rounded-lg transition-all border ${
                        selectedPreset === idx
                          ? 'bg-slate-500/15 border-slate-400/40 text-white'
                          : 'bg-white/[0.04] border-white/[0.08] text-[#c5d3cb] hover:bg-white/10'
                      }`}
                    >
                      {preset.query}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-lg bg-white/[0.03] border border-white/[0.08] min-h-[200px]">
                <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 mb-4">
                  <Bot className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-[#9db2a6]">
                    {t('ui_demo_page_example_assistant_response_scripted')}
                  </span>
                </div>

                {selectedPreset === null && (
                  <p className="text-sm text-[#9db2a6] ">
                    {t('ui_demo_page_select_a_scenario_to_see_a_scripted')}
                  </p>
                )}

                {selectedPreset !== null && (
                  <>
                    <p className="text-sm leading-relaxed whitespace-pre-line text-[#e6eee9]">
                      {presets[selectedPreset].response}
                    </p>
                    <p className="mt-4 text-xs text-amber-300">{t('ui_demo_page_example_only_not_a_diagnosis_or_veri')}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Synthesis Tab */}
          {activeTab === 'synthesis' && (
            <div className="space-y-6">
              <div className="p-5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-center space-y-5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#9db2a6]">{t('ui_demo_page_audio_note_transcript_preview')}</span>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md text-xs">
                    {t('ui_demo_page_scripted_example')}
                  </span>
                </div>
                <p className="text-sm text-[#c5d3cb] leading-relaxed max-w-lg mx-auto">
                  {t('ui_demo_page_example_field_note_maize_leaves_show')}
                </p>

                <div className="flex justify-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={triggerAudioPlayback}
                    disabled={isPlayingAudio}
                    className={`px-5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer transition-all ${
                      isPlayingAudio
                        ? 'bg-emerald-800 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Activity className="w-4 h-4" aria-hidden="true" /> {t('ui_demo_page_playing_example')}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> {t('ui_demo_page_play_example_text')}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={triggerSynthesisToDashboard}
                    className="px-5 py-2.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/10 hover:bg-white/10 text-white flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Zap className="w-4 h-4 text-slate-400" /> {t('ui_demo_page_preview_example_summary')}
                  </button>
                </div>
                {audioError && <p role="alert" className="text-xs text-amber-300">{audioError}</p>}
              </div>

              <AnimatePresence>
                {synthesisOutput && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-4"
                  >
                    <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      {t('ui_demo_page_example_summary_not_saved_or_dispatc')}
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-[#9db2a6] text-xs mb-0.5">{t('register_role_farmer')}</p>
                        <p className="font-medium">{synthesisOutput.farmer ?? ''}</p>
                      </div>
                      <div>
                        <p className="text-[#9db2a6] text-xs mb-0.5">
                          {t('ui_demo_page_observation')}
                        </p>
                        <p className="font-medium text-amber-400">
                          {synthesisOutput.status ?? ''}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] text-xs text-[#c5d3cb] font-mono">
                      {synthesisOutput.action ?? ''}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Telemetry Tab */}
          {activeTab === 'telemetry' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-xs text-[#9db2a6] block mb-1">
                    {t('ui_demo_page_bulk_density')}
                  </span>
                  <span className="text-2xl font-medium text-slate-400">1.25 kg/dm3</span>
                  <span className="text-xs text-emerald-400 block mt-1.5">
                    {t('ui_demo_page_illustrative_value')}
                  </span>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  <span className="text-xs text-[#9db2a6] block mb-1">
                    {t('ui_demo_page_organic_carbon')}
                  </span>
                  <span className="text-2xl font-medium text-amber-400">22 g/kg</span>
                  <span className="text-xs text-amber-400 block mt-1.5">
                    {t('ui_demo_page_illustrative_value')}
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="flex justify-between items-center text-xs border-b border-white/[0.08] pb-3">
                  <span className="text-[#9db2a6]">{t('ui_demo_page_illustrative_telemetry_not_live')}</span>
                </div>
                <div className="space-y-2 text-sm text-slate-400/90 leading-relaxed">
                  {telemetryLogs.map((log, i) => (
                    <p key={i}>{log}</p>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-500/5 border border-slate-500/10">
                <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <p className="text-xs text-[#9db2a6]">
                  {t('ui_demo_page_these_sample_values_are_not_field_me')}
                </p>
              </div>
            </div>
          )}

          {/* 3D Agro Scrubber Tab */}
          {activeTab === 'scrubber' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
                <div>
                  <h2 className="text-lg font-medium text-white">
                    {t('ui_demo_page_interactive_3d_agro_intelligence_scr')}
                  </h2>
                  <p className="text-xs text-[#9db2a6] mt-1">
                    {t('ui_demo_page_explore_an_illustrated_four_stage_co')}
                  </p>
                </div>
              </div>

              <div className="h-[380px] sm:h-[480px] w-full rounded-md overflow-hidden">
                <AgroEcosystemCanvasScrubber interactive={true} showControls={true} className="w-full h-full" />
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-white/[0.04] border border-white/[0.08] space-y-1">
                  <div className="text-xs text-[#9db2a6]">{t('ui_demo_page_stage_01_orbital')}</div>
                  <div className="text-sm font-medium text-white">{t('ui_demo_page_atmospheric_flux')}</div>
                  <p className="text-xs text-[#9db2a6]">
                    {t('ui_demo_page_example_of_weather_data_that_could_i')}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-white/[0.04] border border-white/[0.08] space-y-1">
                  <div className="text-xs text-[#9db2a6]">{t('ui_demo_page_stage_02_canopy')}</div>
                  <div className="text-sm font-medium text-white">{t('ui_demo_page_multi_spectral_ndvi')}</div>
                  <p className="text-xs text-[#9db2a6]">
                    {t('ui_demo_page_example_of_vegetation_indices_used_t')}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-white/[0.04] border border-white/[0.08] space-y-1">
                  <div className="text-xs text-[#9db2a6]">{t('ui_demo_page_stage_03_04_synthesis')}</div>
                  <div className="text-sm font-medium text-white">{t('ui_demo_page_edge_ussd_uplink')}</div>
                  <p className="text-xs text-[#9db2a6]">
                    {t('ui_demo_page_example_of_how_observations_and_mess')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Telecom & USSD Simulator Tab */}
          {activeTab === 'telecom' && <UssdGatewayTester />}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-[#9db2a6] text-sm">{t('ui_demo_page_ready_to_use_these_capabilities_in_t')}</p>
          <button
            onClick={() => navigate('/register')}
            className="h-12 px-6 text-base font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
          >
            {t('ui_demo_page_create_free_account')}
          </button>
        </div>
      </main>
    </div>
  );
}

export default DemoPage;
