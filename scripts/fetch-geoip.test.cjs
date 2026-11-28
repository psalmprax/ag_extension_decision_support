'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'fetch-geoip.sh');

/** Runs the script with a stand-in curl that "downloads" a gzipped file of `size` bytes (or fails). */
function run(dir, { size = 12_000_000, fail = false } = {}) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'geoip-bin-'));
  try {
    const curl = fail
      ? '#!/bin/sh\nexit 22\n'
      : `#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\nhead -c ${size} /dev/zero | gzip > "$2"\n`;
    fs.writeFileSync(path.join(bin, 'curl'), curl, { mode: 0o755 });
    return spawnSync('bash', [SCRIPT, dir], { env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' });
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
}

test('downloads and unpacks the city database, then keeps it while current', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoip-'));
  try {
    const first = run(dir);
    assert.equal(first.status, 0);
    assert.match(first.stdout, /City database updated/);
    assert.equal(fs.statSync(path.join(dir, 'dbip-city-lite.mmdb')).size, 12_000_000);
    const second = run(dir, { fail: true });
    assert.match(second.stdout, /City database is current/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('never fails a deploy, and never saves an error page as the database', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoip-'));
  try {
    for (const options of [{ fail: true }, { size: 2_000 }]) {
      const result = run(dir, options);
      assert.equal(result.status, 0);
      assert.match(result.stderr, /City database not updated/);
      assert.equal(fs.existsSync(path.join(dir, 'dbip-city-lite.mmdb')), false);
    }
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stopped by the deploy timeout, it keeps the current copy and leaves no partial file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'geoip-'));
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'geoip-bin-'));
  try {
    const target = path.join(dir, 'dbip-city-lite.mmdb');
    fs.writeFileSync(target, 'current copy');
    fs.utimesSync(target, new Date('2026-01-01'), new Date('2026-01-01')); // old enough to refresh
    fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nsleep 30\n', { mode: 0o755 });
    const started = Date.now();
    const result = spawnSync('timeout', ['2', 'bash', SCRIPT, dir], { env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` }, encoding: 'utf8' });
    assert.ok(Date.now() - started < 10_000, 'the download did not stop with the timeout');
    assert.equal(fs.readFileSync(target, 'utf8'), 'current copy');
    assert.deepEqual(fs.readdirSync(dir), ['dbip-city-lite.mmdb']);
    assert.match(result.stderr, /keeping the current copy/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(bin, { recursive: true, force: true });
  }
});
