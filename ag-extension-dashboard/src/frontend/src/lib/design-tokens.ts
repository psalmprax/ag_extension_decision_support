/**
 * Centralized design tokens extracted from Tailwind config, index.css,
 * and useDesignSystemMode. Values are NOT new — they name what's already in use.
 */

export const SPACING = {
    xs: 'p-1',       // 4px
    base: 'p-2',     // 8px
    sm: 'p-3',       // 12px
    md: 'p-6',       // 24px (custom 'md' token)
    gutter: 'p-6',   // 24px (alias)
    lg: 'p-12',      // 48px
    xl: 'p-20',      // 80px
} as const;

export const TYPOGRAPHY = {
    // Labels and captions (used in sidebar nav, badges, meta text)
    label: 'text-[10px] font-bold uppercase tracking-widest',
    caption: 'text-xs font-medium',
    // Body text
    body: 'text-sm font-medium',
    bodyLarge: 'text-base font-medium',
    // Headings
    headingSm: 'text-lg font-bold tracking-tight',
    headingMd: 'text-xl font-bold tracking-tight',
    headingLg: 'text-2xl font-black tracking-tighter',
    headingXl: 'text-3xl font-black tracking-tighter',
    // Data/metrics
    metric: 'text-3xl font-black tracking-tighter',
} as const;

export const RADIUS = {
    modern: 'rounded-2xl',
    classic: 'rounded-none',
    modernSm: 'rounded-xl',
    modernFull: 'rounded-full',
} as const;

export const SHADOW = {
    modern: 'shadow-[0_4px_6px_-1px_rgb(0_0_0/0.1),0_2px_4px_-2px_rgb(0_0_0/0.1)]',
    modernHover: 'hover:shadow-2xl',
    neon: 'shadow-[0_0_15px_rgba(0,245,255,0.3)]',
    neonHover: 'hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]',
} as const;

export const GLASS = {
    panel: 'backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10',
    edge: 'border-b border-white/10',
    rim: 'border-r border-white/10',
} as const;

export const TRANSITION = {
    base: 'transition-all duration-200',
    slow: 'transition-all duration-300',
    scale: 'hover:scale-[1.02] active:scale-[0.98]',
} as const;
