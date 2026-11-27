const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const SCRIPT = path.resolve(__dirname, 'preserve-uploads.sh');

/**
 * A stand-in `docker`: the "container" is a folder, so the script's save/restore logic can be
 * tested without a Docker daemon. FAKE_RUNNING and FAKE_VOLUME describe the container.
 */
function sandbox({ running = true, volume = false } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  const bin = path.join(root, 'bin');
  const uploads = path.join(root, 'container', 'app', 'uploads');
  const work = path.join(root, 'compose');
  mkdirSync(bin, { recursive: true });
  mkdirSync(uploads, { recursive: true });
  mkdirSync(work, { recursive: true });
  writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
set -e
cmd="$1"; shift
case "$cmd" in
  inspect)
    fmt="$2"
    if [[ "$fmt" == *State.Running* ]]; then echo "$FAKE_RUNNING"; else [ "$FAKE_VOLUME" = 1 ] && echo yes || echo; fi ;;
  exec)
    [ "$1" = "-u" ] && shift 2
    shift            # container name
    "$@" ;;
  cp)
    src="\${1#*:}"; dst="\${2#*:}"
    mkdir -p "$dst"; cp -a "$src" "$dst" ;;
esac
`);
  writeFileSync(path.join(bin, 'chown'), '#!/usr/bin/env bash\nexit 0\n');
  chmodSync(path.join(bin, 'docker'), 0o755);
  chmodSync(path.join(bin, 'chown'), 0o755);
  const run = (action, overrides = {}) => spawnSync('bash', [SCRIPT, action, 'ag-dashboard-backend'], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, UPLOADS_DIR: uploads, FAKE_RUNNING: String(running), FAKE_VOLUME: volume ? '1' : '0', ...overrides },
  });
  return { uploads, work, run };
}

test('the first deploy with a volume carries files from the old container into the new one', () => {
  const { uploads, work, run } = sandbox();
  mkdirSync(path.join(uploads, 'nested'), { recursive: true });
  writeFileSync(path.join(uploads, 'a.png'), 'photo-a');
  writeFileSync(path.join(uploads, 'nested', 'b.png'), 'photo-b');

  const saved = run('save');
  assert.equal(saved.status, 0, saved.stderr);
  assert.match(saved.stdout, /copied 2 file/);

  // The recreate: the new container's volume starts empty.
  execFileSync('rm', ['-rf', uploads]);
  mkdirSync(uploads, { recursive: true });

  const restored = run('restore');
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(readFileSync(path.join(uploads, 'a.png'), 'utf8'), 'photo-a');
  assert.equal(readFileSync(path.join(uploads, 'nested', 'b.png'), 'utf8'), 'photo-b');
  assert.equal(existsSync(path.join(uploads, '.restore')), false);
  const deployDir = path.join(work, '.deploy');
  assert.equal(existsSync(path.join(deployDir, 'uploads-pending')), false);
  assert.ok(readdirSync(deployDir).some(name => name.startsWith('uploads-restored-')), 'a backup copy is kept');
});

test('nothing is copied once uploads are already on a volume', () => {
  const { uploads, work, run } = sandbox({ volume: true });
  writeFileSync(path.join(uploads, 'a.png'), 'photo-a');
  const saved = run('save');
  assert.equal(saved.status, 0, saved.stderr);
  assert.match(saved.stdout, /already on a volume/);
  assert.equal(existsSync(path.join(work, '.deploy', 'uploads-pending')), false);
  assert.match(run('restore').stdout, /nothing waiting/);
});

test('restore never overwrites a file the volume already has', () => {
  const { uploads, work, run } = sandbox();
  writeFileSync(path.join(uploads, 'a.png'), 'old');
  assert.equal(run('save').status, 0);
  writeFileSync(path.join(uploads, 'a.png'), 'newer');
  const restored = run('restore');
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(readFileSync(path.join(uploads, 'a.png'), 'utf8'), 'newer');
  assert.ok(existsSync(path.join(work, '.deploy')));
});

test('a stopped backend leaves the saved copy for the next deploy', () => {
  const { uploads, work, run } = sandbox();
  writeFileSync(path.join(uploads, 'a.png'), 'photo-a');
  assert.equal(run('save').status, 0);
  const restored = run('restore', { FAKE_RUNNING: 'false' });
  assert.notEqual(restored.status, 0);
  assert.ok(existsSync(path.join(work, '.deploy', 'uploads-pending', 'a.png')), 'the copy is still there');
});
