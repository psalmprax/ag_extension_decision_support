#!/usr/bin/env node
/**
 * Vendors the shared API contract (ag-extension-shared/src/api/*.ts) into
 * src/shared-api/ so the backend can import and *enforce* it at runtime.
 *
 * Why copy instead of a package dependency: the shared package is TS-source,
 * ESM, and depends on React; the backend is CommonJS ts-node/jest with a Docker
 * build context that cannot reach ../.. . A regenerated copy (never hand-edited,
 * gitignored, checked in CI with --check) keeps a single source of truth without
 * dragging React into the API image.
 *
 *   node scripts/sync-shared-api.js          # write/refresh the copy
 *   node scripts/sync-shared-api.js --check  # exit 1 if the copy is stale
 */
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const candidates = [
  process.env.SHARED_API_SRC,
  path.resolve(backendRoot, '../../../ag-extension-shared/src/api'), // monorepo layout
  path.resolve(backendRoot, 'shared-src/api'),                        // Docker: COPYed here
].filter(Boolean);
const src = candidates.find(p => fs.existsSync(path.join(p, 'index.ts')));
const dest = path.join(backendRoot, 'src', 'shared-api');
const check = process.argv.includes('--check');

if (!src) {
  if (fs.existsSync(path.join(dest, 'index.ts'))) {
    console.log('[shared-api] source not found; keeping existing vendored copy');
    process.exit(0);
  }
  console.error('[shared-api] source not found in any of:\n  ' + candidates.join('\n  '));
  process.exit(1);
}

const HEADER = `// GENERATED FILE — do not edit. Source: ag-extension-shared/src/api/%s\n// Regenerate with: npm run shared:sync\n`;

const files = fs.readdirSync(src).filter(f => f.endsWith('.ts'));
let stale = [];
fs.mkdirSync(dest, { recursive: true });
for (const f of files) {
  const body = fs.readFileSync(path.join(src, f), 'utf8');
  const out = HEADER.replace('%s', f) + body;
  const target = path.join(dest, f);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current !== out) {
    stale.push(f);
    if (!check) fs.writeFileSync(target, out);
  }
}
// Remove vendored files that no longer exist upstream
for (const f of fs.readdirSync(dest).filter(f => f.endsWith('.ts'))) {
  if (!files.includes(f)) {
    stale.push(`-${f}`);
    if (!check) fs.unlinkSync(path.join(dest, f));
  }
}

if (check) {
  if (stale.length) {
    console.error(`[shared-api] vendored copy is stale: ${stale.join(', ')}. Run: npm run shared:sync`);
    process.exit(1);
  }
  console.log('[shared-api] vendored copy is up to date');
} else {
  console.log(`[shared-api] synced ${files.length} file(s) from ${path.relative(backendRoot, src)}${stale.length ? ` (${stale.length} changed)` : ''}`);
}
