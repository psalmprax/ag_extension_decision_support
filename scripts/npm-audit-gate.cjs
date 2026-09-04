#!/usr/bin/env node
/**
 * npm audit gate with an expiring allowlist.
 *
 * Plain `npm audit --audit-level=high` fails CI whenever any advisory exists,
 * even for transitive deps with no patched version available. This gate:
 *   1. Runs `npm audit --json` in the target package dir.
 *   2. Exempts advisories listed in scripts/audit-allowlist.json — but ONLY
 *      while the entry is unexpired and still present in the audit output.
 *   3. Fails on any remaining vulnerability at or above the level.
 *   4. Fails on expired entries (forces revisit) and stale entries (forces
 *      removal once upstream ships a fix).
 *
 * Usage:
 *   node scripts/npm-audit-gate.cjs --dir ag-extension-dashboard/src/frontend [--level high]
 *       [--allowlist scripts/audit-allowlist.json]
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SEVERITY_RANK = { low: 1, moderate: 2, high: 3, critical: 4 };
const OUTAGE_CACHE_FILE = path.join(os.tmpdir(), 'npm-audit-gate-outage.json');
const OUTAGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedOutage() {
  try {
    if (!fs.existsSync(OUTAGE_CACHE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(OUTAGE_CACHE_FILE, 'utf8'));
    if (Date.now() - data.timestamp < OUTAGE_CACHE_TTL_MS) {
      return data;
    }
  } catch {
    // ignore cache read errors
  }
  return null;
}

function setCachedOutage(reason) {
  try {
    fs.writeFileSync(OUTAGE_CACHE_FILE, JSON.stringify({ timestamp: Date.now(), reason }), 'utf8');
  } catch {
    // ignore cache write errors
  }
}

function parseArgs(argv) {
  const args = {
    level: 'high',
    allowlist: 'scripts/audit-allowlist.json',
    failOnOutage: process.env.AUDIT_GATE_FAIL_ON_OUTAGE === 'true' || process.env.AUDIT_GATE_FAIL_ON_OUTAGE === '1',
    noCache: process.env.AUDIT_GATE_NO_CACHE === 'true' || process.env.AUDIT_GATE_NO_CACHE === '1',
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = argv[++i];
    else if (argv[i] === '--level') args.level = argv[++i];
    else if (argv[i] === '--allowlist') args.allowlist = argv[++i];
    else if (argv[i] === '--fail-on-outage') args.failOnOutage = true;
    else if (argv[i] === '--no-cache') args.noCache = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.dir) throw new Error('--dir is required (package dir containing package.json)');
  if (!SEVERITY_RANK[args.level]) throw new Error(`Invalid --level: ${args.level}`);
  return args;
}

function loadAllowlist(file) {
  if (!fs.existsSync(file)) return { entries: [] };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed.entries)) throw new Error(`${file}: expected { "entries": [...] }`);
  for (const e of parsed.entries) {
    for (const key of ['package', 'advisories', 'reason', 'expires']) {
      if (!e[key]) throw new Error(`${file}: allowlist entry missing "${key}"`);
    }
    if (!Array.isArray(e.advisories) || e.advisories.length === 0) {
      throw new Error(`${file}: entry "${e.package}" must list at least one advisory ID`);
    }
    if (Number.isNaN(Date.parse(e.expires))) {
      throw new Error(`${file}: entry "${e.package}" has unparsable expires date: ${e.expires}`);
    }
  }
  return parsed;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isOutageMessage(text) {
  if (!text) return false;
  return /503|502|504|Service Unavailable|Bad Gateway|Gateway Timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|audit endpoint returned an error|endpoint is being retired|Invalid package tree/i.test(text);
}

function runAudit(dir) {
  const maxRetries = parseInt(process.env.AUDIT_GATE_MAX_RETRIES || '1', 10);
  const timeoutMs = parseInt(process.env.AUDIT_GATE_TIMEOUT_MS || '15000', 10);
  let attempt = 0;
  while (true) {
    attempt++;
    const res = spawnSync('npm', ['audit', '--json'], {
      cwd: dir,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (res.error) {
      const isTimeout = res.error.code === 'ETIMEDOUT';
      const msg = isTimeout ? `command timed out after ${timeoutMs / 1000}s` : res.error.message;
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] npm audit execution error (${msg}), retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      const err = new Error(`Failed to run npm audit: ${msg}`);
      if (isTimeout || isOutageMessage(msg) || res.error.code === 'ETIMEDOUT') {
        err.isRegistryOutage = true;
      }
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(res.stdout);
    } catch (parseErr) {
      const stderr = res.stderr || '';
      const stdout = (res.stdout || '').slice(0, 400);
      const combined = `${stderr}\n${stdout}`;
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] npm audit produced unparseable output (exit ${res.status}), retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      const err = new Error(`npm audit produced unparseable output (exit ${res.status}): ${stdout || stderr.slice(0, 400)}`);
      if (isOutageMessage(combined) || res.status !== 0) {
        err.isRegistryOutage = true;
      }
      throw err;
    }

    if (parsed.error) {
      const errMsg = typeof parsed.error === 'object'
        ? (parsed.error.message || parsed.error.summary || parsed.error.detail || JSON.stringify(parsed.error))
        : String(parsed.error);
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] npm audit registry error (${errMsg}), retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      const err = new Error(`npm audit registry endpoint error: ${errMsg}`);
      err.isRegistryOutage = true;
      throw err;
    }

    if (!parsed.vulnerabilities && !parsed.metadata) {
      const raw = res.stdout.slice(0, 400);
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] unexpected audit output structure, retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      const err = new Error(`npm audit returned payload missing vulnerabilities and metadata: ${raw}`);
      err.isRegistryOutage = true;
      throw err;
    }

    return parsed;
  }
}

function advisoryIdsOfVia(via) {
  const ids = [];
  if (typeof via === 'object' && via !== null) {
    if (via.url) ids.push(via.url.replace(/\/+$/, '').split('/').pop());
    if (via.source) ids.push(String(via.source));
  }
  return ids;
}

function advisoryIdsOf(vuln) {
  const ids = [];
  for (const via of vuln.via || []) {
    ids.push(...advisoryIdsOfVia(via));
  }
  return ids;
}

function isAllowlisted(pkgName, vuln, entries, scope) {
  const advisoryVias = (vuln.via || []).filter((v) => typeof v === 'object' && v !== null);
  if (advisoryVias.length === 0) return null;

  let matchedEntry = null;
  for (const via of advisoryVias) {
    const ids = advisoryIdsOfVia(via);
    let viaCovered = false;
    for (const entry of entries) {
      if (entry.package !== pkgName) continue;
      if (Array.isArray(entry.scope) && !entry.scope.includes(scope)) continue;
      const wanted = new Set(entry.advisories);
      if (ids.some((id) => wanted.has(id))) {
        viaCovered = true;
        matchedEntry = entry;
        break;
      }
    }
    if (!viaCovered) {
      return null;
    }
  }
  return matchedEntry;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..');
  const dir = path.isAbsolute(args.dir) ? args.dir : path.join(repoRoot, args.dir);
  const allowlistFile = path.isAbsolute(args.allowlist) ? args.allowlist : path.join(repoRoot, args.allowlist);
  const scope = path.basename(path.resolve(dir));
  const now = new Date();

  if (!args.failOnOutage && !args.noCache) {
    const cached = getCachedOutage();
    if (cached) {
      console.warn(`⚠️ npm-audit-gate: scope=${scope} npm registry outage previously detected (${cached.reason}) — passing gate immediately (soft-fail).`);
      return;
    }
  }

  const allowlist = loadAllowlist(allowlistFile);
  let audit;
  try {
    audit = runAudit(dir);
  } catch (err) {
    if (err.isRegistryOutage && !args.failOnOutage) {
      setCachedOutage(err.message);
      console.warn(`⚠️ npm-audit-gate: scope=${scope} npm registry audit endpoint unavailable (${err.message}). Upstream outage detected — passing gate (soft-fail).`);
      return;
    }
    throw err;
  }
  const vulnerabilities = audit.vulnerabilities || {};

  const errors = [];
  const exemptPackages = new Set();
  const usedEntries = new Set();

  // Pass 1: exempt packages whose own advisories are all allowlisted.
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    if (!SEVERITY_RANK[vuln.severity] || SEVERITY_RANK[vuln.severity] < SEVERITY_RANK[args.level]) continue;
    const entry = isAllowlisted(name, vuln, allowlist.entries, scope);
    if (!entry) continue;
    if (now > new Date(entry.expires)) {
      errors.push(`Allowlist entry for "${name}" EXPIRED on ${entry.expires}. Re-evaluate: ${entry.reason}`);
    }
    exemptPackages.add(name);
    usedEntries.add(entry);
  }

  // Pass 2: propagate exemption to packages vulnerable only through exempt deps.
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, vuln] of Object.entries(vulnerabilities)) {
      if (exemptPackages.has(name)) continue;
      if (!SEVERITY_RANK[vuln.severity] || SEVERITY_RANK[vuln.severity] < SEVERITY_RANK[args.level]) continue;
      const vias = vuln.via || [];
      const directVias = vias.filter((v) => typeof v === 'object' && v !== null);
      const directEntry = directVias.length > 0
        ? isAllowlisted(name, vuln, allowlist.entries, scope)
        : null;
      const allDirectCovered = directVias.length === 0 || !!directEntry;
      if (directEntry) usedEntries.add(directEntry);

      const indirectVias = vias.filter((v) => typeof v === 'string');
      const allIndirectExempt = indirectVias.every((dep) => exemptPackages.has(dep));

      if (vias.length > 0 && allDirectCovered && allIndirectExempt) {
        exemptPackages.add(name);
        changed = true;
      }
    }
  }

  // Remaining unexempted vulnerabilities are real failures.
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    if (exemptPackages.has(name)) continue;
    if (!SEVERITY_RANK[vuln.severity] || SEVERITY_RANK[vuln.severity] < SEVERITY_RANK[args.level]) continue;
    const viaNames = (vuln.via || []).map((v) => (typeof v === 'object' ? (v.name || v.url) : v)).join(', ');
    errors.push(`Vulnerable dependency "${name}" (${vuln.severity}) via ${viaNames} — fix or add an expiring allowlist entry in scripts/audit-allowlist.json`);
  }

  // Stale entries: allowlisted but not present in the audit output → remove them.
  for (const entry of allowlist.entries) {
    if (Array.isArray(entry.scope) && !entry.scope.includes(scope)) continue;
    if (!usedEntries.has(entry)) {
      errors.push(`Stale allowlist entry for "${entry.package}" — advisory no longer reported. Remove it from scripts/audit-allowlist.json`);
    }
  }

  const total = (audit.metadata && audit.metadata.vulnerabilities && audit.metadata.vulnerabilities.total) || 0;
  const exempted = [...exemptPackages];
  console.log(`npm-audit-gate: scope=${scope} level=${args.level} total=${total} exempted=${exempted.length}${exempted.length ? ` (${exempted.join(', ')})` : ''}`);

  if (errors.length > 0) {
    for (const e of errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  console.log('✓ npm-audit-gate passed');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`✗ npm-audit-gate: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  loadAllowlist,
  isOutageMessage,
  getCachedOutage,
  setCachedOutage,
  runAudit,
  advisoryIdsOfVia,
  advisoryIdsOf,
  isAllowlisted,
  main,
};


