// Animation variants moved verbatim from pages/LandingPage.tsx (pure move).
// ─── Animation variants ─────────────────────────────────────────
export const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};
