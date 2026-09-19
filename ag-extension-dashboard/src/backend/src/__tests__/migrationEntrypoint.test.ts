import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

describe('container migration failures', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'ag-migration-test-'));
    writeFileSync(path.join(directory, 'npx'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$MIGRATION_TEST_LOG"\nif [ "$MIGRATION_TEST_ERROR" ]; then\n  printf "%s\\n" "$MIGRATION_TEST_ERROR"\n  exit 1\nfi\n', { mode: 0o755 });
    writeFileSync(path.join(directory, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function run(error: string) {
    return spawnSync('/bin/sh', [path.resolve(__dirname, '../../docker-entrypoint.sh'), '/bin/sh', '-c', 'printf APPLICATION_STARTED'], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, SKIP_MIGRATIONS: 'false', MIGRATION_TEST_ERROR: error, MIGRATION_TEST_LOG: path.join(directory, 'calls') },
    });
  }

  it.each(['P3005', 'P3009', 'P3018', 'relation already exists'])('stops on %s without resolving unapplied migrations', error => {
    const result = run(`${error}\nMigration name: 20260919_partial_change`);
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('APPLICATION_STARTED');
    expect(readFileSync(path.join(directory, 'calls'), 'utf8').trim()).toBe('prisma migrate deploy');
  });

  it('starts the application only after a successful deployment', () => {
    expect(run('').stdout).toContain('APPLICATION_STARTED');
  });

  it('bounds retries of other migration failures and refuses to start', () => {
    const result = run('P1001 Database unreachable');
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('APPLICATION_STARTED');
    expect(readFileSync(path.join(directory, 'calls'), 'utf8').trim().split('\n')).toHaveLength(10);
  });
});
