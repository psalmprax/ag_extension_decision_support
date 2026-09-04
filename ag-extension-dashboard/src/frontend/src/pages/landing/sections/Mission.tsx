import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';

export function Mission() {
  return (
        <section id="mission" className="relative py-28 border-t border-white/[0.04]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="max-w-3xl mx-auto px-6 text-center relative z-10"
          >
            <motion.div
              variants={fadeUp}
              className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
            >
              Our Mission
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight mb-4 sm:mb-6 leading-tight break-words px-2"
            >
              Closing the gap between{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                agricultural data
              </span>{' '}
              and field decisions
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-sm sm:text-lg text-white/75 leading-relaxed max-w-2xl mx-auto px-2 font-normal"
            >
              Across the Globe, extension officers manage thousands of farmers with clipboards and
              guesswork. GPExts replaces that with real-time soil data, satellite weather, and
              AI-powered diagnostics — so every recommendation is backed by evidence, not intuition.
            </motion.p>
          </motion.div>
        </section>
  );
}
