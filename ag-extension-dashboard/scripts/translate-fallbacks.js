#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const FRONTEND_NODE_MODULES = path.join(__dirname, '../src/frontend/node_modules');
const translateModule = require(path.join(FRONTEND_NODE_MODULES, 'translate'));
const translate = translateModule.default || translateModule;

const LOCALES_DIR = path.join(__dirname, '../src/frontend/public/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

// Free Google web engine used by the `translate` package.
translate.engine = 'google';

const LANGUAGE_MAP = {
  ar: 'ar',
  bg: 'bg',
  cs: 'cs',
  da: 'da',
  de: 'de',
  el: 'el',
  es: 'es',
  fr: 'fr',
  hi: 'hi',
  hu: 'hu',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  pt: 'pt',
  ro: 'ro',
  ru: 'ru',
  sk: 'sk',
  sw: 'sw',
  tr: 'tr',
  ug: 'ug',
  uk: 'uk',
  zh: 'zh',
  zu: 'zu',
};

// Technical acronyms/brands that must survive machine translation unchanged.
const PROTECTED_TERMS = [
  'FAOSTAT',
  'NASA POWER',
  'NASA',
  'SoilGrids',
  'ISRIC',
  'Stripe',
  'PayPal',
  'GPS',
];

const DELAY_MS = 150;
const CONCURRENCY = 3;

let placeholderCounter = 0;
const placeholderMap = new Map();

function makePlaceholder(value, prefix) {
  const key = `__${prefix}${String(placeholderCounter++).padStart(3, '0')}__`;
  placeholderMap.set(key, value);
  return key;
}

function protectText(text) {
  let protectedText = String(text);

  // Preserve whitespace/formatting control sequences first.
  protectedText = protectedText.replace(/\\n/g, match => makePlaceholder('\\n', 'N'));

  // Preserve double-brace tokens (email templates).
  protectedText = protectedText.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, token) =>
    makePlaceholder(`{{${token}}}`, 'T'),
  );

  // Preserve single-brace interpolation tokens.
  protectedText = protectedText.replace(/\{\s*([a-zA-Z0-9_.-]+)\s*\}/g, (_m, token) =>
    makePlaceholder(`{${token}}`, 'T'),
  );

  // Preserve technical terms so they are not translated or mangled.
  PROTECTED_TERMS.forEach(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    protectedText = protectedText.replace(new RegExp(escaped, 'g'), match => makePlaceholder(term, 'B'));
  });

  return protectedText;
}

function restoreText(text) {
  const pattern = /__[NTB]\d{3,}__/g;
  return String(text).replace(pattern, match => placeholderMap.get(match) ?? match);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateWithRetry(text, targetLang, retries = 4) {
  const targetCode = LANGUAGE_MAP[targetLang] || targetLang;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const protectedText = protectText(text);
      const result = await translate(protectedText, { to: targetCode });
      const restored = restoreText(result);

      // If the translator returned nothing usable, keep the English fallback.
      if (typeof restored !== 'string' || restored.trim().length === 0) {
        return text;
      }

      return restored;
    } catch (error) {
      const isRateLimit = error.message.includes('Unexpected token') || error.message.includes('429');
      const waitTime = isRateLimit ? 1200 * attempt : DELAY_MS * attempt * 2;
      if (attempt === retries) {
        console.error(`  [warn] translate failed for "${text.slice(0, 40)}": ${error.message}`);
        return text;
      }
      await delay(waitTime);
    }
  }

  return text;
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function workerLoop() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    () => workerLoop(),
  );
  await Promise.all(workers);

  return results;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`);
}

async function translateLocale(code) {
  const filePath = path.join(LOCALES_DIR, `${code}.json`);
  const locale = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

  const pendingKeys = Object.keys(en).filter(key => {
    const source = en[key];
    const current = locale[key];
    if (typeof source !== 'string' || typeof current !== 'string') return false;

    // Only fill values that are still the English source (true fallbacks).
    if (current !== source) return false;

    const normalized = current.trim().toUpperCase();
    const isUniversal = normalized.length <= 2;
    return !isUniversal;
  });

  if (pendingKeys.length === 0) {
    console.log(`[${code}] no fallbacks to translate`);
    return;
  }

  console.log(`[${code}] translating ${pendingKeys.length} fallback values...`);

  let done = 0;
  await runPool(pendingKeys, async key => {
    const translated = await translateWithRetry(en[key], code);
    locale[key] = translated;
    done += 1;

    if (done % 50 === 0 || done === pendingKeys.length) {
      console.log(`[${code}] ${done}/${pendingKeys.length}`);
    }
    await delay(DELAY_MS);
  });

  writeJson(filePath, locale);
  console.log(`[${code}] done`);
}

async function main() {
  const requestedLangs = process.argv.slice(2);
  const available = Object.keys(LANGUAGE_MAP);
  const targets = requestedLangs.length > 0
    ? requestedLangs.filter(lang => available.includes(lang))
    : available;

  if (targets.length === 0) {
    console.error('No target languages found. Supported codes:', available.join(', '));
    process.exit(1);
  }

  console.log(`Translating fallbacks for: ${targets.join(', ')}\n`);

  for (const code of targets) {
    try {
      await translateLocale(code);
    } catch (error) {
      console.error(`[${code}] failed:`, error.message);
      process.exitCode = 1;
    }
  }

  console.log('\nTranslation pass complete.');
}

main();
