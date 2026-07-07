import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Leaf,
  Brain,
  Smartphone,
  Database,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Layers,
  Play,
  Activity,
  CheckCircle,
  MapPin,
} from 'lucide-react';

export function DemoPage({
  initialTab = 'rag',
}: { initialTab?: 'rag' | 'synthesis' | 'telemetry' } = {}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'rag' | 'synthesis' | 'telemetry'>(initialTab);

  // RAG states
  const [isTyping, setIsTyping] = useState(false);
  const [ragStep, setRagStep] = useState(0);
  const [simulatedResponse, setSimulatedResponse] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  // Audio synthesis states
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisOutput, setSynthesisOutput] = useState<{
    farmer?: string;
    status?: string;
    action?: string;
    crop?: string;
  } | null>(null);

  // Telemetry
  const [telemetryLogs] = useState([
    '[15:47:01] Fetching NASA POWER Solar Radiation data... OK',
    '[15:47:02] SoilGrids v2: Clay density (fine earth) = 380 g/kg',
    '[15:47:04] Fetching current precipitation coefficients... 4.2mm/day',
    '[15:47:05] Synced 4 offline field visits to main extension store',
  ]);

  const presets = [
    {
      query: 'How do I diagnose and treat Maize Rust?',
      response:
        'Common Maize Rust (Puccinia sorghi) is recognized by powdery golden-brown pustules on both leaf surfaces.\n\nTreatment: Apply triazole or strobilurin-based fungicides if incidence levels exceed 10% before silking.\n\nCultural practices: Rotate crops with non-gramineous hosts like soybeans, and manage soil nitrogen balance.',
      citations: ['FAO Technical Note 28B', 'NASA POWER Weather Index', 'IITA Diagnostic Manual'],
    },
    {
      query: 'Recommend soil recovery plan for high acidity (pH 4.8).',
      response:
        'A pH of 4.8 indicates severe acidity causing aluminum toxicity.\n\nRecovery Plan: 1. Apply calcitic or dolomitic agricultural lime at 2.5 tonnes/ha. 2. Incorporate green manure (e.g. Mucuna pruriens) to increase organic matter. 3. Transition to acid-tolerant cultivars (e.g., specific cassava clones or finger millet).',
      citations: [
        'Sub-Saharan SoilGrids v2',
        'IFDC Fertilizer Strategy Report',
        'CIMMYT Crop Guide',
      ],
    },
    {
      query: 'What is the rainfall forecast impact on Cassava planting in Eastern region?',
      response:
        'NASA POWER model indicates a delayed start to the wet season. Soil moisture saturation currently stands at 22% (Moderate deficit).\n\nActionable Advice: Delay cassava planting by 10-14 days. Treat cuttings with agricultural ash to protect against early stem rot. Prioritize micro-dosing phosphorus during planting.',
      citations: ['NASA POWER satellite models', 'FAOSTAT Saturation Indices'],
    },
  ];

  const runRagSimulation = async (index: number) => {
    if (isTyping) return;
    setSelectedPreset(index);
    setIsTyping(true);
    setSimulatedResponse('');

    setRagStep(1);
    await new Promise(r => setTimeout(r, 900));

    setRagStep(2);
    await new Promise(r => setTimeout(r, 800));

    setRagStep(3);
    const full = presets[index].response;
    let typed = '';
    for (let i = 0; i < full.length; i += 3) {
      typed += full.substring(i, i + 3);
      setSimulatedResponse(typed);
      await new Promise(r => setTimeout(r, 15));
    }
    setIsTyping(false);
  };

  const triggerAudioSynthesis = async () => {
    if (isSynthesizing) return;
    setIsPlayingAudio(true);
    await new Promise(r => setTimeout(r, 3000));
    setIsPlayingAudio(false);
    setIsSynthesizing(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsSynthesizing(false);
    setSynthesisOutput({
      crop: 'Maize & Beans',
      status: 'Alert (Nitrogen Deficit)',
      farmer: 'Emmanuel Mwangi (Machakos)',
      action:
        'Dispatched automated SMS recommendation: "Apply top-dressing nitrogen urea fertilizer before next Tuesday rains."',
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
              <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm">AgExtension</span>
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Interactive Sandbox</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Experience AgExtension</h1>
          <p className="text-stone-400 max-w-lg mx-auto">
            Explore the AI-powered capabilities that help agricultural extension officers make
            data-driven decisions in the field.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-8 bg-white/5 p-1.5 rounded-xl border border-white/5 max-w-xl mx-auto">
          {[
            { key: 'rag' as const, icon: Brain, label: 'RAG Assistant', color: 'text-purple-400' },
            {
              key: 'synthesis' as const,
              icon: Smartphone,
              label: 'Voice Synthesis',
              color: 'text-emerald-400',
            },
            {
              key: 'telemetry' as const,
              icon: Database,
              label: 'Soil Telemetry',
              color: 'text-cyan-400',
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
        <div className="bg-stone-900/60 border border-white/5 rounded-2xl p-6 md:p-8">
          {/* Window chrome */}
          <div className="flex items-center gap-2 pb-4 border-b border-white/5 mb-6">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-xs font-mono text-stone-500 ml-2">sandbox@agextension.io</span>
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
                      onClick={() => runRagSimulation(idx)}
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
                  <Sparkles className="w-4 h-4 text-purple-400 animate-spin-slow" />
                  <span className="text-xs font-bold font-mono text-stone-400">
                    RAG v2 Assistant Response
                  </span>
                </div>

                {ragStep === 0 && (
                  <p className="text-sm text-stone-500 italic">
                    Click one of the scenarios above to see the AI assistant retrieve and synthesize
                    agronomic knowledge in real time.
                  </p>
                )}

                {ragStep === 1 && (
                  <div className="flex items-center gap-2 text-sm text-cyan-400 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Parsing Query Graph & Searching FAO Soil Knowledge Store...
                  </div>
                )}

                {ragStep === 2 && (
                  <div className="flex items-center gap-2 text-sm text-purple-400 animate-pulse">
                    <Layers className="w-4 h-4 animate-bounce" />
                    Retrieving RAG Vector Fragments & Index Rankings...
                  </div>
                )}

                {ragStep === 3 && (
                  <>
                    <p className="text-sm font-mono leading-relaxed whitespace-pre-line text-stone-200">
                      {simulatedResponse}
                      {isTyping && <span className="animate-pulse">|</span>}
                    </p>

                    {!isTyping && selectedPreset !== null && (
                      <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex flex-wrap gap-2">
                          {presets[selectedPreset].citations.map((cite, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-md bg-white/5 text-xxs font-mono text-stone-400 border border-white/5"
                            >
                              {cite}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Source Verified
                        </span>
                      </div>
                    )}
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
                  <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full font-mono text-xxs">
                    Offline Recorded
                  </span>
                </div>
                <p className="text-sm italic text-stone-300 leading-relaxed max-w-lg mx-auto">
                  "Checked Emmanuel Mwangi's farm in Machakos. The beans look stable, but the maize
                  leaves show significant light green discoloration. Recommended immediate check for
                  nitrogen deficit. Dispatched a guidance advice to prepare fertilizer dressings."
                </p>

                <div className="flex justify-center gap-3 flex-wrap">
                  <button
                    onClick={triggerAudioSynthesis}
                    disabled={isPlayingAudio || isSynthesizing}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      isPlayingAudio
                        ? 'bg-yellow-500 text-stone-900 animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Activity className="w-4 h-4 animate-bounce" /> Playing Recorded Note...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> Play Recorded Note
                      </>
                    )}
                  </button>
                  <button
                    onClick={triggerAudioSynthesis}
                    disabled={isPlayingAudio || isSynthesizing}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center gap-2"
                  >
                    {isSynthesizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Synthesizing Insights...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-purple-400" /> Synthesize to Dashboard
                      </>
                    )}
                  </button>
                </div>
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
                      Synthesized Visit Entry Dispatched to Dashboard
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-stone-500 font-mono text-xxs uppercase mb-0.5">Farmer</p>
                        <p className="font-semibold">{synthesisOutput.farmer ?? ''}</p>
                      </div>
                      <div>
                        <p className="text-stone-500 font-mono text-xxs uppercase mb-0.5">
                          Soil Assessment
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
                    Optimal aeration tier
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-xxs uppercase font-mono text-stone-500 block mb-1">
                    Organic Carbon
                  </span>
                  <span className="text-2xl font-bold font-mono text-amber-400">22 g/kg</span>
                  <span className="text-xxs text-amber-400 block mt-1.5">
                    Slight deficit (Target: 30)
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs border-b border-white/5 pb-3">
                  <span className="font-mono text-stone-400">NASA POWER Live Stream Data</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
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
                  Data sourced from NASA POWER, SoilGrids v2, and FAOSTAT APIs. All metrics are
                  region-specific and updated in real time when connected.
                </p>
              </div>
            </div>
          )}
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
