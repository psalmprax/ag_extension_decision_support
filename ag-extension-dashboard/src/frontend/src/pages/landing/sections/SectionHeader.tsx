import React from 'react';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../variants';

/**
 * A section's centred heading and introduction, as the current landing sections set them.
 * `alone` drops the space below, for a section that is only a heading and introduction.
 */
export function SectionHeader({ title, intro, alone = false }: { title: string; intro?: string; alone?: boolean }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={stagger}
      className={`text-center max-w-3xl mx-auto ${alone ? '' : 'mb-14 sm:mb-16'}`}
    >
      <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-medium leading-tight text-white mb-4">
        {title}
      </motion.h2>
      {intro && (
        <motion.p variants={fadeUp} className="text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed font-normal">
          {intro}
        </motion.p>
      )}
    </motion.div>
  );
}
