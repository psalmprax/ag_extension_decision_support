import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Smartphone,
  Database,
  ArrowLeft,
  Layers,
  Play,
  Activity,
  CheckCircle,
  MapPin,
  Radio,
  Zap,
  Bot,
} from 'lucide-react';
import { CanvasUiLab } from '@/components/canvas-ui/CanvasUiLab';
import { UssdGatewayTester } from '@/components/telecom/UssdGatewayTester';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';

export function DemoPage({
  initialTab = 'scrubber',
}: { initialTab?: 'rag' | 'synthesis' | 'telemetry' | 'canvas' | 'telecom' | 'scrubber' } = {}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'rag' | 'synthesis' | 'telemetry' | 'canvas' | 'telecom' | 'scrubber'>(initialTab);

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

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-stone-950/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-sm text-stone-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="GPExts Logo" className="w-7 h-7 object-contain rounded-lg" />
              <span className="font-bold text-sm tracking-tight">GPExts</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/register')}
            className="px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Interactive Sandbox</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">Experience GPExts</h1>
          <p className="text-stone-400 max-w-lg mx-auto">
            Explore illustrative examples. This sandbox does not retrieve live data, verify sources,
            send messages or create field records.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-8 bg-white/5 p-1.5 rounded-xl border border-white/5 max-w-4xl mx-auto overflow-x-auto">
          {[
            {
              key: 'scrubber' as const,
              icon: Layers,
              label: '3D Agro Scrubber',
              color: 'text-emerald-400',
            },
            { key: 'rag' as const, icon: Brain, label: 'RAG Assistant', color: 'text-purple-400' },
            {
              key: 'synthesis' as const,
              icon: Smartphone,
              label: 'Voice Synthesis',
              color: 'text-sky-400',
            },
            {
              key: 'telemetry' as const,
              icon: Database,
              label: 'Soil Telemetry',
              color: 'text-cyan-400',
            },
            {
              key: 'telecom' as const,
              icon: Radio,
              label: 'USSD & Telecom',
              color: 'text-rose-400',
            },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.key ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-white'
              }`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${tab.color}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-stone-900/60 border border-white/5 rounded-xl p-6 md:p-8">
          {/* Window chrome */}
          <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-6">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-xs font-mono text-stone-500 ml-2">info@gpfed.com</span>
          </div>

          {/* RAG Tab */}
          {activeTab === 'rag' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 block">
                  Select Agronomic Scenario
                </label>
                <div className="grid md:grid-cols-3 gap-3">
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPreset(idx)}
                      className={`p-4 text-xs text-left rounded-xl transition-all border ${
                        selectedPreset === idx
                          ? 'bg-cyan-500/15 border-cyan-400/40 text-white'
                          : 'bg-white/5 border-white/5 text-stone-300 hover:bg-white/10'
                      }`}
                    >
                      {preset.query}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-black/40 border border-white/5 min-h-[200px]">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold font-mono text-stone-400">
                    Example assistant response (scripted)
                  </span>
                </div>

                {selectedPreset === null && (
                  <p className="text-sm text-stone-500 italic">
                    Select a scenario to see a scripted example. No AI or knowledge search is run.
                  </p>
                )}

                {selectedPreset !== null && (
                  <>
                    <p className="text-sm font-mono leading-relaxed whitespace-pre-line text-stone-200">
                      {presets[selectedPreset].response}
                    </p>
                    <p className="mt-4 text-xs text-amber-300">Example only; not a diagnosis or verified advice.</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Synthesis Tab */}
          {activeTab === 'synthesis' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-black/30 border border-white/5 text-center space-y-5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-stone-400">Audio Note Transcript Preview:</span>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md font-mono text-xxs">
                    Scripted example
                  </span>
                </div>
                <p className="text-sm italic text-stone-300 leading-relaxed max-w-lg mx-auto">
                  Example field note: maize leaves show discoloration. Ask a local extension officer
                  to assess the symptoms.
                </p>

                <div className="flex justify-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={triggerAudioPlayback}
                    disabled={isPlayingAudio}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                      isPlayingAudio
                        ? 'bg-amber-500 text-stone-900 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Activity className="w-4 h-4 animate-bounce" /> Playing example...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> Play example text
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={triggerSynthesisToDashboard}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Zap className="w-4 h-4 text-purple-400" /> Preview example summary
                  </button>
                </div>
                {audioError && <p role="alert" className="text-xs text-amber-300">{audioError}</p>}
              </div>

              <AnimatePresence>
                {synthesisOutput && (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-4"
                  >
                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      Example summary (not saved or dispatched)
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-stone-500 font-mono text-xxs uppercase mb-0.5">Farmer</p>
                        <p className="font-semibold">{synthesisOutput.farmer ?? ''}</p>
                      </div>
                      <div>
                        <p className="text-stone-500 font-mono text-xxs uppercase mb-0.5">
                          Observation
                        </p>
                        <p className="font-semibold text-amber-400">
                          {synthesisOutput.status ?? ''}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/30 text-xs text-stone-300 font-mono">
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
                <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-xxs uppercase font-mono text-stone-500 block mb-1">
                    Bulk Density
                  </span>
                  <span className="text-2xl font-bold font-mono text-cyan-400">1.25 kg/dm3</span>
                  <span className="text-xxs text-emerald-400 block mt-1.5">
                    Illustrative value
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-xxs uppercase font-mono text-stone-500 block mb-1">
                    Organic Carbon
                  </span>
                  <span className="text-2xl font-bold font-mono text-amber-400">22 g/kg</span>
                  <span className="text-xxs text-amber-400 block mt-1.5">
                    Illustrative value
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs border-b border-white/5 pb-3">
                  <span className="font-mono text-stone-400">Illustrative telemetry (not live)</span>
                </div>
                <div className="space-y-2 font-mono text-xs-plus text-cyan-400/90 leading-relaxed">
                  {telemetryLogs.map((log, i) => (
                    <p key={i}>{log}</p>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <p className="text-xs text-stone-400">
                  These sample values are not field measurements and are not retrieved from an API.
                </p>
              </div>
            </div>
          )}

          {/* 3D Agro Scrubber Tab */}
          {activeTab === 'scrubber' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Interactive 3D Agro-Intelligence Scrubber
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    Explore an illustrated four-stage concept. No live observations or dispatches are shown.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Illustrative canvas</span>
                </div>
              </div>

              <div className="h-[480px] w-full">
                <AgroEcosystemCanvasScrubber interactive={true} showControls={true} className="w-full h-full" />
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="text-xs font-mono text-sky-400">STAGE 01 // ORBITAL</div>
                  <div className="text-sm font-bold text-white">Atmospheric Flux</div>
                  <p className="text-xs text-stone-400">
                    Example of weather data that could inform a field assessment.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="text-xs font-mono text-emerald-400">STAGE 02 // CANOPY</div>
                  <div className="text-sm font-bold text-white">Multi-Spectral NDVI</div>
                  <p className="text-xs text-stone-400">
                    Example of vegetation indices used to explore crop conditions.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                  <div className="text-xs font-mono text-purple-400">STAGE 03-04 // SYNTHESIS</div>
                  <div className="text-sm font-bold text-white">Edge USSD Uplink</div>
                  <p className="text-xs text-stone-400">
                    Example of how observations and messages might be presented to an officer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Canvas UI Effects Lab Tab */}
          {activeTab === 'canvas' && <CanvasUiLab />}

          {/* Telecom & USSD Simulator Tab */}
          {activeTab === 'telecom' && <UssdGatewayTester />}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-stone-400 text-sm">Ready to use these capabilities in the field?</p>
          <button
            onClick={() => navigate('/register')}
            className="px-6 py-3 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Create Free Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default DemoPage;
