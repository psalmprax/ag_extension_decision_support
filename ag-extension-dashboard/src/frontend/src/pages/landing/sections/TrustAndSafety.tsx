import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, HeartHandshake, BookOpenCheck,
  Leaf, Sparkles, CheckCircle2
} from 'lucide-react';
import { stagger, fadeUp } from '../variants';
import { useLanguage } from '@/lib/LanguageContext';

export function TrustAndSafety() {
  const { t } = useLanguage();
  return (
    <section id="trust-safety" className="relative py-20 sm:py-28 border-t border-white/[0.06] bg-slate-950 overflow-hidden">
      {/* Subtle Farm Inspection Crop Backdrop */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/farmer-inspecting-ear.webp"
          alt=""
          role="presentation"
          aria-hidden="true"
          width={600}
          height={450}
          className="w-full h-full object-cover object-center opacity-[0.08] filter saturate-125 contrast-105 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950" />
      </div>

      {/* Subtle organic green radial glow */}
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[300px] bg-emerald-600/[0.04] blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center max-w-3xl mx-auto mb-14 sm:mb-20"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            {t('ui_trust_and_safety_safety_agronomic_integrity')}
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight"
          >
            {t('ui_trust_and_safety_honest_safe_advice_you_can')}{' '}
            <span className="text-emerald-400">
              {t('ui_trust_and_safety_trust_in_your_soil')}
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed font-normal"
          >
            {t('ui_trust_and_safety_agricultural_technology_should_ackno')}
          </motion.p>
        </motion.div>

        {/* 3 Trust Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {/* Pillar 1 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('ui_trust_and_safety_clear_ai_limits_human_escalation')}</h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                {t('ui_trust_and_safety_ai_assessments_can_be_wrong_or_uncer')}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{t('ui_trust_and_safety_expert_confirmation_matters')}</span>
            </div>
          </motion.div>

          {/* Pillar 2 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] hover:border-amber-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <BookOpenCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('ui_trust_and_safety_check_the_evidence')}</h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                {t('ui_trust_and_safety_retrieved_information_is_not_proof_o')}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] text-xs text-amber-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>{t('ui_trust_and_safety_verify_sources_and_local_applicabili')}</span>
            </div>
          </motion.div>

          {/* Pillar 3 */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/40 p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Leaf className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('ui_trust_and_safety_protect_people_and_pollinators')}</h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                {t('ui_trust_and_safety_natural_or_biological_products_are_n')}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-white/[0.06] text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{t('ui_trust_and_safety_soil_pollinator_conscious')}</span>
            </div>
          </motion.div>
        </div>

        {/* Extension Officer Bridge Banner */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className="rounded-2xl backdrop-blur-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-amber-950/30 border border-emerald-500/30 p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white mb-1">
                {t('ui_trust_and_safety_work_with_local_extension_officers')}
              </h4>
              <p className="text-xs sm:text-sm text-white/70 max-w-2xl leading-relaxed">
                {t('ui_trust_and_safety_where_your_organization_has_configur')}
              </p>
            </div>
          </div>

          <div className="flex items-center shrink-0 w-full sm:w-auto">
            <a
              href="#agent-os"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('ui_trust_and_safety_see_officer_platform')}</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default TrustAndSafety;
