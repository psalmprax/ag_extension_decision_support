'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'ensure-vapid-keys.sh');
const PUBLIC = `B${'a'.repeat(86)}`;
const PRIVATE = 'p'.repeat(43);

/**
 * Runs the script against a .env with stand-in key tools: `python3` prints `pythonOutput`
 * (or has no cryptography package when null) and `npx` prints `npxOutput`.
 */
function run(envText, { pythonOutput = `${PUBLIC} ${PRIVATE}`, npxOutput = '' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vapid-'));
  try {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    const python = pythonOutput === null
      ? '#!/bin/sh\nexit 1\n'
      : `#!/bin/sh\n[ "$1" = "-c" ] && exit 0\ncat >/dev/null\necho '${pythonOutput}'\n`;
    fs.writeFileSync(path.join(bin, 'python3'), python, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'npx'), `#!/bin/sh\necho '${npxOutput}'\n`, { mode: 0o755 });
    const envFile = path.join(dir, '.env');
    fs.writeFileSync(envFile, envText, { mode: 0o600 });
    const result = spawnSync('bash', [SCRIPT, envFile], {
      env: { ...process.env, PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin` },
      encoding: 'utf8',
    });
    return { status: result.status, stderr: result.stderr, env: fs.readFileSync(envFile, 'utf8') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('generates keys when the public key is missing, empty or an empty quoted string', () => {
  for (const line of ['', 'VAPID_PUBLIC_KEY=\n', 'VAPID_PUBLIC_KEY=""\n', "VAPID_PUBLIC_KEY=  ''  \n"]) {
    const { status, env } = run(`JWT_SECRET=x\n${line}VAPID_PRIVATE_KEY=\n`);
    assert.equal(status, 0, line);
    assert.match(env, new RegExp(`^VAPID_PUBLIC_KEY=${PUBLIC}$`, 'm'));
    assert.match(env, new RegExp(`^VAPID_PRIVATE_KEY=${PRIVATE}$`, 'm'));
    assert.equal(env.match(/^VAPID_PUBLIC_KEY=/gm).length, 1);
    assert.match(env, /^JWT_SECRET=x$/m);
  }
});

test('keeps an existing key, including one with spaces after the equals sign or in quotes', () => {
  for (const line of [`VAPID_PUBLIC_KEY=${PUBLIC}`, `VAPID_PUBLIC_KEY= ${PUBLIC}`, `VAPID_PUBLIC_KEY="${PUBLIC}"`]) {
    const original = `${line}\nVAPID_PRIVATE_KEY=${PRIVATE}\n`;
    const { status, env } = run(original, { pythonOutput: 'x y' });
    assert.equal(status, 0);
    assert.equal(env, original);
  }
});

test('uses web-push --json when Python has no cryptography package', () => {
  const { status, env } = run('VAPID_PUBLIC_KEY=\n', {
    pythonOutput: null,
    npxOutput: JSON.stringify({ publicKey: PUBLIC, privateKey: PRIVATE }),
  });
  assert.equal(status, 0);
  assert.match(env, new RegExp(`^VAPID_PUBLIC_KEY=${PUBLIC}$`, 'm'));
});

test('never saves output that is not a valid key pair, and fails the deploy instead', () => {
  const original = 'VAPID_PUBLIC_KEY=\n';
  const { status, stderr, env } = run(original, {
    pythonOutput: 'Public Key: short',
    npxOutput: '=======================================\nPublic Key:\nnot-json',
  });
  assert.equal(status, 1);
  assert.match(stderr, /Unable to generate valid VAPID keys/);
  assert.equal(env, original);
});
