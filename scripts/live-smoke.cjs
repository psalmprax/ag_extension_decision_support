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
 *   - AI: one short text generation per configured provider, plus one embedding
 *     from the configured embeddings provider/model, checked against the
 *     pgvector width (EMBEDDING_DIMENSIONS).
 *   - PayPal: creates (never executes) a 1.00 USD sandbox payment. Skipped when
 *     PayPal is not configured or the API base is not the sandbox.
 *
 * Exit code: 1 when a REQUIRED check fails (primary text, fallback text,
 * embeddings, PayPal sandbox when configured). Other configured providers that
 * fail are reported as WARN. Output never includes keys, prompts' replies
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
        provider.generateText('Reply with exactly one word: pong', { maxTokens: 16, temperature: 0 }),
        ms, `${type} text`,
    );
    const text = (result?.text || '').trim();
    if (!text) throw new Error(`empty reply (model ${result?.model || 'unknown'})`);
    return {
        status: 'PASS',
        detail: `${result.model || 'default model'}, ${Date.now() - started} ms, "${text.slice(0, 24).replace(/\s+/g, ' ')}"`,
    };
}

async function checkEmbedding(factory, providerType, model, width) {
    const provider = await factory.getProvider(providerType);
    if (!provider.isConfigured()) throw new Error(`embeddings provider "${providerType}" is not configured`);
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

async function main() {
    const { config } = require(`${DIST}/config`);
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

    const { provider: embProvider, model: embModel } = config.ai.embeddings;
    try {
        record(`embedding: ${embProvider}`, true, await checkEmbedding(AIProviderFactory, embProvider, embModel, EMBEDDING_DIMENSIONS));
    } catch (error) {
        record(`embedding: ${embProvider}`, true, { status: 'FAIL', detail: describe(error) });
    }

    try {
        const { paymentService } = require(`${DIST}/services/paymentService`);
        record('paypal: sandbox order', true, await checkPayPal(paymentService));
    } catch (error) {
        record('paypal: sandbox order', true, { status: 'FAIL', detail: describe(error) });
    }

    // A primary or fallback that is not configured is itself a failure.
    for (const row of rows) {
        if (row.required && row.status === 'SKIP' && row.check.startsWith('text:')) {
            row.status = 'FAIL';
            row.detail = `selected as ${row.check.includes('primary') ? 'AI_PRIMARY_PROVIDER' : 'AI_FALLBACK_PROVIDER'} but not configured`;
        }
    }

    const width = Math.max(...rows.map(r => r.check.length));
    console.log(`Live smoke (${new Date().toISOString()}), NODE_ENV=${process.env.NODE_ENV || 'unset'}`);
    for (const row of rows) console.log(`${row.status.padEnd(4)}  ${row.check.padEnd(width)}  ${row.detail}`);
    const failed = rows.filter(r => r.status === 'FAIL');
    const warned = rows.filter(r => r.status === 'WARN');
    console.log(`\n${rows.filter(r => r.status === 'PASS').length} passed, ${failed.length} failed, ${warned.length} warnings, ${rows.filter(r => r.status === 'SKIP').length} skipped`);
    return failed.length === 0 ? 0 : 1;
}

// `node - < live-smoke.cjs` (stdin) leaves require.main undefined; tests require() it.
if (require.main === module || require.main === undefined) {
    main().then(
        code => process.exit(code),
        error => { console.error(`FATAL: ${describe(error)}`); process.exit(1); },
    );
}

module.exports = { describe, withTimeout, checkText, checkEmbedding, checkPayPal };
