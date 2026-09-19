#!/usr/bin/env node
/**
 * Deployment smoke probe — polls a health endpoint until it returns 2xx or the
 * deadline expires. Used by CI deploy verification so "deployed" means
 * "answering requests", not just "container is up".
 *
 * Usage: node scripts/smoke-probe.cjs <timeout-seconds> <url> [url...]
 */
const [timeoutArg = '60', ...urls] = process.argv.slice(2);
const timeoutSeconds = Number.parseInt(timeoutArg, 10);
if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || urls.length === 0) {
  console.error('Usage: node scripts/smoke-probe.cjs <timeout-seconds> <url> [url...]');
  process.exit(2);
}

const deadline = Date.now() + timeoutSeconds * 1000;
const INTERVAL_MS = 3000;

async function check(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return true;
    console.log(`  ${url} -> HTTP ${res.status}`);
  } catch (err) {
    console.log(`  ${url} -> ${err && err.cause ? err.cause.code || err.cause.message : err.message}`);
  }
  return false;
}

(async () => {
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const results = await Promise.all(urls.map(check));
    if (results.every(Boolean)) {
      console.log(`All health checks passed on attempt ${attempt}.`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  console.error(`Health checks did not pass within ${timeoutSeconds}s.`);
  process.exit(1);
})();
