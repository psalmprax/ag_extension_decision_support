import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { CONTAINER, SECTION } from './sectionStyles';
import { PhotoBackdrop } from './PhotoBackdrop';

/** Why GPExts exists, in one heading and one paragraph. */
export function Mission() {
  const { t } = useLanguage();
  return (
    <section id="mission" className={SECTION}>
      <PhotoBackdrop src="/images/landing/officer-farmer-hero-1024.webp" width={1024} height={576} position="center 35%" />
      <div className={CONTAINER}>
        <SectionHeader
          title={`${t('ui_mission_closing_the_gap_between')} ${t('ui_mission_agricultural_data')} ${t('ui_mission_and_field_decisions')}`}
          intro={t('ui_mission_across_the_globe_extension_officers')}
          alone
        />
      </div>
    </section>
  );
}
