/**
 * Shared Framer Motion variants to eliminate duplication across 43+ files.
 * Import and use directly: <motion.div {...modalVariants}>
 */

import type { Variants, Transition } from 'framer-motion';

const spring: Transition = { type: 'spring', stiffness: 300, damping: 24 };

export const modalVariants: Variants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15 } },
};

export const slideRightVariants: Variants = {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

export const fadeVariants: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const staggerContainer: Variants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.05 } },
};

export const staggerItem: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export const sidebarVariants: Variants = {
    initial: { width: 0, opacity: 0, x: -20 },
    animate: { width: '18rem', opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { width: 0, opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export const cardHoverVariants: Variants = {
    initial: {},
    hover: { scale: 1.01, transition: spring },
};

export const dropdownVariants: Variants = {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.1 } },
};
