import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera, CloudRain, TrendingUp, BookOpenCheck,
  ArrowRight, Check, Volume2
} from 'lucide-react';
import { stagger, fadeUp } from '../variants';
import { MarketPriceCard } from './MarketPriceCard';
import { useLandingPrices } from './useLandingPrices';
import { useLanguage } from '@/lib/LanguageContext';

export function FarmerServices() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activeDialect, setActiveDialect] = useState<'sw' | 'lg' | 'en'>('sw');
  const livePrices = useLandingPrices();

  const selectDialect = (lang: 'sw' | 'lg' | 'en') => {
    setActiveDialect(lang);
  };

  return (
    <section id="services" className="relative py-20 sm:py-28 border-t border-white/[0.06]  overflow-hidden">
      {/* Subtle Agricultural Crop Backdrop Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src="/images/landing/maize-field-sunrise.webp"
          alt=""
          role="presentation"
          aria-hidden="true"
          width={1319}
          height={860}
          className="w-full h-full object-cover object-center opacity-10 filter saturate-125 contrast-105 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1a14] via-[#0d1a14]/80 to-[#0d1a14]" />
      </div>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center max-w-3xl mx-auto mb-14 sm:mb-20"
        >
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-medium leading-tight text-white mb-4">
            {t('ui_farmer_services_everything_you_need_to')}
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed font-normal"
          >
            {t('ui_farmer_services_designed_for_smallholder_farms_with')}
          </motion.p>
        </motion.div>

        {/* 4 Core Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Service 1: Diagnose My Crop */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-emerald-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-lg bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-emerald-300 ">
                  <Camera className="w-7 h-7" />
                </div>
                <span className="text-xs text-[#9db2a6]">
                  {t('ui_farmer_services_crop_assessment')}
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  {t('ui_farmer_services_diagnose_my_crop')}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {t('ui_farmer_services_share_a_crop_photo_or_symptoms_for_a')}
                </p>
              </div>

              <div className="pt-2 space-y-2 text-xs sm:text-sm text-white/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t('ui_farmer_services_explore_possible_causes_of_visible_s')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t('ui_farmer_services_consult_a_local_expert_before_treatm')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t('ui_farmer_services_cloud_analysis_requires_connectivity')}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => navigate('/diagnosis')}
                className="w-full sm:w-auto h-11 px-5 rounded-md border border-white/[0.16] text-[#e6eee9] hover:bg-white/[0.06] hover:text-white text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span>{t('ui_farmer_services_diagnose_a_crop_free')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Service 2: Check Rain & Spray Weather */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-emerald-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-lg bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-emerald-300 ">
                  <CloudRain className="w-7 h-7" />
                </div>
                <span className="text-xs text-[#9db2a6]">
                  {t('ui_farmer_services_weather_information')}
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  {t('ui_farmer_services_check_the_weather')}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {t('ui_farmer_services_review_available_forecasts_alongside')}
                </p>
              </div>

              <div className="pt-2 space-y-2 text-xs sm:text-sm text-white/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t('ui_farmer_services_weather_coverage_and_detail_depend_o')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t('ui_farmer_services_forecasts_can_change_and_should_not')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{t('ui_farmer_services_messaging_availability_depends_on_yo')}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => navigate('/demo')}
                className="w-full sm:w-auto h-11 px-5 rounded-md border border-white/[0.16] text-[#e6eee9] hover:bg-white/[0.06] hover:text-white text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <CloudRain className="w-4 h-4" />
                <span>{t('ui_farmer_services_explore_platform_demo')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Service 3: Check Fair Market Prices */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-amber-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-lg bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-emerald-300 ">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <span className="text-xs text-[#9db2a6]">
                  {t('ui_farmer_services_regional_commodity_tracking')}
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                  {t('ui_farmer_services_check_fair_market_prices')}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {livePrices
                    ? 'Annual national producer prices for maize, dry beans and sorghum, published by FAOSTAT.'
                    : 'Preview how regional commodity prices could be shown. The figures below are illustrative demo data, not current market observations.'}
                </p>
              </div>

              {/* Commodity Price Preview Snippet */}
              <MarketPriceCard snapshot={livePrices} />

              <div className="pt-2 space-y-2 text-xs sm:text-sm text-white/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{livePrices ? 'Producer prices for maize, dry beans & sorghum' : 'Example prices for maize, beans & sorghum'}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{livePrices ? 'Annual national averages from FAOSTAT, republished yearly' : 'No live market feed is connected to this preview'}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{livePrices ? 'Year-on-year change against the previous published year' : 'Local currency conversions & retail median trend graphs'}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => navigate('/demo')}
                className="w-full sm:w-auto h-11 px-5 rounded-md border border-white/[0.16] text-[#e6eee9] hover:bg-white/[0.06] hover:text-white text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                <span>{t('ui_farmer_services_open_market_demo')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Service 4: Read Advice in Your Dialect */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="group relative rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/50 p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-emerald-950/40"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-lg bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-emerald-300 ">
                  <BookOpenCheck className="w-7 h-7" />
                </div>
                <span className="text-xs text-[#9db2a6]">
                  {t('ui_farmer_services_text_voice')}
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                  {t('ui_farmer_services_read_advice_in_your_dialect')}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {t('ui_farmer_services_choose_a_language_to_read_a_sample_o')}
                </p>
              </div>

              {/* Interactive Dialect Transcript Card */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                <div className="text-xs font-semibold text-emerald-300 flex items-center justify-between">
                  <span>{t('ui_farmer_services_advice_text_preview')}</span>
                  <span className="text-xxs font-mono text-white/60">{t('ui_farmer_services_select_a_language')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectDialect('sw')}
                    aria-pressed={activeDialect === 'sw'}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                      activeDialect === 'sw'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>{t('ui_farmer_services_swahili_kiswahili')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDialect('lg')}
                    aria-pressed={activeDialect === 'lg'}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                      activeDialect === 'lg'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>{t('ui_farmer_services_luganda')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDialect('en')}
                    aria-pressed={activeDialect === 'en'}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                      activeDialect === 'en'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>{t('ui_bulk_update_modal_english')}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200">
                  <span className="italic leading-snug">
                    {activeDialect === 'sw' && '"Wasiliana na afisa ugani wa eneo lako."'}
                    {activeDialect === 'lg' && '"Tuukirira omukugu mu by\'obulimi ow\'omu kitundu kyo."'}
                    {activeDialect === 'en' && '"Contact your local extension officer."'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#talking-assistant';
                  window.dispatchEvent(new CustomEvent('open-talking-assistant'));
                }}
                className="w-full sm:w-auto h-11 px-5 rounded-md border border-white/[0.16] text-[#e6eee9] hover:bg-white/[0.06] hover:text-white text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Volume2 className="w-4 h-4" />
                <span>{t('ui_farmer_services_open_talking_assistant')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default FarmerServices;
