import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every run starts from the same data: the real-world fixtures are deleted
 * (with every chat, visit, photo and progress record made against them by an
 * earlier run) and seeded again. Only rows on the reserved test domain and the
 * fixture tenant are touched. Set E2E_SKIP_RESEED=1 to keep the current data.
 *
 * A test system administrator (to grant service access) is then created with a
 * password generated for this run only; the tests read it from the environment.
 */
export default function globalSetup(): void {
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend');
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:7501/ag_extension',
  };
  if (process.env.E2E_SKIP_RESEED !== '1') {
    execFileSync('npm', ['run', 'seed:realworld', '--', '--reset'], { cwd: backendDir, stdio: 'inherit', env });
  }
  process.env.E2E_SYSTEM_ADMIN_PASSWORD = randomBytes(24).toString('base64url');
  execFileSync('npm', ['run', '-s', 'seed:e2e-system-admin'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...env, E2E_SYSTEM_ADMIN_PASSWORD: process.env.E2E_SYSTEM_ADMIN_PASSWORD },
  });
}
