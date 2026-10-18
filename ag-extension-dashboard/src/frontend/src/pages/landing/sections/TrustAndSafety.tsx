import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, HeartHandshake, BookOpenCheck,
  PhoneCall, Leaf, Sparkles, CheckCircle2
} from 'lucide-react';
import { stagger, fadeUp } from '../variants';

export function TrustAndSafety() {
  return (
    <section id="trust-safety" className="relative py-20 sm:py-28 border-t border-white/[0.06] bg-slate-950">
      {/* Subtle organic green radial glow */}
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[300px] bg-emerald-600/[0.04] blur-[150px] rounded-full pointer-events-none" />

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
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Safety &amp; Agronomic Integrity
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight"
          >
            Honest, safe advice you can{' '}
            <span className="text-emerald-400">
              trust in your soil
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed font-normal"
          >
            We believe agricultural technology must be humble, scientifically proven, and backed by real certified human extension officers.
          </motion.p>
        </motion.div>

        {/* 3 Trust Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {/* Pillar 1 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Clear AI Limits &amp; Human Escalation</h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                AI should never guess with your livelihood. If an image is blurry or a blight is uncertain, GPExts alerts you immediately and gives you a one-tap connection to an official extension officer.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Zero false guarantees</span>
            </div>
          </motion.div>

          {/* Pillar 2 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] hover:border-amber-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <BookOpenCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Backed by Agricultural Institutes</h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                All disease diagnostics and spray dosages are calibrated against verified research from national agricultural institutes (KALRO, NARO, CGIAR, and FAO) to ensure local environmental suitability.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] text-xs text-amber-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Scientifically proven protocols</span>
            </div>
          </motion.div>

          {/* Pillar 3 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Leaf className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Bee-Safe &amp; Family-Friendly Recipes</h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                We prioritize safe organic recipes (cold-pressed Neem, ash tea, bio-fungicides) that don’t poison beneficial bees, harm grazing livestock, or endanger your children helping in the field.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Soil &amp; pollinator conscious</span>
            </div>
          </motion.div>
        </div>

        {/* Extension Officer Bridge Banner */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className="rounded-2xl backdrop-blur-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-amber-950/30 border border-emerald-500/30 p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white mb-1">
                Connected to 1,200+ Field Extension Officers Across Districts
              </h4>
              <p className="text-xs sm:text-sm text-white/70 max-w-2xl leading-relaxed">
                When a problem needs physical inspection, GPExts alerts verified officers in your ward for on-site farm visits and group field demonstration days.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <a
              href="#agent-os"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>See Officer Platform</span>
            </a>
            <a
              href="tel:0800000000"
              onClick={(e) => {
                e.preventDefault();
                alert('Toll-free agricultural support hotline: 0800-FARM-SAFE (24/7 in Swahili & English)');
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Toll-Free Helpline</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default TrustAndSafety;
