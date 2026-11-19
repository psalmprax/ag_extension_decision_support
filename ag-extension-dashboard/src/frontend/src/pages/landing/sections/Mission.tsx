import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';
import { useLanguage } from '@/lib/LanguageContext';

export function Mission() {
  const { t } = useLanguage();
  return (
        <section id="mission" className="relative py-28 border-t border-white/[0.04] overflow-hidden">
          {/* Subtle Extension Field Partnership Backdrop */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <img
              src="/images/landing/officer-farmer-hero.webp"
              srcSet="/images/landing/officer-farmer-hero-640.webp 640w, /images/landing/officer-farmer-hero-1024.webp 1024w, /images/landing/officer-farmer-hero.webp 1920w"
              sizes="(max-width: 640px) 640px, (max-width: 1100px) 1024px, 1920px"
              alt=""
              role="presentation"
              aria-hidden="true"
              width={1920}
              height={1080}
              className="w-full h-full object-cover object-center opacity-[0.07] filter saturate-125 contrast-105 pointer-events-none"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950" />
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="max-w-3xl mx-auto px-6 text-center relative z-10"
          >
            <motion.div
              variants={fadeUp}
              className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
            >
              {t('ui_footer_our_mission')}
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-2xl sm:text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight mb-4 sm:mb-6 leading-tight break-words px-2"
            >
              {t('ui_mission_closing_the_gap_between')}{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                {t('ui_mission_agricultural_data')}
              </span>{' '}
              {t('ui_mission_and_field_decisions')}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-sm sm:text-lg text-white/75 leading-relaxed max-w-2xl mx-auto px-2 font-normal"
            >
              {t('ui_mission_across_the_globe_extension_officers')}
            </motion.p>
          </motion.div>
        </section>
  );
}
