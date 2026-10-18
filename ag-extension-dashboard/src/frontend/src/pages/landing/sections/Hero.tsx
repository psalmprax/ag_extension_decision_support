import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { GlobalConstellationVisualization } from '@/components/landing/Visuals';
import {
  Camera, Leaf, ArrowRight, CheckCircle2,
  Volume2, CloudRain, ShieldCheck, ChevronDown,
  AlertCircle, Droplets, Radio, VolumeX,
} from 'lucide-react';
import { stagger, fadeUp, scaleIn } from '../variants';
import { globalTelemetryNodes } from '../data';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function Hero({ heroY, heroOpacity }: { heroY: MotionValue<number>; heroOpacity: MotionValue<number> }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [activeRemedyTab, setActiveRemedyTab] = useState<'organic' | 'standard'>('organic');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLanguage, setAudioLanguage] = useState<'sw' | 'en'>('sw');

  const toggleAudio = () => {
    setIsPlayingAudio(prev => !prev);
  };

  return (
    <section className="relative min-h-screen flex items-start sm:items-center pt-20 sm:pt-24 pb-12 sm:pb-20 overflow-hidden">
      {/* Authentic Agricultural Partnership Backdrop with Warm Agrarian Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/officer-farmer-hero.webp"
          srcSet="/images/landing/officer-farmer-hero-640.webp 640w, /images/landing/officer-farmer-hero-1024.webp 1024w, /images/landing/officer-farmer-hero.webp 1920w"
          sizes="(max-width: 640px) 640px, (max-width: 1100px) 1024px, 1920px"
          alt="Agricultural extension officer consulting with a smallholder farmer in a maize field using a digital tablet"
          width={1920}
          height={1080}
          className="w-full h-full object-cover object-center opacity-30 filter saturate-125 contrast-105 transition-opacity duration-700"
          loading="eager"
          decoding="async"
        />
        <img
          src="/images/landing/maize-field-sunrise.webp"
          alt="Lush green maize field glowing in morning sunlight"
          width={1319}
          height={860}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-20 mix-blend-screen pointer-events-none"
          loading="eager"
          decoding="async"
        />
        {/* Soft, warm agrarian sunlit vignette overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/75 via-emerald-950/60 to-slate-950/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(245,158,11,0.2),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.15),transparent_70%)]" />
      </div>

      {/* Subtle organic contour pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
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
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-md shadow-sm max-w-full mx-auto sm:mx-0 overflow-hidden"
          >
            <Leaf className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-300">
              🌾 Free Pocket Crop Doctor for Every Farmer
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
            Point your phone camera at any sick leaf, stem, or pest for instant diagnosis, affordable safe remedies, and rain warnings — works 100% offline in your local language.
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
              <span>Diagnose a Crop — Free</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Audio Dialect Toggle Preview */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`w-full sm:w-auto group px-6 py-3.5 text-sm sm:text-base font-semibold border rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 backdrop-blur-sm ${
                isPlayingAudio
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-950/40'
                  : 'bg-white/[0.06] border-white/[0.12] text-white/90 hover:bg-white/[0.12] hover:text-white'
              }`}
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>Pause Voice Sample</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>Listen in Your Dialect</span>
                </>
              )}
            </button>
          </motion.div>

          {/* Live Spoken Dialect Audio Bar */}
          <AnimatePresence>
            {isPlayingAudio && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left max-w-xl"
              >
                <div className="flex items-center gap-2.5 text-xs text-amber-100">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span>
                    <strong>Speaking in {audioLanguage === 'sw' ? 'Kiswahili' : 'English'}:</strong>{' '}
                    <em>
                      {audioLanguage === 'sw'
                        ? '"Mmea wako una kiwavi wa jeshi. Changanya vijiko viwili vya mafuta ya mwarobaini..."'
                        : '"Your maize has armyworm caterpillars. Mix two tablespoons of neem oil in one bucket of clean water..."'}
                    </em>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioLanguage(prev => (prev === 'sw' ? 'en' : 'sw'))}
                  className="text-xxs font-bold text-amber-300 hover:text-white bg-amber-500/20 px-2 py-1 rounded-md border border-amber-400/30 whitespace-nowrap"
                >
                  Switch to {audioLanguage === 'sw' ? 'English' : 'Kiswahili'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Secondary Institutional Bridge for Officers & Ministries */}
          <motion.div
            variants={fadeUp}
            className="p-3.5 sm:p-4 rounded-xl bg-white/[0.025] border border-white/[0.06] backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-xl text-left"
          >
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Are you an Extension Officer, Cooperative, or Ministry?
              </span>
              <p className="text-xxs sm:text-xs text-white/60 leading-snug">
                Manage thousands of farmers across districts with offline GPS visit logs and regional pest heatmaps.
              </p>
            </div>
            <a
              href="#agent-os"
              className="text-xs font-bold text-emerald-300 hover:text-emerald-200 underline whitespace-nowrap py-1"
            >
              Explore Organization Tools →
            </a>
          </motion.div>
        </motion.div>

        {/* Right column — Plantix-Style Smartphone Leaf Scanner Mockup (Plain Language) */}
        <motion.div initial="hidden" animate="visible" variants={scaleIn} className="relative w-full max-w-full flex justify-center">
          {/* Ambient warm harvest & emerald backlight */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-amber-500/10 to-emerald-600/15 blur-[80px] rounded-full scale-95 pointer-events-none" />

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
                      ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                      : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-semibold">{isPlayingAudio ? 'Speaking' : 'Audio'}</span>
                </button>
              </div>

              {/* Camera Leaf Viewfinder */}
              <div className="relative h-[210px] sm:h-[230px] w-full overflow-hidden bg-slate-900">
                <img
                  src="/images/landing/maize-leaf-diagnostics.webp"
                  alt="Close-up of diagnosed maize crop leaf with Fall Armyworm damage"
                  className="w-full h-full object-cover object-center filter saturate-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

                {/* Animated laser scanning line */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />

                {/* Diagnostic Bounding Reticle in Plain Language */}
                <div className="absolute top-8 left-10 sm:left-14 w-44 h-28 border-2 border-emerald-400/90 rounded-xl bg-emerald-500/10 flex flex-col justify-between p-2 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-sans font-bold text-emerald-300 bg-slate-950/85 px-2 py-0.5 rounded border border-emerald-400/30 flex items-center gap-1">
                      <span>🔍 Affected Leaf Area</span>
                    </span>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  </div>
                  <div className="bg-slate-950/90 backdrop-blur-md rounded-lg p-1.5 border border-emerald-400/40 text-left">
                    <div className="text-[10px] font-bold text-white flex items-center gap-1">
                      <span>🐛 Fall Armyworm Caterpillar</span>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="text-[9px] text-emerald-400 font-semibold">✅ High Certainty Match</div>
                  </div>
                </div>

                {/* Floating Location Tag in Plain Language */}
                <div className="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-medium text-white/90 border border-white/10">
                  📍 Meru District • Saved 100% Offline
                </div>
              </div>

              {/* Diagnosis & Actionable Treatment Card in Plain Language */}
              <div className="p-4 bg-slate-900/95 border-t border-white/10 space-y-3">
                {/* Result header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
                      Recommended Next Step
                    </span>
                    <h3 className="text-sm font-bold text-white">Fall Armyworm Caterpillar</h3>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Moderate Problem
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
                    🌿 Organic Recipe
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
                    🛡️ Safe Farm Spray
                  </button>
                </div>

                {/* Remedy Content in Plain Language */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/80 leading-relaxed">
                  {activeRemedyTab === 'organic' ? (
                    <div>
                      <strong className="text-emerald-400 block text-[11px] mb-1">Cold-Pressed Neem Oil (Natural Recipe)</strong>
                      Mix 2 tablespoons of Neem oil in 1 bucket of clean water. Spray inside leaf whorls at sunset. Reapply after 5 days. Safe for bees, livestock &amp; children.
                    </div>
                  ) : (
                    <div>
                      <strong className="text-emerald-400 block text-[11px] mb-1">Approved Bio-Pesticide (Bt)</strong>
                      Apply certified bio-insecticide in early morning or late evening. Wear a basic cloth face cover when spraying. Safe for soil health.
                    </div>
                  )}
                </div>

                {/* Hyperlocal Rain Advisory Bar */}
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-2.5 text-xs text-sky-200">
                  <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="leading-tight text-[11px]">
                    <strong>Rain Alert:</strong> 14mm rain expected in 18 hrs. Hold foliar spray until Friday morning so the medicine doesn&apos;t wash away.
                  </div>
                </div>

                {/* Tap to Launch Diagnosis Action Bar */}
                <button
                  type="button"
                  onClick={() => navigate('/diagnosis')}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all active:scale-95 group cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Diagnose Your Own Crop Free →</span>
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Floating Real Farmer Trust Card (Real smallholder farmer in field) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="hidden sm:flex absolute -bottom-4 -left-6 z-30 p-2.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 backdrop-blur-xl shadow-2xl items-center gap-3 max-w-[270px]"
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-emerald-400/30">
              <img
                src="/images/landing/farmer-in-field-phone.webp"
                alt="Real smallholder farmer using smartphone in maize field"
                width={120}
                height={120}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="text-left min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-bold text-white">
                <span className="truncate">Amina M.</span>
              </div>
            </div>
          </motion.div>
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
