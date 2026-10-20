import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { stagger, fadeUp } from '../variants';
import { painPoints } from '../data';

export function Problem() {
  return (
        <section id="problem" className="relative py-28 border-t border-white/[0.04] overflow-hidden">
      {/* Subtle Farm Reality Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/farmer-in-field-phone.webp"
          alt=""
          role="presentation"
          aria-hidden="true"
          width={1200}
          height={800}
          className="w-full h-full object-cover object-center opacity-[0.07] filter saturate-125 contrast-105 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950" />
      </div>
          <div className="max-w-[90rem] w-full mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3"
              >
                Why Farmers Choose GPExts
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-2xl sm:text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight leading-tight text-white mb-3"
              >
                Farming is hard enough{' '}
                <span className="bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
                  without the guesswork
                </span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/70 max-w-2xl mx-auto font-normal leading-relaxed"
              >
                Stop losing harvests to slow advice, misdiagnosed blights, and unpredictable weather. Here is how GPExts protects your family&apos;s yield.
              </motion.p>
            </motion.div>

            <div className="space-y-3">
              {painPoints.map((item, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={fadeUp}
                  className="grid md:grid-cols-2 gap-3"
                >
                  <div className="flex items-start gap-3 p-5 rounded-xl backdrop-blur-md bg-rose-950/20 border border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-950/30 transition-all duration-300">
                    <XCircle className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-white/60 leading-relaxed">{item.problem}</span>
                  </div>
                  <div className="flex items-start gap-3 p-5 rounded-xl backdrop-blur-md bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-950/30 transition-all duration-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400/80 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-white/80 leading-relaxed">{item.solution}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
  );
}
