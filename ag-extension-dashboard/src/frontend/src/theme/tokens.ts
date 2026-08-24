/**
 * Canonical design tokens — the single source of truth for every color used by the
 * GPExts dashboard.
 *
 * Consumed by:
 *   - src/theme/index.ts         (runtime CSS variable emission, per-theme + dark mode)
 *   - tailwind.config.js          (Tailwind `colors` generation)
 *   - src/lib/colors.ts           (CH_COLORS re-export for imperative/JS styling)
 *
 * Do NOT hardcode color values anywhere else. If a color is missing, add it here.
 */

export type ThemeName =
  | 'forest'
  | 'golden'
  | 'terracotta'
  | 'oceanic'
  | 'sunset'
  | 'sage'
  | 'cyber';

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface ThemeColors {
  primary: ColorScale;
  secondary: ColorScale;
  accent: ColorScale;
  background: {
    primary: string;
    secondary: string;
    card: string;
  };
}

/** Steps present in every color scale (drives Tailwind + CSS var generation). */
export const COLOR_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export const themes: Record<ThemeName, ThemeColors> = {
  /** Rich greens representing lush crops and forests. */
  forest: {
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    secondary: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4',
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
    },
    accent: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
    background: {
      primary: '#f0fdf4',
      secondary: '#dcfce7',
      card: '#ffffff',
    },
  },

  /** Warm amber/gold representing wheat fields and harvest. */
  golden: {
    primary: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    secondary: {
      50: '#fdf4ff',
      100: '#fae8ff',
      200: '#f5d0fe',
      300: '#f0abfc',
      400: '#e879f9',
      500: '#d946ef',
      600: '#c026d3',
      700: '#a21caf',
      800: '#86198f',
      900: '#701a75',
    },
    accent: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    background: {
      primary: '#fffbeb',
      secondary: '#fef3c7',
      card: '#ffffff',
    },
  },

  /** Earthy reds and oranges representing soil and clay. */
  terracotta: {
    primary: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    secondary: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    accent: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    background: {
      primary: '#fef2f2',
      secondary: '#fee2e2',
      card: '#ffffff',
    },
  },

  /** Blues representing water, irrigation, and coastal farming. */
  oceanic: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
    accent: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    background: {
      primary: '#eff6ff',
      secondary: '#dbeafe',
      card: '#ffffff',
    },
  },

  /** Warm gradients representing evening harvest and twilight. */
  sunset: {
    primary: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    secondary: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    accent: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
    },
    background: {
      primary: '#fff7ed',
      secondary: '#ffedd5',
      card: '#ffffff',
    },
  },

  /** Muted greens representing herbs, vegetables, and organic farming. */
  sage: {
    primary: {
      50: '#f6fcf5',
      100: '#eef7ed',
      200: '#d8edd6',
      300: '#b8deb8',
      400: '#8eca93',
      500: '#6bb872',
      600: '#4d9654',
      700: '#3d7543',
      800: '#335e38',
      900: '#2a4d30',
    },
    secondary: {
      50: '#fdf4ff',
      100: '#fae8ff',
      200: '#f5d0fe',
      300: '#f0abfc',
      400: '#e879f9',
      500: '#d946ef',
      600: '#c026d3',
      700: '#a21caf',
      800: '#86198f',
      900: '#701a75',
    },
    accent: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    background: {
      primary: '#f6fcf5',
      secondary: '#eef7ed',
      card: '#ffffff',
    },
  },

  /** High-contrast dark theme with glassmorphism and neon cyan accents. */
  cyber: {
    primary: {
      50: '#e9feff',
      100: '#d1f9ff',
      200: '#a3f3ff',
      300: '#63f7ff',
      400: '#00f5ff',
      500: '#00dce5',
      600: '#00b4bb',
      700: '#008b91',
      800: '#006267',
      900: '#003a3d',
    },
    secondary: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
    accent: {
      50: '#e9feff',
      100: '#d1f9ff',
      200: '#a3f3ff',
      300: '#63f7ff',
      400: '#00f5ff',
      500: '#00dce5',
      600: '#00b4bb',
      700: '#008b91',
      800: '#006267',
      900: '#003a3d',
    },
    background: {
      primary: '#0c1324',
      secondary: '#151b2d',
      card: 'rgba(255, 255, 255, 0.05)',
    },
  },
};

/** Error/red ramp — constant across themes (light: standard, dark: inverted). */
export const errorScale: ColorScale = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
};

/** Semantic, theme-independent accents used by charts, statuses, and the map. */
export interface SemanticTokens {
  status: { success: string; warning: string; error: string; info: string };
  chart: { green: string; blue: string; purple: string; cyber: string; gray: string };
  map: {
    bg: string;
    border: string;
    text: string;
    lightBg: string;
    lightText: string;
    cyberBg: string;
    cyberBorder: string;
  };
  cyber: { DEFAULT: string; dark: string; light: string; hover: string };
}

export const semanticTokens: SemanticTokens = {
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  chart: {
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    cyber: '#4fd1c5',
    gray: '#9ca3af',
  },
  map: {
    bg: '#1f2937',
    border: '#374151',
    text: '#d1d5db',
    lightBg: '#f3f4f6',
    lightText: '#374151',
    cyberBg: '#010101',
    cyberBorder: '#00ffff',
  },
  cyber: {
    DEFAULT: '#00f5ff',
    dark: '#006c71',
    light: '#a3f3ff',
    hover: '#00dce5',
  },
};

/** Surface/outline tokens — these flip between light and dark mode. */
export interface SurfaceTokens {
  surface: string;
  onSurface: string;
  onSurfaceVariant: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  outline: string;
  outlineVariant: string;
}

export const surfaceTokens: { light: SurfaceTokens; dark: SurfaceTokens } = {
  light: {
    surface: '#ffffff',
    onSurface: '#1f2937',
    onSurfaceVariant: '#4b5563',
    primaryContainer: '#00b4bb',
    onPrimaryContainer: '#003a3d',
    secondaryContainer: '#6d28d9',
    onSecondaryContainer: '#ede9fe',
    tertiaryContainer: '#e5e7eb',
    onTertiaryContainer: '#374151',
    outline: '#94a3b8',
    outlineVariant: '#cbd5e1',
  },
  dark: {
    surface: '#0c1324',
    onSurface: '#dce1fb',
    onSurfaceVariant: '#b9caca',
    primaryContainer: '#00f5ff',
    onPrimaryContainer: '#006c71',
    secondaryContainer: '#7000ff',
    onSecondaryContainer: '#ddcdff',
    tertiaryContainer: '#dddddd',
    onTertiaryContainer: '#606162',
    outline: '#849495',
    outlineVariant: '#3a494a',
  },
};

/** Non-color design tokens (kept here so Tailwind config has zero hardcoded values). */
export const designTokens = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    headline: ['Space Grotesk', 'sans-serif'],
    // GRP-03 "Data & Numerical Typeface": JetBrains Mono with tabular numerals
    // (see the .font-mono override in index.css which applies tabular-nums).
    mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
  },
  // GRP-04 "Modular Type Hierarchy" sets the Micro/Overline floor at 12px.
  // The legacy 9/10/11px overlines below are collapsed to that floor.
  fontSize: {
    micro: '12px',
    xxs: '12px',
    'xs-plus': '12px',
  },
  spacing: {
    gutter: '24px',
    margin: '32px',
    md: '24px',
    xs: '4px',
    xl: '80px',
    sm: '12px',
    'container-max': '1440px',
    base: '8px',
    lg: '48px',
  },
  borderRadius: {
    card: 'var(--radius-card)',
    sm: '0.125rem',
    DEFAULT: 'var(--radius-card)',
    md: 'var(--radius-card)',
    lg: 'var(--radius-card)',
    xl: 'var(--radius-card)',
    '2xl': 'var(--radius-card)',
    '3xl': 'var(--radius-card)',
    full: '9999px',
  },
  boxShadow: {
    premium: 'var(--shadow-premium)',
    // GRP-09 "Natural Multi-Stop Elevation Shadows"
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    neon: '0 0 15px rgba(0, 245, 255, 0.3)',
    'glow-success': '0 0 10px rgba(16, 185, 129, 0.5)',
    'glow-warning': '0 0 10px rgba(245, 158, 11, 0.5)',
    'glow-error': '0 0 10px rgba(239, 68, 68, 0.5)',
    'glow-primary': '0 0 20px rgba(34, 211, 238, 0.2)',
    'glow-cyber': '0 0 30px rgba(79, 209, 197, 0.1)',
    'map-shadow': '0 4px 6px rgba(0,0,0,0.3)',
    'map-shadow-md': '0 8px 12px rgba(0,0,0,0.4)',
    'map-shadow-lg': '0 12px 20px rgba(0,0,0,0.5)',
  },
};

/** Convert a camelCase key to kebab-case for CSS variable names. */
export function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
}

/** Surface token keys paired with their CSS variable suffixes (kebab-case). */
export const SURFACE_TOKEN_NAMES: ReadonlyArray<{ key: keyof SurfaceTokens; cssVar: string }> = [
  { key: 'surface', cssVar: 'surface' },
  { key: 'onSurface', cssVar: 'on-surface' },
  { key: 'onSurfaceVariant', cssVar: 'on-surface-variant' },
  { key: 'primaryContainer', cssVar: 'primary-container' },
  { key: 'onPrimaryContainer', cssVar: 'on-primary-container' },
  { key: 'secondaryContainer', cssVar: 'secondary-container' },
  { key: 'onSecondaryContainer', cssVar: 'on-secondary-container' },
  { key: 'tertiaryContainer', cssVar: 'tertiary-container' },
  { key: 'onTertiaryContainer', cssVar: 'on-tertiary-container' },
  { key: 'outline', cssVar: 'outline' },
  { key: 'outlineVariant', cssVar: 'outline-variant' },
];

/**
 * Convert a color to space-separated RGB triplets for Tailwind's
 * `rgb(var(--x) / <alpha-value>)` opacity support. Handles hex (#rgb/#rrggbb)
 * and rgba() strings; falls back to opaque black for anything unexpected.
 */
export function colorToRgb(color: string): string {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map(c => c + c)
        .join('');
    }
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      if (!Number.isNaN(num)) {
        return `${(num >> 16) & 0xff} ${(num >> 8) & 0xff} ${num & 0xff}`;
      }
    }
    return '0 0 0';
  }
  const match = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  return '0 0 0';
}
