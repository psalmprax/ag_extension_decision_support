'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { needsAttention, report } = require('./error-watch.cjs');

const failure = (over) => ({ kind: 'server', method: 'GET', route: '/api/x', status: 404, count: 1, ...over });

test('a single server error is worth an alert', () => {
  assert.equal(needsAttention(failure({ status: 500 })), true);
});

test('client errors alert only when one route keeps failing', () => {
  assert.equal(needsAttention(failure({ status: 404, count: 4 })), false);
  assert.equal(needsAttention(failure({ status: 404, count: 5 })), true);
});

test('browser errors alert from the third time', () => {
  assert.equal(needsAttention(failure({ kind: 'browser', method: 'PROMISE', status: 0, count: 2 })), false);
  assert.equal(needsAttention(failure({ kind: 'browser', method: 'PROMISE', status: 0, count: 3 })), true);
});

test('the report lists flagged failures, most frequent first, with table-safe text', () => {
  const { alert, body } = report({
    hours: 1,
    generatedAt: '2026-11-27T21:00:00Z',
    failures: [
      failure({ route: '/api/upload/file/:id', status: 404, count: 6, sample: 'File not found' }),
      failure({ method: 'POST', route: '/api/visits/:id/synthesize', status: 503, count: 1, sample: 'a | b' }),
      failure({ route: '/api/quiet', count: 2 }),
    ],
  });
  assert.equal(alert, true);
  assert.ok(body.indexOf('/api/upload/file/:id') < body.indexOf('/api/visits/:id/synthesize'));
  assert.ok(!body.includes('/api/quiet'));
  assert.ok(body.includes('a \\| b'));
});

test('nothing over the limits means no alert, and the CLI writes it to the output file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'error-watch-'));
  try {
    const output = path.join(dir, 'out');
    execFileSync(process.execPath, [path.join(__dirname, 'error-watch.cjs'), output, path.join(dir, 'body.md')], {
      input: JSON.stringify({ failures: [failure({ count: 1 })] }),
    });
    assert.equal(fs.readFileSync(output, 'utf8'), 'alert=false\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
