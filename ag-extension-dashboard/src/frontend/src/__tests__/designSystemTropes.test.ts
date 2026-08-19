import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

/**
 * Regression guard for the "Forbidden Cliché Tropes" rules (GRP-11) from
 * docs/FRONTEND_MOBILE_DESIGN_CHECKLIST.md. These scan source (not compiled
 * output) so a reintroduced gradient-text heading, heading glow, or purple
 * ambient wash fails the test suite in CI.
 *
 * - "No Gradient Keywords": no CSS gradient text fills (`bg-clip-text`).
 * - "No heading glow": no `drop-shadow-[0_0_15px…]` neon glow on headings.
 * - "No Purple-on-Dark": the dashboard's dark ambient background must not
 *   use purple/violet washes (purple remains allowed as a semantic chart/AI
 *   accent — only the decorative dark-mode background is prohibited).
 */

// Vitest's root is the frontend package dir, so process.cwd() points at it
// when the suite runs via `npm test` (the jsdom env rewrites import.meta.url
// to a non-file URL, so we resolve against cwd instead).
const SRC_DIR = join(process.cwd(), 'src');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.css'];

const FORBIDDEN_TOKENS: { token: string; allow: string[]; reason: string }[] = [
  {
    token: 'bg-clip-text',
    // The marketing landing page is a one-shot accent, not part of the dashboard shell.
    allow: ['LandingPage.tsx'],
    reason: 'gradient text fill (GRP-11 "No Gradient Keywords")',
  },
  {
    token: 'drop-shadow-[0_0_15px',
    allow: [],
    reason: 'neon glow on headings',
  },
];

const SKIPPED_DIRS = new Set(['__tests__', 'test', 'node_modules']);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIPPED_DIRS.has(entry)) continue;
      files.push(...walk(full));
    } else if (SOURCE_EXTENSIONS.some(ext => full.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

describe('design system trope guard (GRP-11)', () => {
  const files = walk(SRC_DIR);

  it('has no gradient text fills or heading glow drop-shadows', () => {
    const violations: string[] = [];
    for (const file of files) {
      const name = basename(file);
      const content = readFileSync(file, 'utf8');
      for (const rule of FORBIDDEN_TOKENS) {
        if (rule.allow.includes(name)) continue;
        if (content.includes(rule.token)) {
          violations.push(`${name}: "${rule.token}" — ${rule.reason}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps the dark ambient aurora free of purple (no purple-on-dark)', () => {
    const app = readFileSync(join(SRC_DIR, 'App.tsx'), 'utf8');
    expect(app).not.toContain('purple');
  });
});
