#!/usr/bin/env node
/**
 * Component-size ratchet for CLAUDE.md's 300-line decomposition rule.
 *
 * 64 frontend components already exceed the limit, so a hard lint rule would
 * either break the build or be ignored. Instead this ratchet:
 *   - fails when a NEW file crosses 300 lines (not in the baseline), and
 *   - fails when a baselined file GROWS past its recorded size, while
 *   - letting every shrink through (run with --update to record progress).
 *
 * Usage:  node scripts/component-size-ratchet.cjs [--update]
 */
const { readFileSync, writeFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'ag-extension-dashboard', 'src', 'frontend', 'src');
const BASELINE_FILE = path.join(__dirname, 'component-size-baseline.json');
const LIMIT = 300;
const UPDATE = process.argv.includes('--update');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry) && !/\.(test|spec|stories)\.tsx$/.test(entry)) out.push(p);
  }
  return out;
}

function countLines(p) {
  return readFileSync(p, 'utf8').split('\n').length;
}

const current = {};
for (const p of walk(ROOT)) {
  const lines = countLines(p);
  if (lines > LIMIT) current[path.relative(ROOT, p).split(path.sep).join('/')] = lines;
}

let baseline = {};
try { baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')); } catch { /* first run */ }

if (UPDATE) {
  writeFileSync(BASELINE_FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`Baseline updated: ${Object.keys(current).length} files over ${LIMIT} lines.`);
  process.exit(0);
}

const errors = [];
for (const [file, lines] of Object.entries(current)) {
  if (!(file in baseline)) {
    errors.push(`NEW oversized component: ${file} (${lines} lines > ${LIMIT}). Decompose it (CLAUDE.md rule).`);
  } else if (lines > baseline[file]) {
    errors.push(`${file} grew from ${baseline[file]} to ${lines} lines. Shrink it back or decompose.`);
  }
}

const shrunk = Object.keys(baseline).filter(f => !(f in current) || current[f] < baseline[f]);
if (shrunk.length && !errors.length) {
  console.log(`Progress: ${shrunk.length} baselined file(s) shrank — run with --update to lock it in.`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Component-size ratchet OK (${Object.keys(current).length} grandfathered, 0 regressions).`);
