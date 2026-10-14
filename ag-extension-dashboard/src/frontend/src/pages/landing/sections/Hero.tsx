import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { GlobalConstellationVisualization } from '@/components/landing/Visuals';
import {
  Camera, Leaf, ArrowRight, Play, CheckCircle2,
  Volume2, CloudRain, ShieldCheck, ChevronDown,
  AlertCircle, Droplets, Radio,
} from 'lucide-react';
import { stagger, fadeUp, scaleIn } from '../variants';
import { globalTelemetryNodes } from '../data';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function Hero({ heroY, heroOpacity }: { heroY: MotionValue<number>; heroOpacity: MotionValue<number> }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [activeRemedyTab, setActiveRemedyTab] = useState<'organic' | 'standard'>('organic');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const toggleAudio = () => {
    setIsPlayingAudio(prev => !prev);
  };

  return (
    <section className="relative min-h-screen flex items-start sm:items-center pt-20 sm:pt-24 pb-12 sm:pb-20 overflow-hidden">
      {/* Authentic Agricultural Partnership Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/officer-farmer-hero.webp"
          srcSet="/images/landing/officer-farmer-hero-640.webp 640w, /images/landing/officer-farmer-hero-1024.webp 1024w, /images/landing/officer-farmer-hero.webp 1920w"
          sizes="(max-width: 640px) 640px, (max-width: 1100px) 1024px, 1920px"
          alt="Farmer checking crop health in a green field"
          width={1920}
          height={1080}
          className="w-full h-full object-cover object-center opacity-20 mix-blend-luminosity scale-105 filter saturate-125 transition-opacity duration-700"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/90 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/60 to-slate-950" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-outline) 1px, transparent 1px), linear-gradient(90deg, var(--color-outline) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Global Constellation Visualization */}
      <GlobalConstellationVisualization nodes={globalTelemetryNodes} />

      <motion.div
        style={reduceMotion ? undefined : { y: heroY, opacity: heroOpacity }}
        className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center relative z-10"
      >
        {/* Left column — Farmer-Friendly Value Proposition */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 sm:space-y-8 text-center sm:text-left mx-auto sm:mx-0 min-w-0 max-w-full">
          {/* Badge */}
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-md shadow-sm max-w-full mx-auto sm:mx-0 overflow-hidden"
          >
            <Leaf className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-300">
              Free Smart Farming &amp; Pocket Crop Doctor
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-3xl sm:text-5xl lg:text-[3.6rem] font-extrabold leading-[1.12] sm:leading-[1.08] tracking-tight text-white"
          >
            Heal Your Crops.
            <br />
            Protect Your Harvest.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-300 bg-clip-text text-transparent">
              Grow With Confidence.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="text-sm sm:text-base lg:text-lg text-white/80 leading-relaxed max-w-xl mx-auto sm:mx-0 font-normal"
          >
            Point your phone camera at any sick leaf, stem, or pest for instant 3-second diagnosis, affordable organic remedies, and rain warnings — works 100% offline in your local language.
          </motion.p>

          {/* 4 Farmer Benefit Signifiers */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2.5 sm:gap-3 max-w-xl mx-auto sm:mx-0">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate">3-Sec Leaf Scan</div>
                <div className="text-xxs sm:text-xs text-white/60 truncate">Spots 120+ pests &amp; blights</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                <CloudRain className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate">Rain Forecasts</div>
                <div className="text-xxs sm:text-xs text-white/60 truncate">Avoid fertilizer wash-off</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate">Works 100% Offline</div>
                <div className="text-xxs sm:text-xs text-white/60 truncate">Zero cell signal required</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Volume2 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white truncate">Audio in Local Dialect</div>
                <div className="text-xxs sm:text-xs text-white/60 truncate">Swahili, Luganda, Hindi +20</div>
              </div>
            </div>
          </motion.div>

          {/* Action CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/diagnosis')}
              className="w-full sm:w-auto relative group overflow-hidden px-8 py-3.5 text-sm sm:text-base font-bold text-white rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 border border-emerald-400/50 shadow-[0_0_28px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2.5"
            >
              <Camera className="w-5 h-5 text-emerald-100" />
              <span>Diagnose a Crop Free</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/demo')}
              className="w-full sm:w-auto group px-7 py-3.5 text-sm sm:text-base font-semibold bg-white/[0.06] border border-white/[0.12] text-white/90 rounded-xl hover:bg-white/[0.12] hover:text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              <Play className="w-4 h-4 text-emerald-400" />
              <span>Try Live Demo</span>
            </button>
          </motion.div>

          {/* Secondary Institutional Bridge for Officers & Ministries */}
          <motion.div
            variants={fadeUp}
            className="p-3.5 sm:p-4 rounded-xl bg-white/[0.025] border border-white/[0.06] backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-xl text-left"
          >
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Are you an Extension Officer or Ministry?
              </span>
              <p className="text-xxs sm:text-xs text-white/60 leading-snug">
                Manage thousands of farmers across districts with offline GPS visit logs and pest heatmaps.
              </p>
            </div>
            <a
              href="#features"
              className="text-xs font-bold text-emerald-300 hover:text-emerald-200 underline whitespace-nowrap py-1"
            >
              Explore Organization Tools →
            </a>
          </motion.div>
        </motion.div>

        {/* Right column — Plantix-Style Smartphone Leaf Scanner Mockup */}
        <motion.div initial="hidden" animate="visible" variants={scaleIn} className="relative w-full max-w-full flex justify-center">
          {/* Ambient emerald backlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/25 via-emerald-600/10 to-amber-500/15 blur-[80px] rounded-full scale-95 pointer-events-none" />

          {/* Smartphone Chassis */}
          <div className="relative w-full max-w-[370px] sm:max-w-[400px] rounded-[2.8rem] p-3.5 bg-slate-900/90 border-4 border-slate-700/60 shadow-2xl shadow-emerald-950/60 ring-1 ring-white/10 backdrop-blur-xl transition-transform duration-500 hover:scale-[1.01]">
            {/* Top speaker & camera bezel */}
            <div className="w-28 h-4 bg-slate-950 rounded-full mx-auto mb-2 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-800" />
              <div className="w-10 h-1 bg-slate-800 rounded-full" />
            </div>

            {/* Smartphone Display */}
            <div className="rounded-[2.2rem] overflow-hidden bg-slate-950 border border-white/10 relative flex flex-col text-left">
              {/* Phone Status Bar */}
              <div className="flex justify-between items-center px-5 pt-2 pb-1.5 text-[10px] text-white/60 font-mono bg-slate-950/90 border-b border-white/5">
                <span>09:41</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-semibold">100% Offline Ready</span>
                </div>
              </div>

              {/* Crop Doctor App Header inside Phone */}
              <div className="px-4 py-2.5 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">GPExts Crop Doctor</div>
                    <div className="text-[9px] text-emerald-300/80 font-mono">Maize (Zea mays) • Field Plot 2</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleAudio}
                  aria-label={isPlayingAudio ? 'Mute audio advisory' : 'Play audio advisory in local language'}
                  className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                    isPlayingAudio
                      ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-semibold">{isPlayingAudio ? 'Playing' : 'Audio'}</span>
                </button>
              </div>

              {/* Camera Leaf Viewfinder */}
              <div className="relative h-[210px] sm:h-[230px] w-full overflow-hidden bg-slate-900">
                <img
                  src="/images/landing/persona-officer.webp"
                  alt="Close-up of diagnosed crop leaf"
                  className="w-full h-full object-cover object-center filter saturate-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

                {/* Animated laser scanning line */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />

                {/* Diagnostic Bounding Reticle */}
                <div className="absolute top-8 left-10 sm:left-14 w-40 h-28 border-2 border-emerald-400/90 rounded-xl bg-emerald-500/10 flex flex-col justify-between p-2 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-mono font-bold text-emerald-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-emerald-400/30">
                      INFESTATION ZONE
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  </div>
                  <div className="bg-slate-950/90 backdrop-blur-md rounded-lg p-1.5 border border-emerald-400/40 text-left">
                    <div className="text-[10px] font-bold text-white flex items-center gap-1">
                      <span>🐛 Fall Armyworm</span>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="text-[9px] text-emerald-400 font-semibold font-mono">98.4% Confidence Match</div>
                  </div>
                </div>

                {/* Floating GPS Location Tag */}
                <div className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-mono text-white/80 border border-white/10">
                  📍 Meru District • Lat -0.046, Lng 37.655
                </div>
              </div>

              {/* Diagnosis & Actionable Treatment Card */}
              <div className="p-4 bg-slate-900/95 border-t border-white/10 space-y-3">
                {/* Result header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold block">
                      Immediate Action Required
                    </span>
                    <h3 className="text-sm font-bold text-white">Fall Armyworm (Spodoptera)</h3>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Moderate Severity
                  </span>
                </div>

                {/* Remedy Tabs Switcher */}
                <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveRemedyTab('organic')}
                    className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                      activeRemedyTab === 'organic'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    🌿 Organic Remedy
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRemedyTab('standard')}
                    className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                      activeRemedyTab === 'standard'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    🧪 Bio-Control Medicine
                  </button>
                </div>

                {/* Remedy Content */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/80 leading-relaxed">
                  {activeRemedyTab === 'organic' ? (
                    <div>
                      <strong className="text-emerald-400 block text-[11px] mb-1">Cold-Pressed Neem Oil (5ml/L)</strong>
                      Spray directly into the maize leaf whorls at dusk. Reapply after 5 days. Safe for bees and children.
                    </div>
                  ) : (
                    <div>
                      <strong className="text-emerald-400 block text-[11px] mb-1">Bacillus thuringiensis (Bt)</strong>
                      Apply standard bio-insecticide early morning or late evening. Wear protective mask when spraying.
                    </div>
                  )}
                </div>

                {/* Hyperlocal Rain Advisory Bar */}
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-2.5 text-xs text-sky-200">
                  <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="leading-tight text-[11px]">
                    <strong>Rain Alert:</strong> 14mm rain expected in 18 hrs. Hold foliar spray until Friday morning to prevent chemical wash-off.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent pointer-events-none z-20" />

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-20"
      >
        <span className="text-xxs text-white/40 uppercase tracking-widest font-mono">Scroll for more</span>
        <ChevronDown className="w-4 h-4 text-white/40 animate-bounce" />
      </motion.div>
    </section>
  );
}

export default Hero;
