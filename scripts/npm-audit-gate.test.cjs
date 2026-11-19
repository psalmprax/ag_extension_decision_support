'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  areIndirectViasExempt,
  buildAuditArgs,
  isAllowlisted,
  loadAllowlist,
  parseArgs,
} = require('./npm-audit-gate.cjs');

describe('allowlist scope and advisory matching', () => {
  // A fixture entry, not the live allowlist: entries are retired as advisories are
  // fixed or withdrawn, and the matching rules must stay tested after that.
  const entries = [
    {
      package: 'picomatch',
      scope: ['ag_extension_decision_support', 'backend', 'frontend', 'ag-extension-browser-ext'],
      advisories: ['GHSA-fc5q-39xc-vjpf'],
      reason: 'fixture',
      expires: '2026-12-01',
    },
  ];
  const advisory = { url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' };

  it('covers only the reviewed advisory in the reviewed tooling scopes', () => {
    const vulnerability = { via: [advisory] };
    for (const scope of ['frontend', 'backend', 'ag_extension_decision_support', 'ag-extension-browser-ext']) {
      const entry = isAllowlisted('picomatch', vulnerability, entries, scope);
      assert.ok(entry, `expected picomatch allowlisted in ${scope}`);
      assert.equal(entry.expires, '2026-12-01');
    }
    assert.equal(isAllowlisted('picomatch', vulnerability, entries, 'ag-extension-shared'), null);
  });

  it('loads the live allowlist with every required field', () => {
    const live = loadAllowlist(path.join(__dirname, 'audit-allowlist.json')).entries;
    for (const entry of live) {
      assert.ok(Array.isArray(entry.advisories) && entry.advisories.length > 0, entry.package);
      assert.ok(!Number.isNaN(new Date(entry.expires).getTime()), `${entry.package} expiry`);
    }
  });

  it('does not exempt new Picomatch advisories or other dependencies', () => {
    const unrelated = { url: 'https://github.com/advisories/GHSA-unreviewed' };
    assert.equal(isAllowlisted('picomatch', { via: [advisory, unrelated] }, entries, 'frontend'), null);
    assert.equal(isAllowlisted('minimatch', { via: [advisory] }, entries, 'frontend'), null);
  });
});

describe('CLI and standalone lockfile audit options', () => {
  it('parses --omit-dev', () => {
    const parsed = parseArgs(['--dir', '.', '--level', 'high', '--omit-dev']);
    assert.equal(parsed.omitDev, true);
    assert.equal(parsed.dir, '.');
    assert.equal(parsed.level, 'high');
  });

  it('adds --workspaces=false only for subdirectories with standalone lockfiles', () => {
    const repoRoot = path.resolve(__dirname, '..');
    assert.deepEqual(buildAuditArgs(repoRoot, repoRoot, false), ['audit', '--json']);
    assert.deepEqual(buildAuditArgs(repoRoot, repoRoot, true), ['audit', '--json', '--omit=dev']);
    assert.deepEqual(
      buildAuditArgs(path.join(repoRoot, 'ag-extension-browser-ext'), repoRoot, false),
      ['audit', '--json', '--workspaces=false'],
    );
    assert.deepEqual(
      buildAuditArgs(path.join(repoRoot, 'ag-extension-dashboard/src/frontend'), repoRoot, true),
      ['audit', '--json', '--omit=dev'],
    );
  });
});

describe('areIndirectViasExempt', () => {
  const cycle = {
    vitest: { severity: 'high', via: ['coverage', 'picomatch'] },
    coverage: { severity: 'high', via: ['vitest'] },
  };

  it('resolves peer dependency cycles only when they lead to a reviewed dependency', () => {
    assert.equal(areIndirectViasExempt(['vitest'], new Set(['picomatch']), cycle, 'high'), true);
    assert.equal(areIndirectViasExempt(['coverage'], new Set(['picomatch']), cycle, 'high'), true);
    assert.equal(areIndirectViasExempt(['vitest'], new Set(), cycle, 'high'), false);
  });

  it('does not exempt isolated cycles or unreviewed advisories inside a cycle', () => {
    const isolated = {
      first: { severity: 'high', via: ['second'] },
      second: { severity: 'high', via: ['first'] },
    };
    assert.equal(areIndirectViasExempt(['first'], new Set(), isolated, 'high'), false);
    const unreviewed = {
      ...cycle,
      coverage: { severity: 'high', via: ['vitest', { url: 'https://github.com/advisories/GHSA-unreviewed' }] },
    };
    assert.equal(areIndirectViasExempt(['vitest'], new Set(['picomatch']), unreviewed, 'high'), false);
    assert.equal(areIndirectViasExempt(['vitest'], new Set(['picomatch']), {
      ...cycle, coverage: { severity: 'high', via: ['vitest', 'missing'] },
    }, 'high'), false);
  });

  it('does not exempt missing or unknown dependency references', () => {
    const vulnerabilities = {
      'unknown-dependency': { severity: 'unknown' },
    };

    assert.equal(areIndirectViasExempt(['missing-dependency'], new Set(), vulnerabilities, 'high'), false);
    assert.equal(areIndirectViasExempt(['unknown-dependency'], new Set(), vulnerabilities, 'high'), false);
  });

  it('exempts known dependencies below the configured threshold', () => {
    const vulnerabilities = {
      'moderate-dependency': { severity: 'moderate' },
    };

    assert.equal(areIndirectViasExempt(['moderate-dependency'], new Set(), vulnerabilities, 'high'), true);
  });

  it('preserves exemptions already established for dependencies', () => {
    assert.equal(
      areIndirectViasExempt(['allowlisted-dependency'], new Set(['allowlisted-dependency']), {}, 'high'),
      true,
    );
  });
});
