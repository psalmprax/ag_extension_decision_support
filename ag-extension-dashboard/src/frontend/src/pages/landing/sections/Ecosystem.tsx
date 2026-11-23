import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Sprout } from 'lucide-react';
import { fadeUp } from '../variants';
import { capabilities, operationalStandards } from '../sectionData';
import { useLanguage } from '@/lib/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { CARD, CARD_BODY, CARD_LABEL, CONTAINER, ICON_TILE, SECTION } from './sectionStyles';

/** One reading in the illustrative intelligence trail: label, example value, and where it would come from. */
function TrailReading({ label, value, note, source }: { label: string; value: string; note: string; source: string }) {
  return (
    <div className="p-4 rounded-xl bg-[#0d1a14]/60 border border-white/[0.06]">
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <div className="text-lg font-medium text-white tabular-nums">
        {value} <span className="text-xs font-normal text-white/60">{note}</span>
      </div>
      <div className="text-xs text-white/50 mt-1">{source}</div>
    </div>
  );
}

/**
 * The data behind the advice: weather, soil, retrieval and offline sync, an illustrative trail of
 * field readings (example values, not a live feed), and the platform's operating standards.
 */
export function Ecosystem() {
  const { t } = useLanguage();
  return (
    <section id="capabilities" className={SECTION}>
      <div id="architecture" className="absolute -top-16" aria-hidden="true" />
      <div className={CONTAINER}>
        <SectionHeader title={t('ui_demo_engineered_for_precision_resilience')} intro={t('ui_demo_supporting_field_workflows_with_avai')} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {capabilities.map(capability => (
            <motion.div
              key={capability.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className={`${CARD} p-6 space-y-3`}
            >
              <div className={ICON_TILE}>
                <capability.icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className={CARD_LABEL}>{t(capability.badge)}</div>
              <h3 className="text-base font-medium text-white">{t(capability.title)}</h3>
              <p className={CARD_BODY}>{t(capability.desc)}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className={`${CARD} mt-8 p-6 sm:p-8`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className={ICON_TILE}>
                <Sprout className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-medium text-white flex flex-wrap items-center gap-2">
                  {t('ui_demo_agronomic_intelligence_trail')}
                  <span className="text-xs font-normal px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-[#c5d3cb]">
                    {t('ui_demo_illustrative_sample')}
                  </span>
                </h3>
                <p className="text-xs text-white/60">{t('ui_demo_multi_parameter_field_data_stream_sy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Activity className="w-4 h-4 text-white/40" aria-hidden="true" />
              <span>{t('ui_demo_example_values_not_a_live_feed')}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <TrailReading label={t('ui_demo_ndvi_canopy_vigor')} value="0.78" note={t('ui_demo_high')} source={t('ui_demo_sentinel_2_multispectral')} />
            <TrailReading label={t('ui_demo_soil_ph_carbon')} value="6.4 pH" note={t('ui_demo_optimal')} source={t('ui_demo_soilgrids_0_30cm_depth')} />
            <TrailReading label={t('ui_soil_climate_sample_card_soil_moisture')} value="31.2%" note={t('ui_demo_field_cap')} source={t('ui_demo_nasa_power_7_day_model')} />
            <TrailReading label={t('ui_demo_pest_risk_index')} value={t('ui_demo_low_risk')} note="9%" source={t('ui_demo_fao_early_warning_vector')} />
          </div>
        </motion.div>

        <div className="mt-10 pt-8 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {operationalStandards.map(item => (
            <a
              key={item.id}
              href={item.target}
              className="space-y-1 p-2 rounded-xl hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <div className="text-sm sm:text-base font-medium text-emerald-400">{t(item.title)}</div>
              <div className="text-xs text-white/60">{t(item.sub)}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
