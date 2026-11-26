/**
 * The landing page's section, card and button classes, as the current sections use them, so
 * every section reads as one design.
 */
export const SECTION = 'relative py-20 sm:py-28 border-t border-white/[0.06] bg-[#0d1a14] overflow-hidden scroll-mt-16';
export const CONTAINER = 'max-w-6xl w-full mx-auto px-4 sm:px-6 relative z-10';
export const CARD =
  'rounded-2xl backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-300';
export const ICON_TILE =
  'w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0';
/**
 * Headings, in Literata (option B in docs/HEADINGS_AND_TYPE_PROPOSAL.md): the hero title,
 * a section's title (48px on wide screens) and a card's title. Body text stays Atkinson.
 */
export const HERO_TITLE = 'font-title text-[32px] sm:text-5xl lg:text-[56px] font-medium leading-[1.08] text-white';
export const SECTION_TITLE = 'font-title text-[32px] sm:text-5xl font-medium leading-[1.1] text-white';
export const CARD_TITLE = 'font-title text-xl sm:text-2xl font-medium leading-snug text-white';
export const CARD_BODY = 'text-xs sm:text-sm text-white/70 leading-relaxed';
/** A short label on a card: sentence case, muted green. */
export const CARD_LABEL = 'text-xs font-medium text-emerald-300';
export const BUTTON_PRIMARY =
  'inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-medium text-white rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
export const BUTTON_SECONDARY =
  'inline-flex items-center justify-center gap-2 h-11 px-5 text-sm border border-white/[0.16] text-[#e6eee9] rounded-md hover:bg-white/[0.06] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
/** A choice in a row of choices (tabs, scenarios); pass whether it is chosen. */
export const choiceClass = (chosen: boolean) =>
  `rounded-md border text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
    chosen
      ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
      : 'bg-white/[0.02] border-white/[0.08] text-white/70 hover:bg-white/[0.05] hover:text-white'
  }`;
