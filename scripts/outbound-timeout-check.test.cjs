const assert = require('node:assert/strict');
const { test } = require('node:test');

// The check parses with the TypeScript compiler, which jobs that skip `npm ci` do not have.
let findUnbounded = null;
try {
    require.resolve('typescript');
    ({ findUnbounded } = require('./outbound-timeout-check.cjs'));
} catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
const skip = findUnbounded ? false : 'typescript is not installed in this job';
const calls = source => findUnbounded('sample.ts', source).map(hit => hit.call);

test('flags fetch, axios and web-push calls that can wait forever', { skip }, () => {
    assert.deepEqual(calls(`
        await fetch(url);
        await fetch(url, { headers: { Accept: 'application/json' } });
        await axios.get(url);
        await axios.post(url, body, { headers: {} });
        await webpush.sendNotification(subscription, payload);
    `), ['fetch', 'fetch', 'axios.get', 'axios.post', 'webpush.sendNotification']);
});

test('accepts calls with a timeout, a signal, shared options or a racing timer', { skip }, () => {
    assert.deepEqual(calls(`
        await fetch(url, { signal: outboundSignal() });
        await axios.get(url, { params, timeout: OUTBOUND_TIMEOUT_MS });
        await axios.post(url, body, paypalJsonConfig(token));
        await axios.post(url, body, { ...SHARED_OPTIONS });
        await webpush.sendNotification(subscription, payload, { timeout: 15000 });
        await Promise.race([fetch(url), new Promise((_, reject) => setTimeout(reject, 1000))]);
    `), []);
});

test('ignores fetch named inside comments and methods of other objects', { skip }, () => {
    assert.deepEqual(calls(`
        // live TLE fetch (celestrak.org/NORAD)
        await this.fetch(url);
        await client.fetch(url);
    `), []);
});
