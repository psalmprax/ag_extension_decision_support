#!/usr/bin/env node
/**
 * Explicit-`any` ratchet for the backend (CLAUDE.md: "Avoid any").
 *
 * `@typescript-eslint/no-explicit-any` is on, but 33 files silence it with a
 * file-level eslint-disable, so `npm run lint` reports 0 while ~140 `any`
 * remain. This counts every explicit `any` with inline config IGNORED, then:
 *   - fails when a file not in the baseline gains an `any`,
 *   - fails when a baselined file's count grows,
 *   - lets every reduction through (run with --update to record progress).
 * Test files are excluded.
 *
 * Usage:  node scripts/explicit-any-ratchet.cjs [--update]
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { runRatchet } = require('./ratchet-core.cjs');

const BACKEND = path.join(__dirname, '..', 'ag-extension-dashboard', 'src', 'backend');
const BASELINE_FILE = path.join(__dirname, 'explicit-any-baseline.json');
const RULE = '@typescript-eslint/no-explicit-any';

const res = spawnSync(
  'npx',
  ['eslint', 'src/**/*.ts', '--no-inline-config', '--rule', JSON.stringify({ [RULE]: 'error' }), '--format', 'json'],
  { cwd: BACKEND, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
let report;
try {
  report = JSON.parse(res.stdout);
} catch {
  console.error(`eslint did not produce a JSON report (exit ${res.status}):\n${(res.stderr || '').slice(0, 2000)}`);
  process.exit(2);
}

const current = {};
for (const file of report) {
  const rel = path.relative(BACKEND, file.filePath).split(path.sep).join('/');
  if (rel.includes('__tests__/') || /\.test\.ts$/.test(rel)) continue;
  const count = file.messages.filter(m => m.ruleId === RULE).length;
  if (count > 0) current[rel] = count;
}

process.exit(runRatchet({
  current,
  baselineFile: BASELINE_FILE,
  update: process.argv.includes('--update'),
  name: 'Explicit-any ratchet',
  unit: 'explicit any',
  newMessage: (file, n) => `NEW explicit any in ${file} (${n}). Type it (an interface, a generic, or unknown + narrowing).`,
  grewMessage: (file, from, to) => `${file}: explicit any grew from ${from} to ${to}. Type the new code instead.`,
}));
