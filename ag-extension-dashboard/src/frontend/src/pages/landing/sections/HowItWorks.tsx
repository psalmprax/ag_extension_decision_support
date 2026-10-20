import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';
import { steps } from '../data';

export function HowItWorks() {
  return (
        <section id="how-it-works" className="relative py-28 border-t border-white/[0.04] overflow-hidden">
      {/* Subtle Crop Scanning Field Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/mobile-field-touch.webp"
          alt=""
          role="presentation"
          aria-hidden="true"
          width={800}
          height={600}
          className="w-full h-full object-cover object-center opacity-[0.06] filter saturate-125 contrast-105 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950" />
      </div>
          <div className="max-w-[90rem] w-full mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-20"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3"
              >
                Simple 3-Step Process
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-2xl sm:text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight text-white mb-3"
              >
                Heal your crops in{' '}
                <span className="bg-gradient-to-r from-emerald-300 to-amber-300 bg-clip-text text-transparent">
                  three simple steps
                </span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/70 max-w-xl mx-auto font-normal leading-relaxed"
              >
                No expensive equipment, no technical training. Just point, scan, and protect your harvest.
              </motion.p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px">
                <div className="w-full h-full bg-gradient-to-r from-emerald-500/20 via-emerald-500/40 to-amber-500/20" />
              </div>

              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="p-6 rounded-xl backdrop-blur-md bg-slate-900/50 border border-white/[0.08] hover:border-emerald-500/30 transition-all duration-300 text-center relative"
                >
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-500/10 border border-emerald-500/30 flex items-center justify-center text-lg font-bold text-emerald-400 mx-auto mb-6 relative z-10 shadow-lg shadow-emerald-950/30">
                    {step.num}
                  </div>
                  <h3 className="text-lg font-bold mb-3 text-white/90">{step.title}</h3>
                  <p className="text-sm text-white/50 max-w-[280px] mx-auto leading-relaxed">
                    {step.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
  );
}
