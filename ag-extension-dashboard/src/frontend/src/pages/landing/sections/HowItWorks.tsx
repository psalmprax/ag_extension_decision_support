import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';
import { steps } from '../data';
import { useLanguage } from '@/lib/LanguageContext';
import { PhotoBackdrop } from './PhotoBackdrop';
import { CARD_TITLE, SECTION_TITLE } from './sectionStyles';

export function HowItWorks() {
  const { t } = useLanguage();
  return (
        <section id="how-it-works" className="relative py-28 border-t border-white/[0.04] overflow-hidden">
      <PhotoBackdrop src="/images/landing/farmer-in-field-phone.webp" width={1200} height={623} position="center 30%" />
          <div className="relative z-10 max-w-6xl w-full mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-20"
            >
              <motion.h2 variants={fadeUp} className={`${SECTION_TITLE} mb-4`}>
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
                  className="p-6 rounded-xl backdrop-blur-md bg-[#0d1a14]/70 border border-white/[0.08] hover:border-emerald-500/30 transition-all duration-300 text-center relative"
                >
                  <div className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.12] flex items-center justify-center text-lg font-medium text-emerald-400 mx-auto mb-6 relative z-10 shadow-lg">
                    {step.num}
                  </div>
                  <h3 className={`${CARD_TITLE} mb-3`}>{t(step.title)}</h3>
                  <p className="text-sm text-white/70 max-w-[280px] mx-auto leading-relaxed">
                    {t(step.desc)}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
  );
}
