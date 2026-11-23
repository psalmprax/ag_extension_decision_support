import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { personas, pipelineStages, STAGE_STORIES, type AudiencePersona } from '../pipelineStories';
import { useLanguage } from '@/lib/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { BUTTON_SECONDARY, CARD, CONTAINER, ICON_TILE, SECTION, choiceClass } from './sectionStyles';

const STEP_BUTTON =
  'w-11 h-11 inline-flex items-center justify-center rounded-md border border-white/[0.12] text-white/70 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

/**
 * From satellite to soil to a farmer's phone: four stages, told for field officers,
 * agribusiness or governments and donors.
 */
export function Pipeline() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<AudiencePersona>('officers');
  const [stage, setStage] = useState(0);
  const story = STAGE_STORIES[persona][stage];
  const StageIcon = pipelineStages[stage].icon;
  const count = pipelineStages.length;

  return (
    <section id="interactive-story" className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeader title={t('ui_agro_storytelling_section_from_satellite_orbit_to_soil_root_zo')} />

        <div role="group" aria-label={t('ui_agro_storytelling_section_agronomic_intelligence_pipeline')} className="flex flex-wrap justify-center gap-2 mb-10">
          {personas.map(option => (
            <button
              key={option.id}
              type="button"
              aria-pressed={persona === option.id}
              aria-label={`View story as ${option.label}`}
              onClick={() => setPersona(option.id)}
              className={`${choiceClass(persona === option.id)} inline-flex items-center gap-2 px-4 py-2 text-sm`}
            >
              <option.icon className="w-4 h-4" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <ol className="lg:col-span-5 space-y-2">
            {pipelineStages.map((item, index) => (
              <li key={item.name}>
                <button
                  type="button"
                  aria-label={`Jump to stage ${STAGE_STORIES[persona][index].num}`}
                  aria-current={stage === index ? 'step' : undefined}
                  onClick={() => setStage(index)}
                  className={`${choiceClass(stage === index)} w-full p-4 flex items-start gap-3`}
                >
                  <item.icon className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium">
                      <span className="tabular-nums text-white/50 me-2">{STAGE_STORIES[persona][index].num}</span>
                      {item.name}
                    </span>
                    <span className="block text-xs text-white/60 mt-0.5">{item.subtitle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className={`${CARD} lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6`} aria-live="polite">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={ICON_TILE}>
                    <StageIcon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-white/60">{story.category}</span>
                </div>
                <span className="px-3 py-1 rounded-md text-xs bg-white/[0.06] border border-white/[0.1] text-white/90 tabular-nums">
                  {t('ui_agro_storytelling_section_step_04', { num: story.num })}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-medium text-white mb-4 leading-snug">{story.title}</h3>
              <ul className="space-y-3">
                {story.bullets.map(bullet => (
                  <li key={bullet} className="flex items-start gap-3 text-sm text-white/80">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/[0.06]">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                {story.tag}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous step" onClick={() => setStage((stage - 1 + count) % count)} className={STEP_BUTTON}>
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button type="button" aria-label="Next step" onClick={() => setStage((stage + 1) % count)} className={STEP_BUTTON}>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button type="button" aria-label="Open interactive demo sandbox" onClick={() => navigate('/demo')} className={BUTTON_SECONDARY}>
                  {t('ui_agro_storytelling_section_try_demo')}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
