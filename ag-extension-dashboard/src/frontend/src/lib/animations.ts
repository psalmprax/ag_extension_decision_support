/**
 * Shared Framer Motion variants to eliminate duplication across 43+ files.
 * Import and use directly: <motion.div {...modalVariants}>
 */

import type { Variants } from 'framer-motion';






export const sidebarVariants: Variants = {
  initial: { width: 0, opacity: 0, x: -20 },
  animate: { width: '18rem', opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { width: 0, opacity: 0, x: -20, transition: { duration: 0.2 } },
};


export const dropdownVariants: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.1 } },
};
