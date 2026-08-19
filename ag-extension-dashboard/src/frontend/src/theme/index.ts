/**
 * Runtime theme application.
 *
 * The canonical color values live in ./tokens.ts. This module turns them into
 * CSS custom properties on `:root` (light) and `.dark` (dark), so Tailwind
 * utilities (`bg-primary-600`, `text-on-surface`, `bg-status-success`, …) and
 * raw `var(--color-*)` references all resolve from one place.
 */

import {
  themes,
  errorScale,
  semanticTokens,
  surfaceTokens,
  SURFACE_TOKEN_NAMES,
  COLOR_STEPS,
  colorToRgb,
  type ThemeName,
  type ThemeColors,
  type ColorScale,
} from './tokens';

export { themes, errorScale, semanticTokens, surfaceTokens, SURFACE_TOKEN_NAMES, colorToRgb };
export { COLOR_STEPS, designTokens, kebabCase } from './tokens';
export type { ThemeName, ThemeColors, ColorScale, SemanticTokens, SurfaceTokens } from './tokens';

export const themeDescriptions: Record<ThemeName, string> = {
  forest: '🌲 Forest Green - Lush crops and rainforests',
  golden: '🌾 Golden Harvest - Wheat fields and grain',
  terracotta: '🏺 Terracotta - Earthy soil and clay',
  oceanic: '🌊 Oceanic Blue - Water and irrigation',
  sunset: '🌅 Sunset Orange - Warm harvest twilight',
  sage: '🌿 Sage Green - Vegetables and organic',
  cyber: '🌑 Cyber Dark - High-tech night mode',
};

function pushScaleVars(
  out: string[],
  prefix: 'primary' | 'secondary' | 'accent' | 'error',
  scale: ColorScale
): void {
  Object.entries(scale).forEach(([step, value]) => {
    out.push(`--color-${prefix}-${step}: ${value};`);
    out.push(`--color-${prefix}-${step}-rgb: ${colorToRgb(value)};`);
  });
}

function pushBackgroundVars(out: string[], background: ThemeColors['background']): void {
  out.push(`--color-bg-primary: ${background.primary};`);
  out.push(`--color-bg-secondary: ${background.secondary};`);
  out.push(`--color-bg-card: ${background.card};`);
  out.push(`--color-bg-primary-rgb: ${colorToRgb(background.primary)};`);
  out.push(`--color-bg-secondary-rgb: ${colorToRgb(background.secondary)};`);
  out.push(`--color-bg-card-rgb: ${colorToRgb(background.card)};`);
}

/** Theme-independent semantic accents (status/chart/map/cyber) as hex CSS vars. */
function pushSemanticVars(out: string[]): void {
  const { status, chart, map, cyber } = semanticTokens;
  Object.entries(status).forEach(([key, value]) => out.push(`--color-status-${key}: ${value};`));
  Object.entries(chart).forEach(([key, value]) => out.push(`--color-chart-${key}: ${value};`));
  Object.entries(map).forEach(([key, value]) => {
    const suffix = key === 'lightBg' ? 'light-bg' : key === 'lightText' ? 'light-text' : key === 'cyberBg' ? 'cyber-bg' : key === 'cyberBorder' ? 'cyber-border' : key;
    out.push(`--color-map-${suffix}: ${value};`);
  });
  out.push(`--color-cyber: ${cyber.DEFAULT};`);
  out.push(`--color-cyber-dark: ${cyber.dark};`);
  out.push(`--color-cyber-light: ${cyber.light};`);
  out.push(`--color-cyber-hover: ${cyber.hover};`);
}

/** Surface/outline tokens as hex + RGB triplets (these flip between light/dark). */
function pushSurfaceVars(out: string[], surface: typeof surfaceTokens.light): void {
  SURFACE_TOKEN_NAMES.forEach(({ key, cssVar }) => {
    const value = surface[key];
    out.push(`--color-${cssVar}: ${value};`);
    out.push(`--color-${cssVar}-rgb: ${colorToRgb(value)};`);
  });
}

/** Invert the error ramp for dark mode (light step N maps to dark step 900-N). */
function invertScale(scale: ColorScale): ColorScale {
  const inverted = {} as ColorScale;
  COLOR_STEPS.forEach((step, i) => {
    inverted[step] = scale[COLOR_STEPS[COLOR_STEPS.length - 1 - i]];
  });
  return inverted;
}

/** Dark-mode primary shift: low steps become neutral grays, high steps stay brand. */
function darkPrimaryStep(step: string, value: string): string {
  switch (step) {
    case '50':
      return '#111827';
    case '100':
      return '#1f2937';
    case '200':
      return '#374151';
    case '300':
      return '#4b5563';
    case '400':
      return '#6b7280';
    default:
      return value;
  }
}

/**
 * Raw `--var: value;` lines for the light (`:root`) state of a theme,
 * including brand, error, semantic, and surface tokens.
 */
export function getThemeCSS(themeName: ThemeName): string {
  const theme = themes[themeName] ?? themes.forest;
  const vars: string[] = [];
  pushScaleVars(vars, 'primary', theme.primary);
  pushScaleVars(vars, 'secondary', theme.secondary);
  pushScaleVars(vars, 'accent', theme.accent);
  pushScaleVars(vars, 'error', errorScale);
  pushBackgroundVars(vars, theme.background);
  pushSemanticVars(vars);
  pushSurfaceVars(vars, surfaceTokens.light);
  return vars.join('\n');
}

/** Raw `--var: value;` lines for the dark (`.dark`) state of a theme. */
export function getDarkThemeCSS(themeName: ThemeName): string {
  const theme = themes[themeName] ?? themes.forest;
  const vars: string[] = [];

  const darkPrimary = { ...theme.primary };
  COLOR_STEPS.forEach((step) => {
    darkPrimary[step] = darkPrimaryStep(String(step), darkPrimary[step]);
  });

  pushScaleVars(vars, 'primary', darkPrimary);
  pushScaleVars(vars, 'secondary', theme.secondary);
  pushScaleVars(vars, 'accent', theme.accent);
  pushScaleVars(vars, 'error', invertScale(errorScale));

  vars.push('--color-bg-primary: #0a0f1e;');
  vars.push('--color-bg-secondary: #111827;');
  vars.push('--color-bg-card: rgba(255, 255, 255, 0.05);');
  vars.push('--color-bg-primary-rgb: 10 15 30;');
  vars.push('--color-bg-secondary-rgb: 17 24 39;');
  vars.push('--color-bg-card-rgb: 255 255 255;');

  pushSurfaceVars(vars, surfaceTokens.dark);
  return vars.join('\n');
}

/** Apply a theme's CSS variables to the document (light + dark). */
export function applyTheme(themeName: ThemeName): void {
  const light = getThemeCSS(themeName);
  const dark = getDarkThemeCSS(themeName);

  let styleElement = document.getElementById('theme-css-vars');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'theme-css-vars';
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = `:root {\n${light}\n}\n.dark {\n${dark}\n}`;
}

/** Initialize the theme from localStorage (or the forest default). */
export function initializeTheme(): void {
  const savedTheme = localStorage.getItem('ag-theme-name') as ThemeName | null;
  const theme = savedTheme && themes[savedTheme] ? savedTheme : 'forest';
  applyTheme(theme);
}
