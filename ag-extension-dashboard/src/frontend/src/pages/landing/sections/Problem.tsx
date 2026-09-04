import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { stagger, fadeUp } from '../variants';
import { painPoints } from '../data';

export function Problem() {
  return (
        <section id="problem" className="relative py-28 border-t border-white/[0.04]">
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
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                Why GPExts
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight leading-tight"
              >
                The old way isn&apos;t{' '}
                <span className="bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                  working
                </span>
              </motion.h2>
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
