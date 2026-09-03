import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';
import { audiences } from '../data';

export function ROI() {
  return (
        <section id="roi" className="relative py-28 overflow-hidden scroll-mt-10">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                Built For
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight"
              >
                Serving organizations across{' '}
                <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                  the Globe
                </span>
              </motion.h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-4">
              {audiences.map((aud, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="group p-7 rounded-xl backdrop-blur-md bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-slate-900/80 hover:shadow-2xl hover:shadow-emerald-950/20 transition-all duration-500"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-all duration-500">
                    <aud.icon className="w-6 h-6 text-emerald-400/80 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h3 className="text-base font-bold mb-2 text-white/90">{aud.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{aud.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
  );
}
