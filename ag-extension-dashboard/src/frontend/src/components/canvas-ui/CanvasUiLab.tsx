import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Compass,
  Zap,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { LiquidCanvas } from './LiquidCanvas';
import { RefractiveGlassCard } from './RefractiveGlassCard';
import { TelemetryRadarCanvas } from './TelemetryRadarCanvas';
import { LuminousForceField } from './LuminousForceField';

export const CanvasUiLab: React.FC = () => {
  const [selectedEffect, setSelectedEffect] = useState<'liquid' | 'glass' | 'radar' | 'forcefield'>('liquid');
  const [fluidColor, setFluidColor] = useState('#059669');
  const [tiltIntensity, setTiltIntensity] = useState(20);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Canvas UI & Shader Effects Lab (Test Environment)
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            GPU-accelerated interactive canvas shaders and glassmorphic cards for GPExts.
          </p>
        </div>

        {/* Effect Selector */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
          {[
            { id: 'liquid' as const, label: 'Liquid Fluid', icon: Layers },
            { id: 'glass' as const, label: 'Refractive Glass', icon: Compass },
            { id: 'radar' as const, label: 'Telemetry Radar', icon: Cpu },
            { id: 'forcefield' as const, label: 'Force Field Aura', icon: Zap },
          ].map(effect => (
            <button
              key={effect.id}
              onClick={() => setSelectedEffect(effect.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEffect === effect.id
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <effect.icon className="w-3.5 h-3.5" />
              <span>{effect.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Playground Area */}
      <div className="relative min-h-[360px] rounded-2xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center p-8">
        {/* Effect 1: Liquid Fluid Shader */}
        {selectedEffect === 'liquid' && (
          <div className="relative w-full h-full min-h-[320px] flex flex-col items-center justify-center text-center">
            <LiquidCanvas color={fluidColor} secondaryColor="#0d9488" opacity={0.7} />
            <div className="relative z-10 max-w-md p-6 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-md">
              <span className="px-2.5 py-1 rounded-full text-xxs font-mono uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2 inline-block">
                Move Cursor / Touch Screen
              </span>
              <h4 className="text-xl font-bold text-white mb-2">Organic Liquid Canopy</h4>
              <p className="text-xs text-stone-300 mb-4 leading-relaxed">
                Physics-based fluid meta-balls morph in real time and gravitate towards pointer coordinates.
              </p>
              <div className="flex items-center justify-center gap-2">
                {['#059669', '#0284c7', '#7c3aed', '#ea580c'].map(c => (
                  <button
                    key={c}
                    onClick={() => setFluidColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      fluidColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Effect 2: Refractive Glass Card */}
        {selectedEffect === 'glass' && (
          <div className="w-full max-w-lg">
            <RefractiveGlassCard intensity={tiltIntensity} className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-xxs font-mono uppercase text-emerald-400 tracking-wider">
                    3D Perspective Tilt & Specular Glare
                  </span>
                  <h4 className="text-2xl font-bold text-white mt-1">Field Diagnostic Scan #8492</h4>
                </div>
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-3 text-xs text-stone-300 mb-6">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-stone-400">Target Crop:</span>
                  <span className="font-semibold text-white">Arabica Coffee (Kiambu)</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-stone-400">Pathology Diagnosis:</span>
                  <span className="font-semibold text-amber-400">Coffee Leaf Rust (12% incidence)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Multimodal Confidence:</span>
                  <span className="font-semibold text-emerald-400">96.4% Verified</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xxs text-stone-400">
                <Sliders className="w-3.5 h-3.5" />
                <span>Tilt Intensity:</span>
                <input
                  type="range"
                  min="5"
                  max="35"
                  value={tiltIntensity}
                  onChange={e => setTiltIntensity(Number(e.target.value))}
                  className="w-28 accent-emerald-500"
                />
                <span>{tiltIntensity}°</span>
              </div>
            </RefractiveGlassCard>
          </div>
        )}

        {/* Effect 3: Telemetry Radar */}
        {selectedEffect === 'radar' && (
          <div className="relative w-full h-full min-h-[320px] flex items-center justify-center">
            <TelemetryRadarCanvas particleCount={40} sweepSpeed={0.02} />
            <div className="relative z-10 p-6 rounded-2xl bg-black/60 border border-cyan-500/30 backdrop-blur-md max-w-sm text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xxs font-mono uppercase mb-3">
                <Cpu className="w-3.5 h-3.5 animate-spin" />
                NASA POWER & SoilGrids Stream
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Orbital Telemetry Sweep</h4>
              <p className="text-xs text-stone-300">
                Simulates real-time satellite data point sweeps, connecting 12 regional East African extension hubs.
              </p>
            </div>
          </div>
        )}

        {/* Effect 4: Luminous Force Field */}
        {selectedEffect === 'forcefield' && (
          <div className="w-full max-w-md">
            <LuminousForceField glowColor="#10b981">
              <div className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-full text-xxs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Pro Plan Highlight
                  </span>
                  <span className="text-2xl font-black text-white">$29<span className="text-xs font-normal text-stone-400">/mo</span></span>
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Extension Officer Pro</h4>
                <p className="text-xs text-stone-300 mb-6 leading-relaxed">
                  Hover anywhere around the card to see the reactive edge lighting aura follow your mouse in real time.
                </p>
                <div className="space-y-2 mb-6 text-xs text-stone-200">
                  {['Unlimited Knowledge Base Queries', '500 Outbound SMS & Alerts', '100 AI Photo Leaf Scans'].map((perk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 cursor-pointer">
                  Select Pro Subscription
                </button>
              </div>
            </LuminousForceField>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasUiLab;
