import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { fadeUp } from '../variants';
import { painPoints } from '../sectionData';
import { useLanguage } from '@/lib/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { CONTAINER, SECTION } from './sectionStyles';

/** Four everyday farm problems, each beside what GPExts offers instead. */
export function Problem() {
  const { t } = useLanguage();
  return (
    <section id="problem" className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeader
          title={`${t('ui_problem_farming_is_hard_enough')} ${t('ui_problem_without_the_guesswork')}`}
          intro={t('ui_problem_stop_losing_harvests_to_slow_advice')}
        />
        <div className="space-y-3">
          {painPoints.map(item => (
            <motion.div
              key={item.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeUp}
              className="grid md:grid-cols-2 gap-3"
            >
              <div className="flex items-start gap-3 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <XCircle className="w-4 h-4 text-white/40 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm text-white/60 leading-relaxed">{t(item.problem)}</span>
              </div>
              <div className="flex items-start gap-3 p-5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm text-white/80 leading-relaxed">{t(item.solution)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
