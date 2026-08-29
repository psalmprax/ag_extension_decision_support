#!/usr/bin/env node
/**
 * Prisma schema ↔ live database drift checker.
 *
 * Compares `prisma/schema.prisma` against the live PostgreSQL database using
 * `prisma migrate diff` and alerts when they diverge. Raw-SQL-only tables that
 * the Prisma schema intentionally does not manage (agent_memories, telegram
 * messages, support tickets, etc.) are allowlisted so they don't cause false
 * alarms; anything else that diverges is reported as drift.
 *
 * Exit codes:
 *   0  clean — schema and DB match (or only allowlisted raw tables differ)
 *   1  drift detected
 *   2  could not verify (DB unreachable, prisma error, usage error)
 *
 * Usage:
 *   node scripts/prisma-drift-check.cjs [--json] [--verbose]
 *
 * Env:
 *   DATABASE_URL              override the URL read from the backend .env
 *   PRISMA_DRIFT_ALLOW_TABLES comma-separated extra tables to allowlist
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SCRIPT_DIR = __dirname;
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'ag-extension-dashboard', 'src', 'backend');
const SCHEMA_PATH = path.join(BACKEND_DIR, 'prisma', 'schema.prisma');
const ENV_PATH = path.join(BACKEND_DIR, '.env');

// Tables created and owned by raw SQL (createTables / service initializers /
// migrations/*.sql) that the Prisma schema intentionally does not manage.
const DEFAULT_ALLOW_TABLES = new Set([
  'agent_tasks',
  'tenant_channel_configs',
  'telegram_messages',
  'farmer_onboarding_sessions',
  'autonomous_campaign_runs',
  'regional_agronomy_skills',
  'agent_memories',
  'agent_telemetry',
  'email_templates',
  'email_approvals',
  'support_tickets',
  'scheduled_notifications',
]);

const MARKER_RE = /^-- ([A-Za-z]+)$/;

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    result[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return result;
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = parseEnvFile(ENV_PATH);
  if (env.DATABASE_URL) return env.DATABASE_URL;
  return null;
}

function loadAllowTables() {
  const extra = process.env.PRISMA_DRIFT_ALLOW_TABLES;
  if (!extra) return DEFAULT_ALLOW_TABLES;
  return new Set([...DEFAULT_ALLOW_TABLES, ...extra.split(',').map(s => s.trim()).filter(Boolean)]);
}

/**
 * Split the diff script into { marker, sql } statements. Prisma emits a
 * `-- Marker` comment line before each SQL statement; statements may span
 * multiple lines and always end with a semicolon.
 */
function parseDiffScript(output) {
  const statements = [];
  const lines = output.split('\n');
  let currentMarker = null;
  let currentSql = [];

  const flush = () => {
    const sql = currentSql.join(' ').replace(/\s+/g, ' ').trim();
    if (currentMarker && sql) statements.push({ marker: currentMarker, sql });
    currentSql = [];
  };

  for (const line of lines) {
    const markerMatch = line.match(MARKER_RE);
    if (markerMatch) {
      flush();
      currentMarker = markerMatch[1];
      continue;
    }
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('--')) currentSql.push(trimmed);
  }
  flush();
  return statements;
}

function extractTableName(sql) {
  // CREATE TABLE "name" / DROP TABLE "name" / ALTER TABLE "name" ...
  const tableMatch = sql.match(/(?:CREATE|DROP)\s+TABLE\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/);
  if (tableMatch) return tableMatch[1];
  const alterMatch = sql.match(/ALTER\s+TABLE\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/);
  if (alterMatch) return alterMatch[1];
  return null;
}

function extractIndexTableName(sql) {
  // CREATE INDEX "name" ON "table" / DROP INDEX "name" (no table reference)
  const onMatch = sql.match(/ON\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/);
  if (onMatch) return onMatch[1];
  const nameMatch = sql.match(/"(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*?)(?:_[a-z]+)+"/);
  if (nameMatch) return nameMatch[1];
  return null;
}

/**
 * Classify one statement. Returns 'expected' when the divergence is limited to
 * allowlisted raw-SQL tables, 'drift' when the schema and DB genuinely differ.
 */
function classifyStatement(statement, allowTables) {
  const { marker, sql } = statement;

  // Things the DB has that the schema lacks.
  if (marker === 'DropTable') {
    const table = extractTableName(sql);
    return allowTables.has(table) ? 'expected' : 'drift';
  }
  if (marker === 'DropIndex') {
    const table = extractIndexTableName(sql);
    return allowTables.has(table) ? 'expected' : 'drift';
  }
  if (marker === 'DropForeignKey' || marker === 'DropColumn' || marker === 'DropConstraint') {
    const table = extractTableName(sql);
    return allowTables.has(table) ? 'expected' : 'drift';
  }
  if (marker === 'DropEnum') return 'drift';

  // Everything else — the schema is ahead of the DB (CreateTable, AlterTable
  // ADD, CreateIndex, AddForeignKey, CreateEnum, ...) — is genuine drift.
  return 'drift';
}

function runPrismaDiff(dbUrl, verbose) {
  const args = [
    'prisma',
    'migrate',
    'diff',
    '--from-url',
    dbUrl,
    '--to-schema-datamodel',
    SCHEMA_PATH,
    '--script',
  ];
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.error) {
    return { ok: false, error: `Unable to run prisma: ${result.error.message}` };
  }
  if (result.status !== 0) {
    const unreachable = /P1001|Can't reach database|ECONNREFUSED/i.test(output);
    return { ok: false, error: unreachable ? 'Database unreachable' : `prisma migrate diff failed (exit ${result.status})` };
  }

  if (verbose) process.stderr.write(output);
  return { ok: true, output };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const verbose = args.includes('--verbose');

  if (!fs.existsSync(SCHEMA_PATH)) {
    const msg = `Schema not found at ${SCHEMA_PATH}. Run this script from the repository root.`;
    if (json) console.log(JSON.stringify({ ok: false, status: 'error', message: msg }));
    else console.error(`❌ ${msg}`);
    process.exit(2);
  }

  const dbUrl = loadDatabaseUrl();
  if (!dbUrl) {
    const msg = 'DATABASE_URL not found in environment or backend .env';
    if (json) console.log(JSON.stringify({ ok: false, status: 'error', message: msg }));
    else console.error(`❌ ${msg}`);
    process.exit(2);
  }

  const allowTables = loadAllowTables();
  const diff = runPrismaDiff(dbUrl, verbose);
  if (!diff.ok) {
    if (json) console.log(JSON.stringify({ ok: false, status: 'error', message: diff.error }));
    else console.error(`❌ Drift check could not verify: ${diff.error}`);
    process.exit(2);
  }

  const statements = parseDiffScript(diff.output);
  const classified = statements.map(stmt => ({ ...stmt, verdict: classifyStatement(stmt, allowTables) }));
  const drift = classified.filter(s => s.verdict === 'drift');
  const expected = classified.filter(s => s.verdict === 'expected');

  if (json) {
    console.log(JSON.stringify({
      ok: drift.length === 0,
      status: drift.length === 0 ? 'clean' : 'drift',
      drift: drift.map(s => ({ marker: s.marker, sql: s.sql })),
      allowlisted: expected.map(s => ({ marker: s.marker, sql: s.sql })),
    }, null, 2));
    process.exit(drift.length === 0 ? 0 : 1);
  }

  if (drift.length === 0 && expected.length === 0) {
    console.log('✅ Prisma schema and live database are in sync.');
    process.exit(0);
  }
  if (drift.length === 0) {
    console.log(`✅ No schema drift. ${expected.length} allowlisted raw-SQL table(s) differ (expected).`);
    if (verbose) {
      for (const s of expected) console.log(`   [allowlisted] ${s.marker}: ${s.sql}`);
    }
    process.exit(0);
  }

  console.error(`❌ DRIFT DETECTED between prisma/schema.prisma and the live database (${drift.length} statement(s)):`);
  for (const s of drift) {
    console.error(`   [${s.marker}] ${s.sql}`);
  }
  if (expected.length > 0) {
    console.error(`   (${expected.length} allowlisted raw-SQL table statement(s) ignored — expected)`);
  }
  console.error('\nRun `npx prisma migrate dev` (or apply the generated SQL) to reconcile, then re-run this check.');
  process.exit(1);
}

main();
