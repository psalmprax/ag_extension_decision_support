'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { areIndirectViasExempt } = require('./npm-audit-gate.cjs');

describe('areIndirectViasExempt', () => {
  const exemptPackages = new Set();

  it('does not exempt missing or unknown dependency references', () => {
    const vulnerabilities = {
      'unknown-dependency': { severity: 'unknown' },
    };

    assert.equal(areIndirectViasExempt(['missing-dependency'], exemptPackages, vulnerabilities, 'high'), false);
    assert.equal(areIndirectViasExempt(['unknown-dependency'], exemptPackages, vulnerabilities, 'high'), false);
  });

  it('exempts known dependencies below the configured threshold', () => {
    const vulnerabilities = {
      'low-dependency': { severity: 'moderate' },
    };

    assert.equal(areIndirectViasExempt(['low-dependency'], exemptPackages, vulnerabilities, 'high'), true);
  });

  it('preserves exemptions already established for dependencies', () => {
    assert.equal(areIndirectViasExempt(['allowlisted-dependency'], new Set(['allowlisted-dependency']), {}, 'high'), true);
  });
});
