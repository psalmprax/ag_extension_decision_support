#!/usr/bin/env node
/**
 * Live smoke checks against real third-party services, using the app's own
 * compiled code (dist/) so it exercises the same providers, config and
 * credentials as the running backend.
 *
 * Run inside the backend container, e.g. from the deploy host:
 *   docker exec -i ag-dashboard-backend node - < scripts/live-smoke.cjs
 *
 * What it does:
 *   - AI: one short text generation per configured provider; one embedding
 *     through the app's own getEmbedding() (router, fallback chain and the
 *     pgvector width check, EMBEDDING_DIMENSIONS); and one direct embedding
 *     from the selected AI_EMBEDDINGS_PROVIDER.
 *   - PayPal: creates (never executes) a 1.00 USD sandbox payment. Skipped when
 *     PayPal is not configured or the API base is not the sandbox.
 *   - Landing page assistant, through the running backend's public routes (QA
 *     v1 landing #2/#3): a typed farming question must get a real answer, and
 *     speech must round-trip (server speech synthesis, then transcription of
 *     that audio back to the same words).
 *
 * Exit code: 1 when a REQUIRED check fails (primary text, fallback text, the
 * app's embedding path, PayPal sandbox when configured, the landing chat).
 * The landing speech round trip is reported as WARN. Other configured
 * providers, and the selected embeddings provider when the router can still
 * serve embeddings without it, are reported as WARN. Output never includes keys, prompts' replies
 * beyond a short preview, or payment ids.
 */
'use strict';

const DIST = process.env.LIVE_SMOKE_DIST || '/app/dist';
const ALL_PROVIDERS = [
    'aihubmix', 'openrouter', 'azure_openai', 'google_vertex', 'openai',
    'anthropic', 'groq', 'nvidia', 'huggingface', 'freebuff', 'ollama',
];

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

/** Short, single-line error text with anything key-shaped masked. */
function describe(error) {
    const status = error?.response?.status ?? error?.status;
    const body = error?.response?.data;
    const bodyText = body && typeof body === 'object'
        ? (body.error?.message || body.message || body.error || JSON.stringify(body))
        : body;
    const text = [status ? `HTTP ${status}` : '', String(bodyText || error?.message || error)]
        .filter(Boolean).join(' ');
    return text
        .replace(/(sk|pk|rk|gsk|nvapi|hf|AIza)[-_A-Za-z0-9]{8,}/g, '$1-***')
        .replace(/Bearer\s+\S+/gi, 'Bearer ***')
        .replace(/\s+/g, ' ')
        .slice(0, 220);
}

async function checkText(factory, type) {
    const provider = await factory.getProvider(type);
    if (!provider.isConfigured()) return { status: 'SKIP', detail: 'not configured' };
    const started = Date.now();
    const ms = type === 'ollama' ? 120_000 : 45_000;
    const result = await withTimeout(
        // Room for reasoning models, which spend tokens before the visible reply.
        provider.generateText('Reply with exactly one word: pong', { maxTokens: 256, temperature: 0 }),
        ms, `${type} text`,
    );
    const text = (result?.text || '').trim();
    if (!text) {
        // Say why: a reasoning model that spends its budget thinking ends with "length".
        const used = result?.usage?.completionTokens;
        throw new Error(`empty reply (model ${result?.model || 'unknown'}, finish ${result?.finishReason || 'unknown'}${used !== undefined ? `, ${used} completion tokens` : ''})`);
    }
    return {
        status: 'PASS',
        detail: `${result.model || 'default model'}, ${Date.now() - started} ms, "${text.slice(0, 24).replace(/\s+/g, ' ')}"`,
    };
}

/** The app's own path: router + fallback chain + width assertion. */
async function checkAppEmbedding(getEmbedding, width) {
    const run = () => withTimeout(getEmbedding(`maize leaf rust ${Date.now()}`), 30_000, 'getEmbedding');
    const started = Date.now();
    let note = '';
    let vector;
    try {
        vector = await run();
    } catch (error) {
        // A fresh process pays provider health checks inside getEmbedding's 3.5 s
        // budget; the running app has them cached. Retry once, and say so.
        if (!/timed out/.test(String(error?.message))) throw error;
        note = ', passed on retry after a cold-start timeout';
        vector = await run();
    }
    return { status: 'PASS', detail: `${vector.length} dims (EMBEDDING_DIMENSIONS=${width}), ${Date.now() - started} ms${note}` };
}

async function checkEmbedding(factory, providerType, model, width) {
    const provider = await factory.getProvider(providerType);
    if (!provider.isConfigured()) {
        return { status: 'WARN', detail: `AI_EMBEDDINGS_PROVIDER=${providerType} is not configured; embeddings come from the fallback chain` };
    }
    const started = Date.now();
    const result = await withTimeout(
        provider.createEmbedding('maize leaf rust on smallholder farms', { model, dimensions: width }),
        30_000, 'embedding',
    );
    const length = Array.isArray(result?.embedding) ? result.embedding.length : 0;
    if (length !== width) {
        throw new Error(`${result?.model || model} returned ${length} dimensions; pgvector columns are ${width} (EMBEDDING_DIMENSIONS)`);
    }
    if (!result.embedding.every(Number.isFinite)) throw new Error('embedding contains non-numeric values');
    return { status: 'PASS', detail: `${result.model || model}, ${length} dims, ${Date.now() - started} ms` };
}

async function checkPayPal(paymentService) {
    await withTimeout(paymentService.whenReady(), 20_000, 'payment service init');
    if (!paymentService.isPayPalConfigured()) return { status: 'SKIP', detail: 'PayPal not configured' };
    const base = paymentService.paypalApiBase();
    if (!/sandbox/.test(base)) return { status: 'SKIP', detail: 'live PayPal API (not sandbox); not touching real payments' };
    const result = await withTimeout(paymentService.createPayPalPayment({
        userId: 'live-smoke',
        amount: 100,
        currency: 'USD',
        description: 'Live smoke check (never executed)',
        returnUrl: 'https://example.com/live-smoke/return',
        cancelUrl: 'https://example.com/live-smoke/cancel',
    }), 45_000, 'PayPal order');
    if (!result?.success) throw new Error(`${result?.errorCode || 'PAYPAL_ERROR'}: ${result?.message || 'no detail'}`);
    if (!/^https:\/\/[^/]*sandbox\.paypal\.com\//.test(result.approvalUrl || '')) {
        throw new Error('approval URL is not on the sandbox domain');
    }
    return { status: 'PASS', detail: 'sandbox payment created with a sandbox approval URL (not executed)' };
}

/** POST to the running backend inside the container (public routes, no auth). */
async function postLocal(path, body, ms) {
    const port = process.env.PORT || '3001';
    const res = await withTimeout(fetch(`http://127.0.0.1:${port}/api${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }), ms, path);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
        throw new Error(`HTTP ${res.status} ${json.error || json.message || ''}`.trim());
    }
    return json.data || {};
}

/** The landing page's "Ask Copilot": a farming question gets a real, non-canned answer. */
async function checkLandingChat() {
    const data = await postLocal('/chatbot/public-demo', {
        query: 'When should I top-dress maize with nitrogen fertiliser?',
        language: 'en',
    }, 45000);
    const text = String(data.text || '').trim();
    if (/how can i help you today/i.test(text)) return { status: 'FAIL', detail: 'canned greeting instead of an answer' };
    if (text.length < 40) return { status: 'FAIL', detail: `answer too short (${text.length} chars)` };
    return { status: 'PASS', detail: `${text.length} chars: ${text.slice(0, 60).replace(/\s+/g, ' ')}…` };
}

/** The landing page's speech: synthesise a sentence, then transcribe that audio back. */
async function checkLandingSpeech() {
    const sentence = 'My maize leaves are turning yellow';
    const spoken = await postLocal('/chatbot/public-demo/tts', { text: sentence, language: 'en' }, 30000);
    if (!spoken.audioBase64) return { status: 'WARN', detail: 'speech synthesis returned no audio' };
    const heard = await postLocal('/chatbot/public-demo/stt', {
        audio: spoken.audioBase64,
        mimeType: 'audio/mpeg',
        language: 'en',
    }, 45000);
    const text = String(heard.text || '');
    return /maize/i.test(text) && /yellow/i.test(text)
        ? { status: 'PASS', detail: `heard: "${text.slice(0, 60)}"` }
        : { status: 'WARN', detail: `transcript did not match: "${text.slice(0, 60)}"` };
}

async function main() {
    const { config } = require(`${DIST}/config`);
    const { logger } = require(`${DIST}/utils/logger`);
    for (const transport of logger.transports || []) {
        if (transport.name === 'console' || transport.constructor?.name === 'Console') {
            transport.silent = true;
        }
    }
    const { AIProviderFactory } = require(`${DIST}/services/aiProvider/aiProvider`);
    const { EMBEDDING_DIMENSIONS } = require(`${DIST}/services/embeddingDimensions`);
    AIProviderFactory.initialize();

    const primary = config.ai.primary.provider;
    const fallback = config.ai.fallback.provider;
    const rows = [];
    const record = (check, required, outcome) => rows.push({ check, required, ...outcome });

    for (const type of ALL_PROVIDERS) {
        const required = type === primary || type === fallback;
        const label = `text: ${type}${type === primary ? ' (primary)' : type === fallback ? ' (fallback)' : ''}`;
        try {
            record(label, required, await checkText(AIProviderFactory, type));
        } catch (error) {
            record(label, required, { status: required ? 'FAIL' : 'WARN', detail: describe(error) });
        }
    }

    try {
        const { getEmbedding } = require(`${DIST}/services/embeddingCache`);
        record('embedding: app path', true, await checkAppEmbedding(getEmbedding, EMBEDDING_DIMENSIONS));
    } catch (error) {
        record('embedding: app path', true, { status: 'FAIL', detail: describe(error) });
    }
    const { provider: embProvider, model: embModel } = config.ai.embeddings;
    try {
        record(`embedding: ${embProvider} (selected)`, false, await checkEmbedding(AIProviderFactory, embProvider, embModel, EMBEDDING_DIMENSIONS));
    } catch (error) {
        record(`embedding: ${embProvider} (selected)`, false, { status: 'WARN', detail: describe(error) });
    }

    try {
        const { paymentService } = require(`${DIST}/services/paymentService`);
        record('paypal: sandbox order', true, await checkPayPal(paymentService));
    } catch (error) {
        record('paypal: sandbox order', true, { status: 'FAIL', detail: describe(error) });
    }

    try {
        record('landing: assistant answers', true, await checkLandingChat());
    } catch (error) {
        record('landing: assistant answers', true, { status: 'FAIL', detail: describe(error) });
    }
    try {
        record('landing: speech round trip', false, await checkLandingSpeech());
    } catch (error) {
        record('landing: speech round trip', false, { status: 'WARN', detail: describe(error) });
    }

    // A primary or fallback that is not configured is itself a failure.
    for (const row of rows) {
        if (row.required && row.status === 'SKIP' && row.check.startsWith('text:')) {
            row.status = 'FAIL';
            row.detail = `selected as ${row.check.includes('primary') ? 'AI_PRIMARY_PROVIDER' : 'AI_FALLBACK_PROVIDER'} but not configured`;
        }
    }

    const width = Math.max(...rows.map(r => r.check.length));
    // Selection only (names, never keys), so a failure can be read without the server.
    const env = process.env;
    console.log(`Live smoke (${new Date().toISOString()}), NODE_ENV=${env.NODE_ENV || 'unset'}`);
    console.log(`Selected: primary=${primary}/${env.AI_PRIMARY_MODEL || 'provider default'}, fallback=${fallback}/${env.AI_FALLBACK_MODEL || 'provider default'}, embeddings=${embProvider}/${embModel} at ${EMBEDDING_DIMENSIONS} dims, OLLAMA_MODEL=${env.OLLAMA_MODEL || 'unset'}\n`);
    for (const row of rows) console.log(`${row.status.padEnd(4)}  ${row.check.padEnd(width)}  ${row.detail}`);
    const failed = rows.filter(r => r.status === 'FAIL');
    const warned = rows.filter(r => r.status === 'WARN');
    console.log(`\n${rows.filter(r => r.status === 'PASS').length} passed, ${failed.length} failed, ${warned.length} warnings, ${rows.filter(r => r.status === 'SKIP').length} skipped`);
    return failed.length === 0 ? 0 : 1;
}

// Runs when executed directly or piped (`node - < live-smoke.cjs`, module id
// "[stdin]"); does nothing when require()d.
if (require.main === module || module.id === '[stdin]') {
    main().then(
        code => process.exit(code),
        error => { console.error(`FATAL: ${describe(error)}`); process.exit(1); },
    );
}

module.exports = { describe, withTimeout, checkText, checkAppEmbedding, checkEmbedding, checkPayPal };
