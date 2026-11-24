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

// Every provider whose key is set, in this order: one that refuses (no credit, bad key) or keeps
// failing hands its strings to the next, so an empty account no longer stops the run. All speak
// the OpenAI chat-completions protocol. Each lists models to try in turn when one is not served.
// TRANSLATE_MODEL replaces the first available provider's models.
const PROVIDERS = [
  { name: 'AIHubMix', key: getEnvKey('AIHUBMIX_API_KEY'), url: 'https://aihubmix.com/v1/chat/completions', models: ['gemini-3.1-flash-lite'] },
  { name: 'Groq', key: getEnvKey('GROQ_API_KEY'), url: 'https://api.groq.com/openai/v1/chat/completions', models: ['qwen/qwen3.6-27b'] },
  {
    name: 'NVIDIA', key: getEnvKey('NVIDIA_API_KEY'), url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: ['nvidia/nemotron-3-super-120b-a12b', 'nvidia/nemotron-3.5-lightning-30b-a3b'],
  },
  // OpenRouter's free router sends each request to a free model that is up.
  { name: 'OpenRouter', key: getEnvKey('OPENROUTER_API_KEY'), url: 'https://openrouter.ai/api/v1/chat/completions', models: ['openrouter/free'] },
].filter(provider => provider.key);
if (PROVIDERS.length === 0) {
  console.error('Missing AIHUBMIX_API_KEY, GROQ_API_KEY, NVIDIA_API_KEY or OPENROUTER_API_KEY in environment or .env');
  process.exit(1);
}
if (process.env.TRANSLATE_MODEL) PROVIDERS[0].models = [process.env.TRANSLATE_MODEL];
console.log(`Translation providers, in order: ${PROVIDERS.map(p => `${p.name} (${p.models.join(', ')})`).join('; ')}`);

const LANGUAGE_NAMES = {
  ar: 'Arabic',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  hi: 'Hindi',
  pt: 'Portuguese',
  sw: 'Kiswahili',
  zu: 'isiZulu',
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
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
  am: 'Amharic',
  om: 'Afaan Oromoo (Oromo)',
  ny: 'Chichewa (Nyanja)',
  lg: 'Luganda',
  rw: 'Kinyarwanda',
  so: 'Somali',
  bn: 'Bengali',
  id: 'Indonesian',
  vi: 'Vietnamese',
  ur: 'Urdu',
};

const PROTECTED_TERMS = [
  'FAOSTAT', 'NASA POWER', 'SoilGrids', 'ISRIC', 'Stripe', 'PayPal',
  // Names on the landing page: products, data sources, institutions and channels.
  'GPExts', 'Sentinel-2', 'NDVI', 'USSD', 'WhatsApp', 'Telegram', 'IITA', 'CIMMYT', 'EUDR', 'SAP/NetSuite',
];
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

/** Every provider refused for a reason a retry cannot fix (no credit, bad key): stop the run. */
class ProviderRefused extends Error {}

/** The model's reply as an object: without a reasoning block or a ```json fence, else the first {...}. */
function parseReply(content) {
  const text = String(content).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('reply is not JSON');
    return JSON.parse(text.slice(start, end + 1));
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * One request to one provider and model. Returns the parsed object, or throws: 'refused' for
 * 401/402/403 (or a quota message), 'model' when the model is not served, 'retry' otherwise.
 */
async function requestOnce(provider, model, prompt) {
  const body = {
    model,
    max_tokens: 8192,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert multilingual localization specialist for agricultural and field telemetry software. You must return valid JSON only.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  };
  if (!provider.noJsonMode) body.response_format = { type: 'json_object' };
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300);
    console.warn(`  [${provider.name} ${model} HTTP ${res.status}] ${errText.slice(0, 150)}`);
    const kind = [401, 402, 403].includes(res.status) || /insufficient|balance|quota limit/i.test(errText) ? 'refused'
      : res.status === 404 || /model.*(not found|does not exist|unavailable)/i.test(errText) ? 'model'
      : res.status === 400 && /response_format|json_object|json mode/i.test(errText) ? 'nojson'
      : res.status === 429 ? 'rate'
      : 'retry';
    throw Object.assign(new Error(`${provider.name} HTTP ${res.status}: ${errText.slice(0, 200)}`), { kind });
  }
  const data = await res.json();
  return parseReply(data.choices?.[0]?.message?.content ?? '');
}

/**
 * The translated object from the first provider and model that answers. A provider that refuses
 * is dropped for the rest of the run; one that keeps failing is skipped for this request only.
 * Null when none answered; ProviderRefused when every provider has refused.
 */
async function callModel(prompt, retries = 4) {
  for (const provider of PROVIDERS) {
    if (provider.refused) continue;
    for (const model of provider.models) {
      if (provider.missingModels?.has(model)) continue;
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          return await requestOnce(provider, model, prompt);
        } catch (e) {
          if (e.kind === 'refused') {
            provider.refused = e.message;
            console.warn(`  ${provider.name} refused; using the next provider from now on.`);
            break;
          }
          if (e.kind === 'model') {
            (provider.missingModels ??= new Set()).add(model);
            break;
          }
          if (e.kind === 'nojson') {
            provider.noJsonMode = true;
            continue;
          }
          console.warn(`  [${provider.name} ${model} attempt ${attempt + 1}] ${e.message}`);
          // Several jobs share one key: on "too many requests" wait long enough for the window to pass.
          await sleep((e.kind === 'rate' ? 20_000 : 2000) * (attempt + 1) + Math.random() * 1000);
        }
      }
      if (provider.refused) break;
    }
  }
  if (PROVIDERS.every(provider => provider.refused)) {
    throw new ProviderRefused(PROVIDERS.map(provider => provider.refused).join('; '));
  }
  return null;
}

async function translateChunk(chunk, langCode, langName) {
  const prompt = `Translate the string values in the following JSON object to ${langName} (${langCode}).

CRITICAL CONSTRAINTS:
1. Preserve every key exactly as given.
2. Preserve all interpolation tokens (e.g., {count}, {date}, {reason}, {location}, {{name}}) exactly unchanged. Do NOT translate inside curly braces.
3. Preserve protected terms unchanged: ${PROTECTED_TERMS.join(', ')}, GPS, SMS, AI, API.
4. Translate agronomic and software terminology accurately and naturally for ${langName}.
5. Return ONLY a valid JSON object with the exact same keys and the translated values.

Input JSON:
${JSON.stringify(chunk, null, 2)}`;

  const result = await callModel(prompt);
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

/** The locale file in en.json's key order. */
function saveLocale(filePath, en, locale) {
  const sorted = {};
  Object.keys(en).forEach(k => {
    sorted[k] = locale[k] || en[k];
  });
  fs.writeFileSync(filePath, JSON.stringify(sorted, null, 4) + '\n');
}

async function translateLanguage(code, onlyKeys = null) {
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
    if (onlyKeys && !onlyKeys.has(k)) return false;
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

  // Large chunks intermittently fail JSON-mode validation on the provider;
  // CHUNK_SIZE env override allows smaller, reliable batches (default 30).
  const CHUNK_SIZE = Math.max(1, Number(process.env.TRANSLATE_CHUNK_SIZE ?? 30) || 30);
  let translatedCount = 0;
  let refused = null;

  for (let i = 0; i < pendingKeys.length; i += CHUNK_SIZE) {
    const chunkKeys = pendingKeys.slice(i, i + CHUNK_SIZE);
    const chunk = {};
    chunkKeys.forEach(k => {
      chunk[k] = en[k];
    });

    let translated;
    try {
      translated = await translateChunk(chunk, code, langName);
    } catch (e) {
      if (!(e instanceof ProviderRefused)) throw e;
      refused = e; // keep what was translated, then stop
      break;
    }
    for (const [k, v] of Object.entries(translated)) {
      locale[k] = v;
      translatedCount++;
    }
    saveLocale(filePath, en, locale); // a timeout or a refusal keeps everything done so far

    console.log(`  [${code}] Processed ${Math.min(i + CHUNK_SIZE, pendingKeys.length)}/${pendingKeys.length} (translated: ${translatedCount})`);
    await new Promise(r => setTimeout(r, 500));
  }

  saveLocale(filePath, en, locale);
  if (refused) {
    console.error(`[${code} - ${langName}] Stopped after ${translatedCount} of ${pendingKeys.length} keys: ${refused.message}`);
    throw refused;
  }
  console.log(`✅ [${code} - ${langName}] Done! Saved with ${translatedCount} translated keys.`);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  // Optional scoped runs: node llm-translate-locales.js fr sw --keys k1,k2
  const keysFlag = rawArgs.find(a => a.startsWith('--keys='));
  const onlyKeys = keysFlag ? new Set(keysFlag.slice('--keys='.length).split(',').map(s => s.trim()).filter(Boolean)) : null;
  const args = rawArgs.filter(a => !a.startsWith('--keys='));
  const targets = args.length > 0 ? args : Object.keys(LANGUAGE_NAMES);

  console.log(`Starting LLM-driven localization for: ${targets.join(', ')}${onlyKeys ? ` (scoped to ${onlyKeys.size} keys)` : ''}\n`);
  for (const lang of targets) {
    await translateLanguage(lang, onlyKeys);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\nAll targeted languages processed!');
}

main().catch(err => {
  if (err instanceof ProviderRefused) {
    console.error(`\nStopped: every provider refused (${err.message}).\nNothing more can be translated until one accepts requests again (for example, an account is topped up).`);
    process.exit(2);
  }
  console.error('Fatal error:', err);
  process.exit(1);
});
