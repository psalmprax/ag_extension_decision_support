/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load the CommonJS validator script from the repo's scripts directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const validatorPath = path.resolve(__dirname, '../../../../scripts/validate-locale-content.js');
const require = createRequire(import.meta.url);
const validator = require(validatorPath);

const { analyzeLocales, compareTokens, extractTokens, isEnglishFallback } = validator;

describe('locale validation utilities', () => {
  describe('extractTokens', () => {
    it('extracts single-brace and double-brace interpolation tokens', () => {
      expect(extractTokens('Hello {name}, see {{visitDate}} at {time}')).toEqual([
        'name',
        'time',
        'visitDate',
      ]);
    });

    it('returns an empty list for values without tokens', () => {
      expect(extractTokens('Plain text')).toEqual([]);
    });

    it('handles non-string values', () => {
      expect(extractTokens(undefined)).toEqual([]);
      expect(extractTokens(null)).toEqual([]);
    });
  });

  describe('compareTokens', () => {
    it('returns null when tokens match', () => {
      expect(compareTokens('{amount} {currency}', '{amount} {currency}')).toBeNull();
    });

    it('reports expected and actual tokens when they differ', () => {
      expect(compareTokens('{amount} {currency}', '{montant} {devise}')).toEqual({
        expected: ['amount', 'currency'],
        actual: ['devise', 'montant'],
      });
    });
  });

  describe('isEnglishFallback', () => {
    it('flags an identical non-universal English value', () => {
      expect(isEnglishFallback('Farmers Reached', 'Farmers Reached')).toBe(true);
    });

    it('ignores universal terms', () => {
      expect(isEnglishFallback('SMS', 'SMS')).toBe(false);
    });

    it('does not flag a real translation', () => {
      expect(isEnglishFallback('Wakulima Waliofikwa', 'Farmers Reached')).toBe(false);
    });
  });

  describe('analyzeLocales', () => {
    it('reports fallbacks, token mismatches, and protected-term losses', () => {
      const report = analyzeLocales({
        en: {
          key_plain: 'Hello world',
          key_token: 'Total: {count}',
          key_brand: 'Connect Stripe to proceed',
        },
        sw: {
          key_plain: 'Hello world',
          key_token: 'Total: {namba}',
          key_brand: 'Unganisha akaunti ili kuendelea',
        },
      });

      const sw = report.results.sw;
      expect(sw.fallbacks).toEqual([
        { key: 'key_plain', value: 'Hello world', priority: 'normal' },
      ]);
      expect(sw.tokenMismatches).toEqual([
        { key: 'key_token', expected: ['count'], actual: ['namba'] },
      ]);
      expect(sw.protectedTermLosses).toEqual([{ key: 'key_brand', term: 'Stripe' }]);
    });

    it('does not flag transliterated brands in non-Latin scripts', () => {
      const report = analyzeLocales({
        en: { key_brand: 'Connect Stripe to proceed' },
        hi: { key_brand: 'जारी रखने के लिए स्ट्राइप से जुड़ें' },
      });

      expect(report.results.hi.protectedTermLosses).toEqual([]);
    });

    it('tracks missing and extra keys in totals', () => {
      const report = analyzeLocales({
        en: { present: 'Value', removed: 'Other' },
        sw: { present: 'Thamani', added: 'Extra' },
      });

      expect(report.totals.missingKeys).toBe(1);
      expect(report.totals.extraKeys).toBe(1);
      expect(report.results.sw.missingKeys).toEqual(['removed']);
      expect(report.results.sw.extraKeys).toEqual(['added']);
    });
  });
});
