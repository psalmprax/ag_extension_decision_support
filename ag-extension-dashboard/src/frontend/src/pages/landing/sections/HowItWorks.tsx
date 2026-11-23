import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';
import { steps } from '../data';
import { useLanguage } from '@/lib/LanguageContext';

export function HowItWorks() {
  const { t } = useLanguage();
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
        <div data-scrim className="absolute inset-0 bg-gradient-to-b from-[#0d1a14] via-[#0d1a14]/85 to-[#0d1a14]" />
      </div>
          <div className="relative z-10 max-w-6xl w-full mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-20"
            >
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-medium leading-tight text-white mb-4">
                {t('ui_how_it_works_heal_your_crops_in')}
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/70 max-w-xl mx-auto font-normal leading-relaxed"
              >
                {t('ui_how_it_works_no_expensive_equipment_no_technical')}
              </motion.p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-8 start-[12%] end-[12%] h-px">
              </div>

              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="p-6 rounded-xl backdrop-blur-md bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/30 transition-all duration-300 text-center relative"
                >
                  <div className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.12] flex items-center justify-center text-lg font-medium text-emerald-400 mx-auto mb-6 relative z-10 shadow-lg">
                    {step.num}
                  </div>
                  <h3 className="text-lg font-medium mb-3 text-white/90">{t(step.title)}</h3>
                  <p className="text-sm text-white/50 max-w-[280px] mx-auto leading-relaxed">
                    {t(step.desc)}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
  );
}
