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
const path = require('path');

const SEVERITY_RANK = { low: 1, moderate: 2, high: 3, critical: 4 };

function parseArgs(argv) {
  const args = { level: 'high', allowlist: 'scripts/audit-allowlist.json' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = argv[++i];
    else if (argv[i] === '--level') args.level = argv[++i];
    else if (argv[i] === '--allowlist') args.allowlist = argv[++i];
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

function runAudit(dir, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    attempt++;
    const res = spawnSync('npm', ['audit', '--json'], { cwd: dir, encoding: 'utf8' });
    if (res.error) {
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] npm audit execution error (${res.error.message}), retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      throw new Error(`Failed to run npm audit: ${res.error.message}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(res.stdout);
    } catch (err) {
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] npm audit produced unparseable output (exit ${res.status}), retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      throw new Error(`npm audit produced unparseable output (exit ${res.status}): ${res.stdout.slice(0, 400)}`);
    }

    if (parsed.error) {
      const errMsg = typeof parsed.error === 'object'
        ? (parsed.error.summary || parsed.error.detail || JSON.stringify(parsed.error))
        : String(parsed.error);
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] npm audit registry error (${errMsg}), retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      throw new Error(`npm audit registry endpoint error: ${errMsg}`);
    }

    if (!parsed.vulnerabilities && !parsed.metadata) {
      if (attempt <= maxRetries) {
        console.warn(`[npm-audit-gate] unexpected audit output structure, retry ${attempt}/${maxRetries} in ${attempt * 2}s...`);
        sleepSync(attempt * 2000);
        continue;
      }
      throw new Error(`npm audit returned payload missing vulnerabilities and metadata: ${res.stdout.slice(0, 400)}`);
    }

    return parsed;
  }
}

function advisoryIdsOf(vuln) {
  const ids = [];
  for (const via of vuln.via || []) {
    if (typeof via === 'object' && via.url) ids.push(via.url.split('/').pop());
  }
  return ids;
}

function isAllowlisted(pkgName, advisoryIds, entries, scope) {
  for (const entry of entries) {
    if (entry.package !== pkgName) continue;
    if (Array.isArray(entry.scope) && !entry.scope.includes(scope)) continue;
    const wanted = new Set(entry.advisories);
    if (advisoryIds.length > 0 && advisoryIds.every((id) => wanted.has(id))) return entry;
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..');
  const dir = path.isAbsolute(args.dir) ? args.dir : path.join(repoRoot, args.dir);
  const allowlistFile = path.isAbsolute(args.allowlist) ? args.allowlist : path.join(repoRoot, args.allowlist);
  const scope = path.basename(path.resolve(dir));
  const now = new Date();

  const allowlist = loadAllowlist(allowlistFile);
  const audit = runAudit(dir);
  const vulnerabilities = audit.vulnerabilities || {};

  const errors = [];
  const exemptPackages = new Set();
  const usedEntries = new Set();

  // Pass 1: exempt packages whose own advisories are all allowlisted.
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    if (!SEVERITY_RANK[vuln.severity] || SEVERITY_RANK[vuln.severity] < SEVERITY_RANK[args.level]) continue;
    const entry = isAllowlisted(name, advisoryIdsOf(vuln), allowlist.entries, scope);
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
      const directIds = advisoryIdsOf(vuln);
      const allViasExempt = vias.every((via) =>
        typeof via === 'object'
          ? directIds.every((id) => {
              const e = isAllowlisted(name, [id], allowlist.entries, scope);
              if (e) usedEntries.add(e);
              return !!e;
            })
          : exemptPackages.has(via)
      );
      if (vias.length > 0 && allViasExempt) {
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

try {
  main();
} catch (err) {
  console.error(`✗ npm-audit-gate: ${err.message}`);
  process.exit(1);
}
