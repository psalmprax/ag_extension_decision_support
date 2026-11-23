import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../variants';
import { audiences } from '../sectionData';
import { useLanguage } from '@/lib/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { CARD, CARD_BODY, CARD_TITLE, CONTAINER, ICON_TILE, SECTION } from './sectionStyles';

/** Farmers, officers and organisations: who GPExts supports. Anchored as #roi, as the footer links it. */
export function Community() {
  const { t } = useLanguage();
  return (
    <section id="roi" className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeader
          title={`${t('ui_roi_supporting_every_tier_of')} ${t('ui_roi_food_production')}`}
          intro={t('ui_roi_from_smallholder_plots_to_extension')}
        />
        <div className="grid md:grid-cols-3 gap-6">
          {audiences.map(audience => (
            <motion.div
              key={audience.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className={`${CARD} p-6 sm:p-7 space-y-3`}
            >
              <div className={ICON_TILE}>
                <audience.icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className={CARD_TITLE}>{t(audience.title)}</h3>
              <p className={CARD_BODY}>{t(audience.desc)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
