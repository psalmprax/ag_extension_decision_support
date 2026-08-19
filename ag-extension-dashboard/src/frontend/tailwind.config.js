import {
  COLOR_STEPS,
  semanticTokens,
  SURFACE_TOKEN_NAMES,
  designTokens,
} from './src/theme/tokens.ts';

/**
 * Brand/error scales resolve through CSS custom properties emitted at runtime
 * by `applyTheme()` (see src/theme/index.ts), so they follow the active theme
 * and dark mode without rebuilding Tailwind.
 */
const scaleVars = name =>
  Object.fromEntries(
    COLOR_STEPS.map(step => [step, `rgb(var(--color-${name}-${step}-rgb) / <alpha-value>)`])
  );

/** Surface/outline tokens flip between light and dark via the same mechanism. */
const surfaceVars = Object.fromEntries(
  SURFACE_TOKEN_NAMES.map(({ cssVar }) => [
    cssVar,
    `rgb(var(--color-${cssVar}-rgb) / <alpha-value>)`,
  ])
);

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: scaleVars('primary'),
        secondary: scaleVars('secondary'),
        accent: scaleVars('accent'),
        error: scaleVars('error'),
        'theme-bg': {
          primary: 'rgb(var(--color-bg-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--color-bg-secondary-rgb) / <alpha-value>)',
          card: 'rgb(var(--color-bg-card-rgb) / <alpha-value>)',
        },
        ...surfaceVars,
        status: semanticTokens.status,
        chart: semanticTokens.chart,
        cyber: semanticTokens.cyber,
        map: semanticTokens.map,
      },
      borderRadius: designTokens.borderRadius,
      boxShadow: designTokens.boxShadow,
      fontSize: designTokens.fontSize,
      fontFamily: designTokens.fontFamily,
      spacing: designTokens.spacing,
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
