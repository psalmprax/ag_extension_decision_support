// Tests for scripts/live-smoke.cjs. The real script is piped through stdin
// (`node - < live-smoke.cjs`, exactly as the workflow runs it) against a stub
// dist/ tree, so exit codes, required-vs-optional handling and secret masking
// are all exercised end to end.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const SCRIPT = fs.readFileSync(path.join(__dirname, 'live-smoke.cjs'));

/**
 * Build a fake dist/. `providers` maps provider type -> behaviour:
 *   { configured, text, throws, embedding: number (dims) }
 */
function makeDist({ primary = 'aihubmix', fallback = 'openrouter', embeddings = 'aihubmix', width = 768, providers, paypal, app = {} }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-smoke-'));
    const write = (rel, body) => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), body);
    };
    write('config.js', `exports.config = ${JSON.stringify({
        ai: { primary: { provider: primary }, fallback: { provider: fallback }, embeddings: { provider: embeddings, model: 'emb-model' } },
    })};`);
    write('services/embeddingDimensions.js', `exports.EMBEDDING_DIMENSIONS = ${width};`);
    // getEmbedding(): app.dims (default: width), app.throws, app.timeoutsFirst.
    write('services/embeddingCache.js', `
        const app = ${JSON.stringify({ dims: width, ...app })};
        let calls = 0;
        exports.getEmbedding = async () => {
            calls += 1;
            if (app.timeoutsFirst && calls === 1) throw new Error('Embedding generation timed out after 3500ms');
            if (app.throws) throw new Error(app.throws);
            return new Array(app.dims).fill(0.1);
        };`);
    write('services/aiProvider/aiProvider.js', `
        const spec = ${JSON.stringify(providers)};
        exports.AIProviderFactory = {
            initialize() {},
            async getProvider(type) {
                const s = spec[type] || { configured: false };
                return {
                    isConfigured: () => !!s.configured,
                    async generateText() {
                        if (s.throws) { const e = new Error(s.throws); e.response = { status: 401, data: { error: { message: s.throws } } }; throw e; }
                        return { text: s.text ?? 'pong', model: type + '-model' };
                    },
                    async createEmbedding(_text, opts) {
                        if (!s.embedding) throw new Error(type + ' does not support embeddings');
                        return { embedding: new Array(s.embedding).fill(0.5), model: opts.model };
                    },
                };
            },
        };`);
    const pp = { configured: true, base: 'https://api-m.sandbox.paypal.com', success: true, ...paypal };
    write('services/paymentService.js', `
        const pp = ${JSON.stringify(pp)};
        exports.paymentService = {
            async whenReady() {},
            isPayPalConfigured: () => pp.configured,
            paypalApiBase: () => pp.base,
            async createPayPalPayment() {
                if (pp.calledMarker) require('fs').writeFileSync(pp.calledMarker, 'called');
                return pp.success
                    ? { success: true, paymentId: 'PAYID-1', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=EC-1' }
                    : { success: false, errorCode: 'PAYPAL_ERROR', message: 'invalid_client' };
            },
        };`);
    return dir;
}

function run(dist) {
    const res = spawnSync(process.execPath, ['-'], {
        input: SCRIPT,
        env: { ...process.env, LIVE_SMOKE_DIST: dist },
        encoding: 'utf8',
    });
    return { code: res.status, out: res.stdout + res.stderr };
}

const healthy = {
    aihubmix: { configured: true, embedding: 768 },
    openrouter: { configured: true },
};

test('passes when primary, fallback, embeddings and PayPal sandbox all work', () => {
    const { code, out } = run(makeDist({ providers: healthy }));
    assert.equal(code, 0, out);
    assert.match(out, /PASS\s+text: aihubmix \(primary\)/);
    assert.match(out, /PASS\s+text: openrouter \(fallback\)/);
    assert.match(out, /PASS\s+embedding: app path\s+768 dims \(EMBEDDING_DIMENSIONS=768\)/);
    assert.match(out, /PASS\s+embedding: aihubmix \(selected\)\s+emb-model, 768 dims/);
    assert.match(out, /Selected: primary=aihubmix\/.*, fallback=openrouter\/.*, embeddings=aihubmix\/emb-model at 768 dims/);
    assert.match(out, /PASS\s+paypal: sandbox order/);
    assert.match(out, /SKIP\s+text: anthropic\s+not configured/);
    assert.doesNotMatch(out, /PAYID-1|EC-1/, 'payment ids must not be printed');
});

test('fails when the app cannot produce embeddings that fit the pgvector columns', () => {
    const { code, out } = run(makeDist({
        providers: { ...healthy, aihubmix: { configured: true, embedding: 3072 } },
        app: { throws: 'Embedding has 3072 dimensions; expected 768' },
    }));
    assert.equal(code, 1);
    assert.match(out, /FAIL\s+embedding: app path\s+Embedding has 3072 dimensions/);
    assert.match(out, /WARN\s+embedding: aihubmix \(selected\)\s+.*returned 3072 dimensions; pgvector columns are 768/);
});

test('an unconfigured embeddings selection is a warning while the app path still works', () => {
    const { code, out } = run(makeDist({ embeddings: 'openai', providers: healthy }));
    assert.equal(code, 0, out);
    assert.match(out, /PASS\s+embedding: app path/);
    assert.match(out, /WARN\s+embedding: openai \(selected\)\s+AI_EMBEDDINGS_PROVIDER=openai is not configured/);
});

test('a cold-start timeout on the app path is retried once and reported', () => {
    const { code, out } = run(makeDist({ providers: healthy, app: { timeoutsFirst: true } }));
    assert.equal(code, 0, out);
    assert.match(out, /PASS\s+embedding: app path\s+768 dims .*passed on retry after a cold-start timeout/);
});

test('a failing primary fails the run and its key is masked', () => {
    const { code, out } = run(makeDist({ providers: { ...healthy, aihubmix: { configured: true, embedding: 768, throws: 'Incorrect API key sk-abcdefghijklmnop1234' } } }));
    assert.equal(code, 1);
    assert.match(out, /FAIL\s+text: aihubmix \(primary\)\s+HTTP 401 Incorrect API key sk-\*\*\*/);
    assert.doesNotMatch(out, /abcdefghijklmnop1234/);
});

test('a failing non-selected provider is a warning, not a failure', () => {
    const { code, out } = run(makeDist({ providers: { ...healthy, groq: { configured: true, throws: 'rate limited' } } }));
    assert.equal(code, 0, out);
    assert.match(out, /WARN\s+text: groq\s+HTTP 401 rate limited/);
    assert.match(out, /1 warnings/);
});

test('a selected fallback that is not configured fails', () => {
    const { code, out } = run(makeDist({ fallback: 'groq', providers: healthy }));
    assert.equal(code, 1);
    assert.match(out, /FAIL\s+text: groq \(fallback\)\s+selected as AI_FALLBACK_PROVIDER but not configured/);
});

test('never creates a payment against the live PayPal API', () => {
    const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pp-')), 'called');
    const { code, out } = run(makeDist({ providers: healthy, paypal: { base: 'https://api-m.paypal.com', calledMarker: marker } }));
    assert.equal(code, 0, out);
    assert.match(out, /SKIP\s+paypal: sandbox order\s+live PayPal API/);
    assert.equal(fs.existsSync(marker), false, 'createPayPalPayment must not be called for the live API');
});

test('a PayPal sandbox error fails the run; unconfigured PayPal is skipped', () => {
    let r = run(makeDist({ providers: healthy, paypal: { success: false } }));
    assert.equal(r.code, 1);
    assert.match(r.out, /FAIL\s+paypal: sandbox order\s+PAYPAL_ERROR: invalid_client/);
    r = run(makeDist({ providers: healthy, paypal: { configured: false } }));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /SKIP\s+paypal: sandbox order\s+PayPal not configured/);
});

test('a missing dist/ is a clear fatal error', () => {
    const { code, out } = run(path.join(os.tmpdir(), 'no-such-dist'));
    assert.equal(code, 1);
    assert.match(out, /FATAL: Cannot find module/);
});
