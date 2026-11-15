// Tests for scripts/free-web-ports.sh: the real script runs against stubbed
// docker / ss / systemctl / pkill / sleep binaries placed first on PATH.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const SCRIPT = path.join(__dirname, 'free-web-ports.sh');

const STUBS = {
  docker: `#!/bin/sh
echo "docker $*" >> "$STUB_DIR/calls"
case "$*" in
  "rm -f "*) exit 0 ;;
  "ps -aq --filter label=com.docker.compose.project="*"--filter publish=80") cat "$STUB_DIR/own_80" 2>/dev/null ;;
  "ps -aq --filter label=com.docker.compose.project="*"--filter publish=443") cat "$STUB_DIR/own_443" 2>/dev/null ;;
  "ps --filter publish=80 "*) cat "$STUB_DIR/pub_80" 2>/dev/null ;;
  "ps --filter publish=443 "*) cat "$STUB_DIR/pub_443" 2>/dev/null ;;
esac
exit 0
`,
  ss: `#!/bin/sh
cat "$STUB_DIR/ss" 2>/dev/null
exit 0
`,
  systemctl: `#!/bin/sh
echo "systemctl $*" >> "$STUB_DIR/calls"
if [ "$1" = "is-active" ]; then [ -f "$STUB_DIR/active_$3" ]; exit $?; fi
[ "$1" = "stop" ] && rm -f "$STUB_DIR/active_$2"
exit 0
`,
  pkill: `#!/bin/sh
echo "pkill $*" >> "$STUB_DIR/calls"
[ -f "$STUB_DIR/pkill_frees" ] && rm -f "$STUB_DIR/ss"
exit 0
`,
  sleep: '#!/bin/sh\nexit 0\n',
  id: `#!/bin/sh
[ "$1" = "-u" ] && { cat "$STUB_DIR/uid" 2>/dev/null || echo 0; exit 0; }
exit 0
`,
  sudo: `#!/bin/sh
echo "sudo $*" >> "$STUB_DIR/calls"
[ "$1" = "-n" ] && shift
exec "$@"
`,
};

const PROXY_LINE = 'LISTEN 0 4096 0.0.0.0:80 0.0.0.0:* users:(("docker-proxy",pid=4242,fd=4))\n';
const CADDY_LINE = 'LISTEN 0 4096 0.0.0.0:80 0.0.0.0:* users:(("caddy",pid=77,fd=3))\n';

function run(state = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fwp-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  for (const [name, body] of Object.entries(STUBS)) {
    fs.writeFileSync(path.join(bin, name), body, { mode: 0o755 });
  }
  for (const [file, content] of Object.entries(state)) fs.writeFileSync(path.join(dir, file), content);
  const res = spawnSync('bash', [SCRIPT, 'ag-extension-dashboard'], {
    encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin`, STUB_DIR: dir },
  });
  const calls = fs.existsSync(path.join(dir, 'calls')) ? fs.readFileSync(path.join(dir, 'calls'), 'utf8') : '';
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: res.status, out: res.stdout + res.stderr, calls };
}

test('free ports: removes our traefik, kills nothing', () => {
  const r = run();
  assert.equal(r.status, 0, r.out);
  assert.match(r.calls, /docker rm -f ag-traefik/);
  assert.doesNotMatch(r.calls, /pkill/);
});

test("removes this project's own containers publishing 80/443 (by compose label)", () => {
  const r = run({ own_443: 'abc123\n' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.calls, /ps -aq --filter label=com\.docker\.compose\.project=ag-extension-dashboard --filter publish=443/);
  assert.match(r.calls, /docker rm -f abc123/);
});

test("never removes another project's container; fails and names it", () => {
  const r = run({ ss: PROXY_LINE, pub_80: 'ettametta-proxy (project: ettametta)\n' });
  assert.equal(r.status, 1);
  assert.match(r.out, /do not belong to 'ag-extension-dashboard'/);
  assert.match(r.out, /ettametta-proxy \(project: ettametta\)/);
  assert.doesNotMatch(r.calls, /docker rm -f ettametta/);
  assert.doesNotMatch(r.calls, /pkill/);
});

test('kills an orphaned docker-proxy when no container publishes the port', () => {
  const r = run({ ss: PROXY_LINE, pkill_frees: '' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /orphaned docker-proxy/);
  assert.match(r.calls, /pkill -f docker-proxy/);
  assert.doesNotMatch(r.calls, /pkill -9/);
});

test('escalates to SIGKILL for a stuck orphan proxy, then fails if it survives', () => {
  const r = run({ ss: PROXY_LINE });
  assert.equal(r.status, 1);
  assert.match(r.calls, /pkill -9 -f docker-proxy/);
  assert.match(r.out, /still held by a process this deploy does not own/);
});

test('never kills a non-docker process holding the port; fails with the holder', () => {
  const r = run({ ss: CADDY_LINE });
  assert.equal(r.status, 1);
  assert.match(r.out, /caddy/);
  assert.doesNotMatch(r.calls, /pkill/);
});

test('stops and disables an active host nginx, leaves inactive apache2 alone', () => {
  const r = run({ active_nginx: '' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.calls, /systemctl stop nginx/);
  assert.match(r.calls, /systemctl disable nginx/);
  assert.doesNotMatch(r.calls, /systemctl stop apache2/);
});

test('as a non-root deploy user, stops host services through sudo -n', () => {
  const r = run({ uid: '1001\n', active_apache2: '' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.calls, /sudo -n systemctl stop apache2/);
  assert.match(r.calls, /sudo -n systemctl disable apache2/);
});

test('as root, never invokes sudo', () => {
  const r = run({ active_apache2: '' });
  assert.equal(r.status, 0, r.out);
  assert.doesNotMatch(r.calls, /sudo/);
  assert.match(r.calls, /systemctl stop apache2/);
});
