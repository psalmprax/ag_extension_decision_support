import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { stagger, fadeUp } from '../variants';

export function CTA() {
  const navigate = useNavigate();

  return (
        <section className="relative py-16 sm:py-28 overflow-hidden">
          {/* Warm Sunlit Harvest Backdrop */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <img
              src="/images/landing/maize-field-sunrise.webp"
              alt=""
              role="presentation"
              aria-hidden="true"
              width={1319}
              height={860}
              className="w-full h-full object-cover object-center opacity-20 filter saturate-125 contrast-105 pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#060b08] via-emerald-950/60 to-[#060b08]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.12),transparent_70%)]" />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[600px] h-[200px] sm:h-[300px] bg-emerald-500/[0.05] blur-[80px] sm:blur-[100px] rounded-full pointer-events-none" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="max-w-2xl mx-auto px-4 sm:px-6 text-center relative z-10"
          >
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-4 sm:mb-5 leading-tight px-2 text-white"
            >
              Ready to protect your crops
              <br />
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-300 bg-clip-text text-transparent">
                and harvest more this season?
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm sm:text-lg text-white/80 mb-6 sm:mb-8 px-2 font-normal">
              Completely free for smallholder farmers. Queue crop photos offline; automatic AI sync when reconnected.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto relative group overflow-hidden px-7 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-white rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 border border-emerald-400/50 shadow-xl shadow-emerald-950/50 hover:shadow-2xl hover:shadow-emerald-900/60 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                <span className="relative z-10 flex items-center gap-2">
                  Get Started Free
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform text-white/90" />
                </span>
              </button>
              <button
                onClick={() => navigate('/demo')}
                className="w-full sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-semibold bg-white/[0.06] border border-white/10 text-slate-200 rounded-xl hover:bg-white/[0.12] hover:text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                Try Live Demo
              </button>
            </motion.div>
          </motion.div>
        </section>
  );
}
