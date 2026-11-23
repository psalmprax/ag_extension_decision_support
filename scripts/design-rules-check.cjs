#!/usr/bin/env node
/**
 * Design rules (CLAUDE.md, Unslop) as a CI check over the frontend source:
 * two font weights, sentence case without tracked labels, no decorative gradients,
 * coloured glows, blurred blobs or emoji. Rich colour belongs to agronomic content
 * (heatmaps, maps), so those folders and photo scrims (`data-scrim`) are exempt.
 *
 *   node scripts/design-rules-check.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'ag-extension-dashboard', 'src', 'frontend', 'src');
const COLOURS = 'emerald|blue|purple|violet|indigo|cyan|green|amber|rose|red|primary|sky|teal|fuchsia|pink|lime|orange|yellow|secondary';
const RULES = [
  { name: 'font weight above 500', pattern: /\bfont-(bold|extrabold|black|semibold)\b/ },
  { name: 'all-caps or tracked label', pattern: /(?<![\w-])uppercase\b|\btracking-(wide|wider|widest|\[)/ },
  // Grid lines drawn with the outline colour variable are structure, not decoration.
  { name: 'decorative gradient', pattern: /bg-gradient-|radial-gradient|bg-clip-text|linear-gradient\((?!(\d+deg,\s*)?var\()/ },
  { name: 'coloured glow', pattern: new RegExp(`shadow-(${COLOURS})-\\d|shadow-\\[0_0_`) },
  { name: 'blurred blob', pattern: /(?<!backdrop-)blur-(2xl|3xl|\[\d{2,}px\])/ },
  { name: 'emoji', pattern: /(?![©®™°±·←-⇿✓✗])\p{Extended_Pictographic}/u },
  // Dark mode takes its backgrounds from the theme (bg-theme-bg-primary/secondary/tertiary)
  // and its lines from white hairlines, so every page sits on the theme's own dark colour.
  { name: 'dark background or line not from the theme', pattern: /dark:(?:[a-z-]+:)*(?:bg|border|divide)(?:-[trblxy])?-(?:slate|gray|zinc|neutral)-(?:[6-9]00|950)\b|dark:(?:[a-z-]+:)*bg-\[#/ },
  // Light text on a dark page takes the theme's text steps (text-theme-text-primary/secondary/muted),
  // so it sits in the page's hue; dark text on a light chip (600 and up) is left alone.
  { name: 'dark-mode text not from the theme', pattern: /dark:(?:[a-z-]+:)*(?:text|placeholder)-(?:slate|gray|zinc|neutral)-(?:50|[1-5]00)\b/ },
];
/** Agronomic visualisations and loading placeholders may use colour ramps. */
const EXEMPT_PATHS = [/[\\/]canvas-ui[\\/]/, /[\\/]map[\\/]/, /[\\/]Skeleton\.tsx$/, /[\\/]__tests__[\\/]/, /\.test\.tsx?$/, /[\\/]a11y\.ts$/];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

const problems = [];
for (const file of files(ROOT)) {
  if (EXEMPT_PATHS.some(rule => rule.test(file))) continue;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (line.includes('data-scrim') || /^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const rule of RULES) {
      if (rule.pattern.test(line)) problems.push(`${path.relative(ROOT, file)}:${index + 1}  ${rule.name}: ${line.trim().slice(0, 120)}`);
    }
  });
}

if (problems.length > 0) {
  console.error(`${problems.length} design-rule breaks (see CLAUDE.md, Unslop):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Design rules OK: no heavy weights, tracked caps, decorative gradients, glows, blobs, emoji or off-theme dark backgrounds and text.');
