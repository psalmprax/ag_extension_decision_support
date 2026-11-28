const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const dashboard = path.resolve(__dirname, '../ag-extension-dashboard');

test('backend images upgrade inherited PCRE2, Perl, PAM and zstd in the shared base layer', () => {
  const dockerfile = readFileSync(path.join(dashboard, 'src/backend/Dockerfile'), 'utf8');
  const sharedBase = dockerfile.split(/^FROM node-base AS /m)[0];
  assert.match(sharedBase,
    /^RUN apt-get update && apt-get install -y --no-install-recommends libpcre2-8-0 perl-base libpam-modules libpam-modules-bin libpam-runtime libpam0g libzstd1 && rm -rf \/var\/lib\/apt\/lists\/\*$/m);
  for (const stage of ['deps', 'build', 'development', 'production']) {
    assert.match(dockerfile, new RegExp(`^FROM node-base AS ${stage}$`, 'm'));
  }
});

// The production override refuses to render without explicit datastore passwords.
const PROD_REQUIRED_ENV = {
  DATABASE_PASSWORD: 'compose-config-test-only-db',
  REDIS_PASSWORD: 'compose-config-test-only-redis',
};

function composeConfig(overrides, environment = {}, { withProdSecrets = true } = {}) {
  const files = ['docker-compose.yml', ...overrides];
  const prodEnv = withProdSecrets && overrides.includes('docker-compose.prod.yml') ? PROD_REQUIRED_ENV : {};
  const output = execFileSync('docker', [
    'compose', '--env-file', '/dev/null', '--project-name', 'ag-config-test',
    ...files.flatMap(file => ['-f', file]),
    'config', '--no-env-resolution', '--format', 'json',
  ], {
    cwd: dashboard,
    encoding: 'utf8',
    // Do not read deployment secrets or let a developer's .env mask bad defaults.
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ACME_EMAIL: 'compose-test@example.invalid',
      JWT_SECRET: 'compose-config-test-only-not-for-deployment',
      ...prodEnv,
      ...environment,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function assertDistinctPorts(services) {
  const bindings = [];
  for (const [service, config] of Object.entries(services)) {
    for (const port of config.ports || []) {
      if (!port.published) continue;
      const host = port.host_ip || '0.0.0.0';
      const conflict = bindings.find(binding =>
        binding.published === port.published && binding.protocol === port.protocol &&
        (binding.host === host || ['0.0.0.0', '::'].includes(binding.host) ||
          ['0.0.0.0', '::'].includes(host)));
      assert.equal(conflict, undefined, `${service} conflicts on port ${port.published}`);
      bindings.push({ service, host, published: port.published, protocol: port.protocol });
    }
  }
}

for (const [mode, overrides, frontendTarget] of [
  ['base', [], 5173],
  ['development', ['docker-compose.dev.yml'], 5173],
  ['staging', ['docker-compose.staging.yml'], 80],
  ['production', ['docker-compose.prod.yml'], 80],
]) {
  for (const withAgents of [false, true]) {
    test(`${mode}${withAgents ? ' with agents' : ''}: distinct ports and correct frontend listener`, () => {
      const files = withAgents ? [...overrides, 'docker-compose.agents.yml'] : overrides;
      const { services } = composeConfig(files);
      assertDistinctPorts(services);
      const frontend = services.frontend.ports.filter(port => port.published === '7503');
      assert.equal(frontend.length, 1);
      assert.equal(frontend[0].target, frontendTarget);
      assert.equal(frontend[0].host_ip, '127.0.0.1');
      assert.deepEqual(services['redis-queue'].ports.map(port => [port.host_ip, port.published, port.target]),
        [['127.0.0.1', '7507', 6379]]);
      assert.match(services.backend.environment.QUEUE_REDIS_URL, /@redis-queue:6379$/);
    });
  }
}

for (const missing of Object.keys(PROD_REQUIRED_ENV)) {
  test(`production: refuses to render without ${missing} (no development default)`, () => {
    const environment = { ...PROD_REQUIRED_ENV };
    delete environment[missing];
    assert.throws(
      () => composeConfig(['docker-compose.prod.yml'], environment, { withProdSecrets: false }),
      error => String(error.stderr).includes(`${missing} must be set`));
  });
}

test('production: datastore passwords come from the environment, never the dev defaults', () => {
  const { services } = composeConfig(['docker-compose.prod.yml']);
  assert.equal(services['app-db'].environment.POSTGRES_PASSWORD, PROD_REQUIRED_ENV.DATABASE_PASSWORD);
  assert.equal(services.redis.environment.REDIS_PASSWORD, PROD_REQUIRED_ENV.REDIS_PASSWORD);
  const rendered = JSON.stringify(services);
  assert.ok(!rendered.includes('agext_redis_2024'), 'default redis password leaked into prod config');
  assert.ok(!rendered.includes(':postgres@'), 'default postgres password leaked into prod config');
});

for (const mode of ['staging', 'prod']) {
  test(`${mode}: frontend and queue host ports remain configurable`, () => {
    const { services } = composeConfig([`docker-compose.${mode}.yml`], {
      FRONTEND_PORT: '17503', REDIS_QUEUE_PORT: '17507',
    });
    assertDistinctPorts(services);
    assert.equal(services.frontend.ports.length, 1);
    assert.equal(services.frontend.ports[0].published, '17503');
    assert.equal(services.frontend.ports[0].target, 80);
    assert.equal(services['redis-queue'].ports[0].published, '17507');
  });
}
