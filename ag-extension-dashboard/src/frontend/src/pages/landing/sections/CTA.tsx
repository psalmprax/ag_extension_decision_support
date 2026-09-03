import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { stagger, fadeUp } from '../variants';

export function CTA() {
  const navigate = useNavigate();

  return (
        <section className="relative py-16 sm:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#060b08] via-emerald-950/20 to-[#060b08] pointer-events-none" />
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
              className="text-2xl sm:text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-4 sm:mb-5 leading-tight px-2"
            >
              Ready to transform your
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                agricultural extension?
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm sm:text-lg text-white/75 mb-6 sm:mb-8 px-2 font-normal">
              Start with a free trial. No credit card required.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto relative group overflow-hidden px-7 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-white rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 border border-emerald-400/50 shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_45px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
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
                className="w-full sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-semibold bg-white/[0.04] border border-white/[0.06] text-white/70 rounded-xl hover:bg-white/[0.08] hover:text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                Try Live Demo
              </button>
            </motion.div>
          </motion.div>
        </section>
  );
}
