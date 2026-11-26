import React from 'react';
import { motion } from 'framer-motion';
import { Building2, CheckCircle2, Radio, MessageSquare } from 'lucide-react';
import { fadeUp } from '../variants';
import { useLanguage } from '@/lib/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { AdvisorySimulator } from './AdvisorySimulator';
import { CARD, CARD_TITLE, CONTAINER, ICON_TILE, SECTION } from './sectionStyles';

const CHIP = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-[#c5d3cb]';

/** For organisations: the multi-agent extension OS for districts and cooperatives, and the advisory simulator. */
export function AgentOS() {
  const { t } = useLanguage();
  return (
    <section id="agent-os" className={SECTION}>
      <div className={CONTAINER}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className={`${CARD} p-6 sm:p-8 mb-14 sm:mb-16 flex items-start sm:items-center gap-4`}
        >
          <div className={ICON_TILE}>
            <Building2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className={`${CARD_TITLE} mb-1`}>{t('ui_landing_page_autonomous_multi_agent_extension_os')}</h3>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">{t('ui_landing_page_simulate_regional_pest_intervention')}</p>
          </div>
        </motion.div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <span className={CHIP}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            {t('ui_diagnosis_page_crop_observations')}
          </span>
          <span className={CHIP}>
            <Radio className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            {t('ui_agent_os_weather_context')}
          </span>
          <span className={CHIP}>
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            {t('ui_agent_os_channel_examples')}
          </span>
        </div>

        <SectionHeader
          title={`${t('ui_agent_os_explore_an_example_advisory_workflow')} ${t('ui_agent_os_in_a_simulator')}`}
          intro={t('ui_agent_os_select_a_fictional_scenario_to_explo')}
        />
        <AdvisorySimulator />
      </div>
    </section>
  );
}
