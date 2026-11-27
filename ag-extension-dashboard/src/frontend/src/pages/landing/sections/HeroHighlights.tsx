import React from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, Camera, CloudRain, Radio } from 'lucide-react';
import { fadeUp } from '../variants';
import { useLanguage } from '@/lib/LanguageContext';

const HIGHLIGHTS = [
  { icon: Camera, title: 'ui_hero_crop_assessment', note: 'ui_hero_possible_causes_not_a_diagnosis' },
  { icon: CloudRain, title: 'ui_hero_rain_forecasts', note: 'ui_hero_check_local_conditions' },
  { icon: Radio, title: 'ui_hero_field_tools', note: 'fieldtools_works_offline' },
  { icon: BookOpenCheck, title: 'ui_hero_text_in_local_dialect', note: 'ui_hero_swahili_luganda_hindi_20' },
] as const;

/** Four things a farmer gets, each with its limit, under the hero headline. */
export function HeroHighlights() {
  const { t } = useLanguage();
  return (
    <motion.ul variants={fadeUp} className="grid grid-cols-2 gap-2.5 sm:gap-3 max-w-xl mx-auto sm:mx-0">
      {HIGHLIGHTS.map(item => (
        <li key={item.title} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <item.icon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          </span>
          <span className="text-start min-w-0">
            <span className="block text-xs sm:text-sm font-medium text-white">{t(item.title)}</span>
            <span className="block text-xs text-white/60">{t(item.note)}</span>
          </span>
        </li>
      ))}
    </motion.ul>
  );
}
