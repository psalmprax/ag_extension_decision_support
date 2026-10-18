import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera, CloudRain, TrendingUp, BookOpenCheck,
  ArrowRight, Check, Sparkles, Volume2
} from 'lucide-react';
import { stagger, fadeUp } from '../variants';

export function FarmerServices() {
  const navigate = useNavigate();
  const [activeDialect, setActiveDialect] = useState<'sw' | 'lg' | 'en'>('sw');

  const selectDialect = (lang: 'sw' | 'lg' | 'en') => {
    setActiveDialect(lang);
  };

  return (
    <section id="services" className="relative py-20 sm:py-28 border-t border-white/[0.06] bg-gradient-to-b from-slate-950 via-emerald-950/20 to-slate-950">
      {/* Warm ambient harvest underlay */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/[0.035] blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center max-w-3xl mx-auto mb-14 sm:mb-20"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Four Essential Farmer Services
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight"
          >
            Everything you need to{' '}
            <span className="text-emerald-400">
              protect your family’s yield
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed font-normal"
          >
            Designed specifically for smallholder farms. Large touch buttons, plain everyday language, and immediate help — even without internet.
          </motion.p>
        </motion.div>

        {/* 4 Core Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Service 1: Diagnose My Crop */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-slate-900/70 border border-white/[0.08] hover:border-emerald-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-emerald-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
                  <Camera className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                  Free • Offline photo queueing
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  Diagnose My Crop
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Capture a crop photo and queue it while offline. Diagnosis and remedy guidance require an internet connection.
                </p>
              </div>

              <div className="pt-2 space-y-2 text-xs sm:text-sm text-white/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Recognizes 120+ blights, fungal rots &amp; caterpillars</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Gives organic recipes (Neem, wood ash) and safe spray doses</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Queued photos are sent for analysis when you reconnect</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => navigate('/diagnosis')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98]"
              >
                <Camera className="w-4 h-4" />
                <span>Diagnose a Crop Free</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Service 2: Check Rain & Spray Weather */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-slate-900/70 border border-white/[0.08] hover:border-sky-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-sky-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner group-hover:scale-105 transition-transform">
                  <CloudRain className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1 rounded-full">
                  Hyperlocal Satellite Radar
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-sky-300 transition-colors">
                  Check the Weather &amp; Spray Timing
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Know exactly when rain is coming before you apply fertilizer or pesticides. Avoid costly chemical wash-off and prepare your soil for planting.
                </p>
              </div>

              <div className="pt-2 space-y-2 text-xs sm:text-sm text-white/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>7-day hourly rain probability mapped to your parish</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Clear spray window alerts: &quot;Spray Friday morning; rain in 18 hrs&quot;</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>Automatic SMS rain warnings on basic 2G feature phones</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => navigate('/demo')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-sky-600/90 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-950/40 transition-all active:scale-[0.98]"
              >
                <CloudRain className="w-4 h-4" />
                <span>Explore Platform Demo</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Service 3: Check Fair Market Prices */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-slate-900/70 border border-white/[0.08] hover:border-amber-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-amber-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                  Not Yet Available
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                  Check Fair Market Prices
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Market price information is not currently available on the public platform.
                </p>
              </div>

              <div className="pt-2 text-xs sm:text-sm text-white/80">
                <span>Check with local buyers or extension officers for current rates.</span>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="button"
                disabled
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600/90 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 cursor-not-allowed opacity-60"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Market Prices Coming Soon</span>
              </button>
            </div>
          </motion.div>

          {/* Service 4: Read Advice in Your Dialect */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-slate-900/70 border border-white/[0.08] hover:border-purple-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-purple-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner group-hover:scale-105 transition-transform">
                  <BookOpenCheck className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                  Text Preview
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  Read Advice in Your Dialect
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Choose a language to read a sample of clear, plain-language crop advice.
                </p>
              </div>

              {/* Interactive Dialect Transcript Card */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="text-xs font-semibold text-purple-300 flex items-center justify-between">
                  <span>Advice text preview:</span>
                  <span className="text-xxs font-mono text-white/60">Select a language</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectDialect('sw')}
                    aria-pressed={activeDialect === 'sw'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeDialect === 'sw'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>Swahili (Kiswahili)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDialect('lg')}
                    aria-pressed={activeDialect === 'lg'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeDialect === 'lg'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>Luganda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDialect('en')}
                    aria-pressed={activeDialect === 'en'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeDialect === 'en'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>English</span>
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200">
                  <span className="italic leading-snug">
                    {activeDialect === 'sw' && '"Nyunyizia mchanganyiko wa mwarobaini jioni..."'}
                    {activeDialect === 'lg' && '"Fukirira eddagala ly&apos;enim ku kisaakaate..."'}
                    {activeDialect === 'en' && '"Spray the Neem mixture into leaf whorls at dusk..."'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <a
                href="#talking-assistant"
                className="inline-flex w-full sm:w-auto px-6 py-3 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-sm items-center justify-center gap-2 shadow-lg shadow-purple-950/40 transition-all active:scale-[0.98]"
              >
                <Volume2 className="w-4 h-4" />
                <span>Open Talking Assistant</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default FarmerServices;
