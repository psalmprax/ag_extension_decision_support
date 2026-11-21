import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { stagger, fadeUp } from '../variants';
import { faqItems } from '../data';
import { useLanguage } from '@/lib/LanguageContext';

export function FAQ() {
  const { t } = useLanguage();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(prev => (prev === index ? null : index));
  };

  return (
        <section id="faq" className="relative py-28 border-t border-white/[0.04]">
          <div className="max-w-4xl mx-auto px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-medium leading-tight text-white mb-4">
                {t('ui_faq_everything_you_need_to_know_about')}
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/60 max-w-xl mx-auto mt-3 font-normal"
              >
                {t('ui_faq_transparent_answers_on_data_ownershi')}
              </motion.p>
            </motion.div>

            <div className="space-y-3">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <motion.div
                    key={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    variants={fadeUp}
                    className="rounded-xl border border-white/[0.08] backdrop-blur-md bg-white/[0.03] hover:border-emerald-500/30 transition-all duration-300 overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      onClick={() => toggleFaq(index)}
                      className="w-full p-6 text-start flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <span className="text-base sm:text-lg font-semibold text-white/90 leading-snug">
                        {item.question}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 text-white/60 group-hover:text-emerald-400">
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`faq-answer-${index}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-white/65 leading-relaxed font-normal border-t border-white/[0.03]">
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
  );
}
