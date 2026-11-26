import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';
import { useLanguage } from '@/lib/LanguageContext';
import { PhotoBackdrop } from './PhotoBackdrop';

export function CTA() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
        <section className="relative py-16 sm:py-28 overflow-hidden">
          <PhotoBackdrop src="/images/landing/hero-aerial.webp" width={1376} height={768} />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="max-w-2xl mx-auto px-4 sm:px-6 text-center relative z-10"
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-medium leading-tight text-white mb-4">
              {t('ui_cta_ready_to_protect_your_crops')}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm sm:text-lg text-white/80 mb-6 sm:mb-8 px-2 font-normal">
              {t('ui_cta_completely_free_for_smallholder_farm')}
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto h-12 px-6 text-base font-medium text-white rounded-md bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                {t('ui_cta_get_started_free')}
              </button>
              <button
                onClick={() => navigate('/demo')}
                className="w-full sm:w-auto h-12 px-6 text-base border border-white/[0.16] text-[#e6eee9] rounded-md hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                {t('ui_cta_try_live_demo')}
              </button>
            </motion.div>
          </motion.div>
        </section>
  );
}
