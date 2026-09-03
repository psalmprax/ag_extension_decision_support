import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';
import { steps } from '../data';

export function HowItWorks() {
  return (
        <section id="how-it-works" className="relative py-28 border-t border-white/[0.04]">
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
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                How It Works
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight"
              >
                Up and running in{' '}
                <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                  three steps
                </span>
              </motion.h2>
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
