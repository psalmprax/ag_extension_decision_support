import React from 'react';
import { Droplets, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { triggerHaptic } from '@/lib/haptics';

interface LiquidToggleSwitchProps {
  className?: string;
  compact?: boolean;
}

export const LiquidToggleSwitch: React.FC<LiquidToggleSwitchProps> = ({
  className = '',
  compact = false,
}) => {
  const { liquidEffect, toggleLiquidEffect } = useAppStore();

  const handleToggle = () => {
    triggerHaptic('light');
    toggleLiquidEffect();
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={liquidEffect ? 'Liquid Background: Active (Click to disable)' : 'Liquid Background: Disabled (Click to enable)'}
        className={`relative p-2 rounded-xl border transition-all duration-300 active:scale-95 flex items-center justify-center ${
          liquidEffect
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
            : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/80'
        } ${className}`}
      >
        <Droplets className={`w-4 h-4 ${liquidEffect ? 'animate-pulse' : ''}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`group relative flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-300 active:scale-95 shadow-sm ${
        liquidEffect
          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
          : 'bg-slate-900/60 border-white/10 text-white/50 hover:text-white hover:border-white/20'
      } ${className}`}
    >
      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
        liquidEffect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'
      }`}>
        <Droplets className={`w-3 h-3 ${liquidEffect ? 'animate-pulse' : ''}`} />
      </div>

      <span className="font-headline tracking-wide">
        Liquid Fluid: <strong className={liquidEffect ? 'text-emerald-400' : 'text-white/40'}>{liquidEffect ? 'ON' : 'OFF'}</strong>
      </span>

      {/* Switch pill indicator */}
      <div className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
        liquidEffect ? 'bg-emerald-500 justify-end' : 'bg-slate-800 border border-white/10 justify-start'
      }`}>
        <div className={`w-3 h-3 rounded-full bg-white shadow-md transition-all ${
          liquidEffect ? 'bg-slate-950 scale-105' : 'bg-white/40'
        }`} />
      </div>
    </button>
  );
};

export default LiquidToggleSwitch;
