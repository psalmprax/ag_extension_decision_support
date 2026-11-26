import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { GlobalConstellationVisualization } from '@/components/landing/Visuals';
import {
  Camera, Leaf, CheckCircle2, BookOpenCheck,
  AlertCircle, Droplets,
} from 'lucide-react';
import { stagger, fadeUp, scaleIn } from '../variants';
import { globalTelemetryNodes } from '../data';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useLanguage } from '@/lib/LanguageContext';
import { HeroHighlights } from './HeroHighlights';
import { HERO_TITLE } from './sectionStyles';

export function Hero({ heroY, heroOpacity }: { heroY: MotionValue<number>; heroOpacity: MotionValue<number> }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [activeRemedyTab, setActiveRemedyTab] = useState<'organic' | 'standard'>('organic');
  const [isTextSampleVisible, setIsTextSampleVisible] = useState(false);
  const [textLanguage, setTextLanguage] = useState<'sw' | 'en'>('sw');

  const toggleTextSample = () => {
    setIsTextSampleVisible(prev => !prev);
  };

  return (
    <section className="relative min-h-screen flex items-start sm:items-center pt-20 sm:pt-24 pb-12 sm:pb-20 overflow-hidden">
      {/* Authentic Agricultural Partnership Backdrop with Warm Agrarian Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/officer-farmer-hero.webp"
          srcSet="/images/landing/officer-farmer-hero-640.webp 640w, /images/landing/officer-farmer-hero-1024.webp 1024w, /images/landing/officer-farmer-hero.webp 1920w"
          sizes="(max-width: 640px) 640px, (max-width: 1100px) 1024px, 1920px"
          alt="Agricultural extension officer consulting with a smallholder farmer in a maize field using a digital tablet"
          role="presentation"
          aria-hidden="true"
          width={1920}
          height={1080}
          className="w-full h-full object-cover object-center opacity-30 filter saturate-125 contrast-105 transition-opacity duration-700"
          loading="eager"
          decoding="async"
        />
        <img
          src="/images/landing/maize-field-sunrise.webp"
          alt=""
          role="presentation"
          aria-hidden="true"
          width={1319}
          height={860}
          className="absolute inset-0 w-full h-full object-cover object-center opacity-20 mix-blend-screen pointer-events-none"
          loading="eager"
          decoding="async"
        />
        {/* Soft, warm agrarian sunlit vignette overlays */}
        <div data-scrim className="absolute inset-0 bg-gradient-to-b from-stone-950/75 via-emerald-950/60 to-[#0d1a14]/95" />
      </div>

      {/* Subtle organic contour pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-outline) 1px, transparent 1px), linear-gradient(90deg, var(--color-outline) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Global Constellation Visualization */}
      <GlobalConstellationVisualization nodes={globalTelemetryNodes} />

      <motion.div
        style={reduceMotion ? undefined : { y: heroY, opacity: heroOpacity }}
        className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center relative z-10"
      >
        {/* Left column — Farmer-Friendly Value Proposition */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-6 sm:space-y-8 text-center sm:text-start mx-auto sm:mx-0 min-w-0 max-w-full">

          {/* Main Headline */}
          <motion.h1 variants={fadeUp} className={HERO_TITLE}>
            <span className="block">{t('ui_hero_heal_your_crops')}</span>
            <span className="block">{t('ui_hero_protect_your_harvest')}</span>
            <span className="block">{t('ui_hero_grow_with_confidence')}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="text-base sm:text-lg text-[#c5d3cb] leading-relaxed max-w-xl mx-auto sm:mx-0"
          >
            {t('ui_hero_share_a_crop_photo_or_symptoms_for_a')}
          </motion.p>
          <HeroHighlights />
          {/* Action CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/diagnosis')}
              className="w-full sm:w-auto h-12 px-6 text-base font-medium text-white rounded-md bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" aria-hidden="true" />
              <span>{t('ui_hero_diagnose_a_crop_free')}</span>
            </button>

            {/* Text Dialect Preview */}
            <button
              type="button"
              onClick={toggleTextSample}
              aria-expanded={isTextSampleVisible}
              className="w-full sm:w-auto h-12 px-6 text-base border border-white/[0.16] rounded-md text-[#e6eee9] hover:bg-white/[0.06] hover:text-white transition-colors flex items-center justify-center gap-2"
            >
              {isTextSampleVisible ? (
                <>
                  <BookOpenCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{t('ui_hero_hide_text_sample')}</span>
                </>
              ) : (
                <>
                  <BookOpenCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{t('ui_hero_read_in_your_dialect')}</span>
                </>
              )}
            </button>
          </motion.div>

          {/* Text-only Dialect Sample */}
          <AnimatePresence>
            {isTextSampleVisible && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 rounded-md bg-white/[0.04] border border-white/[0.1] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-start max-w-xl"
              >
                <div className="flex items-center gap-2.5 text-sm text-[#e6eee9]">
                  <span>
                    <strong>{t('ui_hero_text_sample_in')} {textLanguage === 'sw' ? 'Kiswahili' : 'English'}:</strong>{' '}
                    <em>
                      {textLanguage === 'sw'
                        ? '"Wasiliana na afisa ugani wa eneo lako."'
                        : '"Contact your local extension officer."'}
                    </em>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTextLanguage(prev => (prev === 'sw' ? 'en' : 'sw'))}
                  className="text-sm text-[#e6eee9] hover:text-white px-3.5 min-h-[44px] inline-flex items-center rounded-md border border-white/[0.16] whitespace-nowrap transition-colors"
                >
                  {t('ui_hero_switch_text_to')} {textLanguage === 'sw' ? 'English' : 'Kiswahili'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Secondary Institutional Bridge for Officers & Ministries */}
          <motion.div
            variants={fadeUp}
            className="pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 max-w-xl text-start"
          >
            <div className="space-y-0.5 min-w-0">
              <span className="text-sm font-medium text-white flex items-center gap-1.5">
                {t('ui_hero_are_you_an_extension_officer_coopera')}
              </span>
              <p className="text-sm text-[#9db2a6] leading-snug">
                {t('ui_hero_manage_thousands_of_farmers_across_d')}
              </p>
            </div>
            <a
              href="#features"
              className="text-sm text-emerald-300 hover:text-emerald-200 underline underline-offset-4 whitespace-nowrap py-1"
            >
              {t('ui_hero_explore_organization_tools')}
            </a>
          </motion.div>
        </motion.div>

        {/* Right column — Plantix-Style Smartphone Leaf Scanner Mockup (Plain Language) */}
        <motion.div initial="hidden" animate="visible" variants={scaleIn} className="relative w-full max-w-full flex justify-center">
          {/* Smartphone Chassis */}
          <div className="relative w-full max-w-[370px] sm:max-w-[400px] rounded-[2.8rem] p-3.5 bg-white/[0.03] border-4 border-slate-700/60 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
            {/* Top speaker & camera bezel */}
            <div className="w-28 h-4 bg-[#0d1a14] rounded-full mx-auto mb-2 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-800" />
              <div className="w-10 h-1 bg-slate-800 rounded-full" />
            </div>

            {/* Smartphone Display */}
            <div className="rounded-[2.2rem] overflow-hidden bg-[#0d1a14] border border-white/10 relative flex flex-col text-start">
              {/* Phone Status Bar */}
              <div className="flex justify-between items-center px-5 pt-2 pb-1.5 text-[10px] text-white/60 font-mono bg-[#0d1a14]/90 border-b border-white/5">
                <span>09:41</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 font-medium">{t('ui_hero_illustrative_preview')}</span>
                </div>
              </div>

              {/* Crop Doctor App Header inside Phone */}
              <div className="px-4 py-2.5 bg-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">{t('ui_diagnosis_page_gpexts_crop_doctor')}</div>
                    <div className="text-[9px] text-emerald-300/80 font-mono">{t('ui_hero_maize_zea_mays_field_plot_2')}</div>
                  </div>
                </div>

                <span className="p-1.5 rounded-lg border border-white/10 text-xs flex items-center gap-1 text-white/70">
                  <BookOpenCheck className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-medium">{t('ui_hero_text_sample')}</span>
                </span>
              </div>

              {/* Camera Leaf Viewfinder */}
              <div className="relative h-[210px] sm:h-[230px] w-full overflow-hidden bg-white/[0.03]">
                <img
                  src="/images/landing/maize-leaf-diagnostics.webp"
                  alt="Illustrative close-up of a maize leaf"
                  className="w-full h-full object-cover object-center filter saturate-110"
                />
                <div data-scrim className="absolute inset-0 bg-gradient-to-t from-[#0d1a14] via-transparent to-black/30" />

                {/* Animated laser scanning line */}

                {/* Diagnostic Bounding Reticle in Plain Language */}
                <div className="absolute top-8 start-10 sm:start-14 w-44 h-28 border-2 border-emerald-400/90 rounded-xl bg-emerald-500/10 flex flex-col justify-between p-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-sans font-medium text-emerald-300 bg-[#0d1a14]/85 px-2 py-0.5 rounded border border-emerald-400/30 flex items-center gap-1">
                      <span>{t('ui_hero_affected_leaf_area')}</span>
                    </span>
                    <span />
                  </div>
                  <div className="bg-[#0d1a14]/90 backdrop-blur-md rounded-lg p-1.5 border border-emerald-400/40 text-start">
                    <div className="text-[10px] font-medium text-white flex items-center gap-1">
                      <span>{t('ui_hero_example_leaf_observation')}</span>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="text-[9px] text-emerald-400 font-medium">{t('ui_hero_illustration_not_a_diagnosis')}</div>
                  </div>
                </div>

                {/* Floating Location Tag in Plain Language */}
                <div className="absolute bottom-2.5 start-3 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[9px] font-medium text-white/90 border border-white/10">
                  {t('ui_hero_illustrative_sample_no_photo_was_upl')}
                </div>
              </div>

              {/* Diagnosis & Actionable Treatment Card in Plain Language */}
              <div className="p-4 bg-white/[0.03] border-t border-white/10 space-y-3">
                {/* Result header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-medium text-emerald-400 block">
                      {t('ui_hero_example_next_step')}
                    </span>
                    <h3 className="text-sm font-medium text-white">{t('ui_hero_unconfirmed_leaf_symptoms')}</h3>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('ui_hero_expert_review_needed')}
                  </span>
                </div>

                {/* Remedy Tabs Switcher */}
                <div role="group" aria-label="Example next steps" className="flex rounded-lg bg-black/40 p-0.5 border border-white/5 text-[11px] font-medium">
                  <button
                    type="button"
                    aria-pressed={activeRemedyTab === 'organic'}
                    onClick={() => setActiveRemedyTab('organic')}
                    className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                      activeRemedyTab === 'organic'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {t('ui_hero_observe')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeRemedyTab === 'standard'}
                    onClick={() => setActiveRemedyTab('standard')}
                    className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                      activeRemedyTab === 'standard'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {t('ui_hero_consult')}
                  </button>
                </div>

                {/* Remedy Content in Plain Language */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/80 leading-relaxed">
                  {activeRemedyTab === 'organic' ? (
                    <div>
                      <strong className="text-emerald-400 block text-[11px] mb-1">{t('ui_hero_record_symptoms')}</strong>
                      {t('ui_hero_note_the_crop_symptoms_and_location')}
                    </div>
                  ) : (
                    <div>
                      <strong className="text-emerald-400 block text-[11px] mb-1">{t('ui_hero_seek_local_advice')}</strong>
                      {t('ui_hero_consult_a_qualified_local_expert_to')}
                    </div>
                  )}
                </div>

                {/* Hyperlocal Rain Advisory Bar */}
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-2.5 text-xs text-sky-200">
                  <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="leading-tight text-[11px]">
                    <strong>{t('ui_hero_weather')}</strong> {t('ui_hero_this_illustration_is_not_a_forecast')}
                  </div>
                </div>

                {/* Tap to Launch Diagnosis Action Bar */}
                <button
                  type="button"
                  onClick={() => navigate('/diagnosis')}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 group cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{t('ui_hero_diagnose_your_own_crop_free')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Floating Real Farmer Trust Card (Real smallholder farmer in field) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="hidden sm:flex absolute -bottom-4 -start-6 z-30 p-2.5 rounded-2xl bg-white/[0.03] border border-emerald-500/30 backdrop-blur-xl shadow-2xl items-center gap-3 max-w-[270px]"
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-emerald-400/30">
              <img
                src="/images/landing/farmer-in-field-phone.webp"
                alt="Real smallholder farmer using smartphone in maize field"
                width={120}
                height={120}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="text-start min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-medium text-white">
                <span className="truncate">{t('ui_hero_amina_m')}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Bottom fade */}
      <div data-scrim className="absolute bottom-0 start-0 end-0 h-24 bg-gradient-to-t from-[#0d1a14] via-[#0d1a14]/60 to-transparent pointer-events-none z-20" />

    </section>
  );
}

export default Hero;
