#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const LOCALES_DIR = path.join(__dirname, '../src/frontend/public/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');
const ENV_PATH = path.join(__dirname, '../.env');

function getEnvKey(key) {
  if (process.env[key]) return process.env[key];
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${key}=`)) {
        return trimmed.slice(key.length + 1).trim();
      }
    }
  }
  return '';
}

const GROQ_API_KEY = getEnvKey('GROQ_API_KEY');
if (!GROQ_API_KEY) {
  console.error('Missing GROQ_API_KEY in environment or .env');
  process.exit(1);
}

const LANGUAGE_NAMES = {
  zh: 'Simplified Chinese',
  it: 'Italian',
  ru: 'Russian',
  tr: 'Turkish',
  nl: 'Dutch',
  pl: 'Polish',
  el: 'Greek',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  da: 'Danish',
  sk: 'Slovak',
  uk: 'Ukrainian',
  ug: 'Uyghur',
};

const PROTECTED_TERMS = ['FAOSTAT', 'NASA POWER', 'SoilGrids', 'ISRIC', 'Stripe', 'PayPal'];
const UNIVERSAL_TERMS = new Set(['AI', 'API', 'GPS', 'ID', 'PDF', 'SMS', 'USD', 'KES', 'MWK']);

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

function checkTokens(original, translated) {
  const origTokens = extractTokens(original);
  const transTokens = extractTokens(translated);
  return JSON.stringify(origTokens) === JSON.stringify(transTokens);
}

function checkProtectedTerms(original, translated) {
  for (const term of PROTECTED_TERMS) {
    if (original.includes(term) && !translated.includes(term)) {
      return false;
    }
  }
  return true;
}

async function callGroq(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.6-27b',
          max_tokens: 4096,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert multilingual localization specialist for agricultural and field telemetry software. You must return valid JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`  [Groq HTTP ${res.status}] ${errText.slice(0, 150)}`);
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      return JSON.parse(content);
    } catch (e) {
      console.warn(`  [Groq Error attempt ${i + 1}] ${e.message}`);
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
}

async function translateChunk(chunk, langCode, langName) {
  const prompt = `Translate the string values in the following JSON object to ${langName} (${langCode}).

CRITICAL CONSTRAINTS:
1. Preserve every key exactly as given.
2. Preserve all interpolation tokens (e.g., {count}, {date}, {reason}, {location}, {{name}}) exactly unchanged. Do NOT translate inside curly braces.
3. Preserve protected terms unchanged: FAOSTAT, NASA POWER, SoilGrids, ISRIC, Stripe, PayPal, GPS, SMS, AI, API.
4. Translate agronomic and software terminology accurately and naturally for ${langName}.
5. Return ONLY a valid JSON object with the exact same keys and the translated values.

Input JSON:
${JSON.stringify(chunk, null, 2)}`;

  const result = await callGroq(prompt);
  if (!result) return {};

  const validated = {};
  for (const [key, origVal] of Object.entries(chunk)) {
    const transVal = result[key];
    if (typeof transVal === 'string' && transVal.trim()) {
      if (checkTokens(origVal, transVal) && checkProtectedTerms(origVal, transVal)) {
        validated[key] = transVal.trim();
      } else {
        console.warn(`  [token/protected mismatch in ${key} for ${langCode}] orig: "${origVal}" -> trans: "${transVal}"`);
      }
    }
  }
  return validated;
}

async function translateLanguage(code) {
  const langName = LANGUAGE_NAMES[code];
  if (!langName) {
    console.warn(`Unknown language code: ${code}`);
    return;
  }

  const filePath = path.join(LOCALES_DIR, `${code}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }

  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const locale = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const pendingKeys = Object.keys(en).filter(k => {
    const src = en[k];
    const cur = locale[k];
    if (typeof src !== 'string' || typeof cur !== 'string') return false;
    if (cur !== src) return false;
    const norm = cur.trim().toUpperCase();
    return norm.length > 2 && !UNIVERSAL_TERMS.has(norm);
  });

  if (pendingKeys.length === 0) {
    console.log(`[${code} - ${langName}] 0 fallbacks to translate. Already localized!`);
    return;
  }

  console.log(`[${code} - ${langName}] Translating ${pendingKeys.length} fallback keys...`);

  const CHUNK_SIZE = 30;
  let translatedCount = 0;

  for (let i = 0; i < pendingKeys.length; i += CHUNK_SIZE) {
    const chunkKeys = pendingKeys.slice(i, i + CHUNK_SIZE);
    const chunk = {};
    chunkKeys.forEach(k => {
      chunk[k] = en[k];
    });

    const translated = await translateChunk(chunk, code, langName);
    for (const [k, v] of Object.entries(translated)) {
      locale[k] = v;
      translatedCount++;
    }

    console.log(`  [${code}] Processed ${Math.min(i + CHUNK_SIZE, pendingKeys.length)}/${pendingKeys.length} (translated: ${translatedCount})`);
    await new Promise(r => setTimeout(r, 500));
  }

  const sorted = {};
  Object.keys(en).forEach(k => {
    sorted[k] = locale[k] || en[k];
  });

  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 4) + '\n');
  console.log(`✅ [${code} - ${langName}] Done! Saved with ${translatedCount} translated keys.`);
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : Object.keys(LANGUAGE_NAMES);

  console.log(`Starting LLM-driven localization for: ${targets.join(', ')}\n`);
  for (const lang of targets) {
    await translateLanguage(lang);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\nAll targeted languages processed!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
