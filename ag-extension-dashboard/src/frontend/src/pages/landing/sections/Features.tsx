import React from 'react';
import { motion } from 'framer-motion';
import { Users, BarChart3, CheckCircle2, MessageSquare, Smartphone } from 'lucide-react';
import { stagger, fadeUp } from '../variants';
import { useLanguage } from '@/lib/LanguageContext';

export function Features() {
  const { t } = useLanguage();
  return (
        <section id="features" className="relative py-20 sm:py-28 border-t border-white/[0.04]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center max-w-3xl mx-auto mb-14 sm:mb-20"
            >
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4"
              >
                <Users className="w-3.5 h-3.5" />
                {t('ui_features_who_we_empower')}
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight leading-tight text-white mb-4"
              >
                {t('ui_features_built_for_the_real_field')}{' '}
                <span className="text-emerald-400">
                  {t('ui_features_grounded_in_rural_realities')}
                </span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/70 leading-relaxed font-normal"
              >
                {t('ui_features_connecting_smallholder_farms_mobile')}
              </motion.p>
            </motion.div>

            {/* 3-Persona Visual Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {/* Persona 1: The Smallholder Farmer */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="group relative rounded-xl backdrop-blur-xl bg-slate-900/80 border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src="/images/landing/farmer-inspecting-ear.webp"
                    alt="African smallholder farmer inspecting healthy maize crop in field"
                    width={600}
                    height={450}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-amber-500/30 text-amber-300 text-xxs font-medium">
                    <MessageSquare className="w-3 h-3 text-amber-400" />
                    {t('ui_features_direct_farmer_advisory')}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-xxs font-mono text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      {t('ui_features_zero_smartphone_required')}
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                      {t('ui_features_the_smallholder_farmer')}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      {t('ui_features_may_receive_messages_through_configu')}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs text-white/80 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_2g_3g_sms_ussd_direct_dialing')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_hyperlocal_nasa_rain_storm_warnings')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_swahili_luganda_english_voice_stt')}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Persona 2: The Agricultural Extension Officer */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="group relative rounded-xl backdrop-blur-xl bg-slate-900/80 border border-emerald-500/30 hover:border-emerald-500/60 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl shadow-emerald-950/30 hover:shadow-emerald-950/60 ring-1 ring-emerald-500/20"
              >
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src="/images/landing/persona-officer.webp"
                    alt="Field extension officer diagnosing crop leaf health in the field with mobile AI app"
                    width={600}
                    height={450}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xxs font-medium">
                    <Smartphone className="w-3 h-3 text-emerald-400" />
                    {t('ui_features_field_ready_mobile_pwa')}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-xxs font-mono text-emerald-300 bg-emerald-500/30 border border-emerald-400/40 px-2 py-0.5 rounded-md font-bold">
                      {t('ui_features_selected_offline_workflows')}
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                      {t('ui_features_the_field_extension_officer')}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      {t('ui_features_records_field_observations_using_ava')}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs text-white/80 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_offline_encrypted_indexeddb_storage')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_image_assessment_requiring_expert_co')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_gps_parcel_mapping_yield_scoring')}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Persona 3: Regional & Cooperative Managers */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="group relative rounded-xl backdrop-blur-xl bg-slate-900/80 border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src="/images/landing/persona-manager.webp"
                    alt="Regional agribusiness manager analyzing yield analytics and field operations on dashboard"
                    width={600}
                    height={450}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xxs font-medium">
                    <BarChart3 className="w-3 h-3 text-cyan-400" />
                    {t('ui_features_macro_yield_supply_intelligence')}
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-xxs font-mono text-cyan-300 bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                      {t('ui_features_enterprise_oversight')}
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                      {t('ui_features_regional_cooperative_directors')}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      {t('ui_features_tracks_district_wide_disease_vectors')}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs text-white/80 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_district_wide_outbreak_soil_heatmaps')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_extension_officer_visit_efficacy_met')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{t('ui_features_1_click_auditable_pdf_excel_exports')}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
  );
}
