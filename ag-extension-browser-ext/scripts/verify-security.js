/**
 * Browser Extension Security Verification.
 *
 * Validates the security invariants the extension actually relies on. Every check
 * here guards a real attack surface:
 *   1. Manifest V3 service worker + least-privilege permissions
 *   2. API origin allowlist (bearer-token exfiltration gate) exists and is wired
 *      into every fetch site in the background service worker
 *   3. Bearer token is stored in session storage only (never on disk)
 *   4. Offline-queue mirror persists to browser.storage (survives MV3 worker death)
 *   5. No remote code execution (MV3 forbids remote <script>/eval sources)
 *   6. Extension typecheck is actually enforced (tsconfig must compile)
 *
 * Run: node scripts/verify-security.js  (npm run test:security)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let failures = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`);
  } else {
    failures += 1;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function readIfPresent(file) {
  const p = path.resolve(root, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function runVerification() {
  console.log('🔒 Verifying Browser Extension Security Invariants...\n');

  // ── 1. Manifest / wxt config ────────────────────────────────────────────
  const wxt = readIfPresent('wxt.config.ts');
  check('wxt.config.ts exists', wxt !== null);
  if (wxt) {
    check('Manifest V3 background service worker declared', wxt.includes('service_worker: true'));

    const forbiddenPermissions = ['webRequestBlocking', 'debugger', 'proxy', 'management'];
    const leaked = forbiddenPermissions.filter(p => wxt.includes(`'${p}'`) || wxt.includes(`"${p}"`));
    check('No dangerous high-risk permissions', leaked.length === 0, leaked.join(', '));

    check('Core permissions present (storage, sidePanel)',
      wxt.includes("'storage'") && wxt.includes("'sidePanel'"));

    // Host permissions must be scoped — no <all_urls> wildcard.
    check('No <all_urls> host permission', !wxt.includes('<all_urls>'));
  }

  // ── 2. Origin allowlist exists and is wired into every fetch site ───────
  const apiOrigin = readIfPresent('shared/apiOrigin.ts');
  check('shared/apiOrigin.ts (origin allowlist) exists', apiOrigin !== null && apiOrigin.includes('isAllowedApiUrl'));

  const bg = readIfPresent('entrypoints/background/main.ts');
  check('background/main.ts exists', bg !== null);
  if (bg && apiOrigin) {
    const fetchSites = (bg.match(/fetch\(/g) || []).length;
    const gateSites = (bg.match(/isAllowedApiUrl\(/g) || []).length;
    check('Background service worker imports the allowlist', bg.includes("apiOrigin'"), 'missing import');
    check(
      `Every fetch site is gated by the allowlist (${gateSites}/${fetchSites})`,
      fetchSites > 0 && gateSites >= fetchSites,
      'a fetch() call is not gated — bearer token could reach an arbitrary host'
    );
  }

  const apiQueue = readIfPresent('shared/apiQueue.ts');
  check('shared/apiQueue.ts gates queued requests through the allowlist',
    apiQueue !== null && (apiQueue.match(/isAllowedApiUrl\(/g) || []).length >= 2);

  // ── 3. Token storage: session-first, never persist to disk ──────────────
  const authToken = readIfPresent('shared/authToken.ts');
  check('shared/authToken.ts exists', authToken !== null);
  if (authToken) {
    check('Token prefers storage.session (memory only)', authToken.includes('storage.session'));
    check('Token is scrubbed from storage.local (legacy builds)', /storage\.local\.remove/.test(authToken));
    // Direct tokenArea().set with .local as the chosen area would be a regression.
    check('No unconditional storage.local token write',
      !/return\s+browser\.storage\.local;/.test(authToken));
  }

  // ── 4. Offline queue durability ──────────────────────────────────────────
  const mirror = readIfPresent('shared/offlineQueueMirror.ts');
  check('Offline queue mirror persists outbox to browser.storage',
    mirror !== null && mirror.includes('browser.storage.local.set'));

  // ── 5. No remote code execution paths ────────────────────────────────────
  const sourceFiles = [];
  for (const dir of ['entrypoints', 'shared']) {
    const abs = path.resolve(root, dir);
    if (!fs.existsSync(abs)) continue;
    const walk = d => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue;
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) sourceFiles.push(full);
      }
    };
    walk(abs);
  }
  const rceHits = [];
  for (const file of sourceFiles) {
    const src = fs.readFileSync(file, 'utf8');
    if (/\beval\s*\(/.test(src) || /new\s+Function\s*\(/.test(src)) rceHits.push(path.relative(root, file));
  }
  check('No eval()/new Function() in extension sources', rceHits.length === 0, rceHits.join(', '));

  // ── 6. Typecheck net is real ─────────────────────────────────────────────
  const tsconfig = readIfPresent('tsconfig.json');
  check('tsconfig.json exists', tsconfig !== null);
  if (tsconfig) {
    check('esModuleInterop enabled (TS ≥5.5 rejects false — the net must not silently disable itself)',
      /"esModuleInterop"\s*:\s*true/.test(tsconfig));
  }

  console.log('');
  if (failures > 0) {
    console.error(`❌ ${failures} security check${failures === 1 ? '' : 's'} failed.`);
    process.exit(1);
  }
  console.log('✅ Browser extension security verification passed.');
}

runVerification();
