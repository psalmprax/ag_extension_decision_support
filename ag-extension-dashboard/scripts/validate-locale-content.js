#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LOCALES_DIR = path.join(__dirname, '../src/frontend/public/locales');
const UNIVERSAL_TERMS = new Set([
  'AI',
  'API',
  'GPS',
  'ID',
  'PDF',
  'SMS',
  'USD',
  'KES',
  'MWK',
]);
const PROTECTED_TERMS = [
  'FAOSTAT',
  'NASA POWER',
  'SoilGrids',
  'ISRIC',
];
const BRAND_TERMS = [
  'Stripe',
  'PayPal',
];
const PRIORITY_PREFIXES = [
  'action_',
  'auth_',
  'common_',
  'dashboard_',
  'empty_',
  'error_',
  'farmer_',
  'farmers_',
  'login_',
  'nav_',
  'register_',
  'visit_',
  'visits_',
];

function readLocaleFiles(localesDir = DEFAULT_LOCALES_DIR) {
  const files = fs
    .readdirSync(localesDir)
    .filter(file => file.endsWith('.json'))
    .sort();

  return files.reduce((locales, file) => {
    const code = path.basename(file, '.json');
    const filename = path.join(localesDir, file);
    locales[code] = JSON.parse(fs.readFileSync(filename, 'utf8'));
    return locales;
  }, {});
}

function extractTokens(value) {
  if (typeof value !== 'string') return [];
  const tokens = [];
  const tokenPattern = /\{\{?\s*([a-zA-Z0-9_.-]+)\s*\}?\}/g;
  let match;

  while ((match = tokenPattern.exec(value)) !== null) {
    tokens.push(match[1]);
  }

  return tokens.sort();
}

function hasPriority(key) {
  return PRIORITY_PREFIXES.some(prefix => key.startsWith(prefix));
}

function containsProtectedTerm(value, term) {
  return typeof value === 'string' && value.toLocaleLowerCase().includes(term.toLocaleLowerCase());
}

function isLatinScript(value) {
  return typeof value === 'string' && /[A-Za-z]/.test(value);
}

function isEnglishFallback(value, englishValue) {
  if (typeof value !== 'string' || typeof englishValue !== 'string') return false;
  if (value !== englishValue) return false;

  const normalized = value.trim().toUpperCase();
  return normalized.length > 2 && !UNIVERSAL_TERMS.has(normalized);
}

function compareTokens(englishValue, translatedValue) {
  const expected = extractTokens(englishValue);
  const actual = extractTokens(translatedValue);

  return JSON.stringify(expected) === JSON.stringify(actual)
    ? null
    : { expected, actual };
}

function analyzeLocales(locales, englishCode = 'en') {
  const english = locales[englishCode];
  if (!english) {
    throw new Error(`Missing required source locale: ${englishCode}.json`);
  }

  const englishKeys = Object.keys(english);
  const results = {};
  const totals = {
    locales: 0,
    fallbacks: 0,
    priorityFallbacks: 0,
    tokenMismatches: 0,
    protectedTermLosses: 0,
    missingKeys: 0,
    extraKeys: 0,
  };

  Object.entries(locales).forEach(([code, locale]) => {
    if (code === englishCode) return;

    const missingKeys = englishKeys.filter(key => !(key in locale));
    const extraKeys = Object.keys(locale).filter(key => !(key in english));
    const fallbacks = [];
    const tokenMismatches = [];
    const protectedTermLosses = [];

    englishKeys.forEach(key => {
      const sourceValue = english[key];
      const translatedValue = locale[key];

      if (isEnglishFallback(translatedValue, sourceValue)) {
        fallbacks.push({ key, value: translatedValue, priority: hasPriority(key) ? 'high' : 'normal' });
      }

      const tokenMismatch = compareTokens(sourceValue, translatedValue);
      if (tokenMismatch) {
        tokenMismatches.push({ key, ...tokenMismatch });
      }

      PROTECTED_TERMS.forEach(term => {
        if (containsProtectedTerm(sourceValue, term) && !containsProtectedTerm(translatedValue, term)) {
          protectedTermLosses.push({ key, term });
        }
      });

      // Brand names may be transliterated in non-Latin scripts, so only enforce
      // their presence when the translation is Latin-script (a true omission).
      if (isLatinScript(translatedValue)) {
        BRAND_TERMS.forEach(term => {
          if (containsProtectedTerm(sourceValue, term) && !containsProtectedTerm(translatedValue, term)) {
            protectedTermLosses.push({ key, term });
          }
        });
      }
    });

    results[code] = {
      missingKeys,
      extraKeys,
      fallbacks,
      tokenMismatches,
      protectedTermLosses,
      fallbackRate: englishKeys.length === 0 ? 0 : fallbacks.length / englishKeys.length,
    };

    totals.locales += 1;
    totals.fallbacks += fallbacks.length;
    totals.priorityFallbacks += fallbacks.filter(item => item.priority === 'high').length;
    totals.tokenMismatches += tokenMismatches.length;
    totals.protectedTermLosses += protectedTermLosses.length;
    totals.missingKeys += missingKeys.length;
    totals.extraKeys += extraKeys.length;
  });

  return { englishKeys: englishKeys.length, results, totals };
}

function printReport(report) {
  const { totals, results, englishKeys } = report;
  console.log(`Validating ${totals.locales} locale files against en.json (${englishKeys} keys)...`);

  Object.entries(results).forEach(([code, result]) => {
    const status = result.missingKeys.length === 0 &&
      result.extraKeys.length === 0 &&
      result.tokenMismatches.length === 0 &&
      result.protectedTermLosses.length === 0
      ? '✅'
      : '⚠️';

    console.log(
      `${status} ${code}: ${result.fallbacks.length} English fallbacks, ` +
      `${result.tokenMismatches.length} token mismatches, ` +
      `${result.protectedTermLosses.length} protected-term losses`,
    );
  });

  console.log('\nSummary');
  console.log(`- English fallbacks: ${totals.fallbacks} (${totals.priorityFallbacks} high-priority)`);
  console.log(`- Missing keys: ${totals.missingKeys}`);
  console.log(`- Extra keys: ${totals.extraKeys}`);
  console.log(`- Interpolation mismatches: ${totals.tokenMismatches}`);
  console.log(`- Protected-term losses: ${totals.protectedTermLosses}`);
}

function main() {
  const localesDir = process.argv[2] || DEFAULT_LOCALES_DIR;
  try {
    const report = analyzeLocales(readLocaleFiles(localesDir));
    printReport(report);

    const hardErrors = report.totals.missingKeys +
      report.totals.extraKeys +
      report.totals.tokenMismatches +
      report.totals.protectedTermLosses;

    if (hardErrors > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`❌ Locale validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  analyzeLocales,
  compareTokens,
  containsProtectedTerm,
  extractTokens,
  isEnglishFallback,
  isLatinScript,
  readLocaleFiles,
};
