'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { areIndirectViasExempt, isAllowlisted, loadAllowlist } = require('./npm-audit-gate.cjs');

describe('frontend unpatched Picomatch exception', () => {
  const entries = loadAllowlist(path.join(__dirname, 'audit-allowlist.json')).entries;
  const advisory = { url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' };

  it('covers only the reviewed advisory in the frontend scope', () => {
    const vulnerability = { via: [advisory] };
    const entry = isAllowlisted('picomatch', vulnerability, entries, 'frontend');
    assert.ok(entry);
    assert.equal(entry.expires, '2026-12-01');
    assert.equal(isAllowlisted('picomatch', vulnerability, entries, 'backend'), null);
    assert.equal(isAllowlisted('picomatch', vulnerability, entries, 'ag_extension_decision_support'), null);
  });

  it('does not exempt new Picomatch advisories or other dependencies', () => {
    const unrelated = { url: 'https://github.com/advisories/GHSA-unreviewed' };
    assert.equal(isAllowlisted('picomatch', { via: [advisory, unrelated] }, entries, 'frontend'), null);
    assert.equal(isAllowlisted('minimatch', { via: [advisory] }, entries, 'frontend'), null);
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
