#!/usr/bin/env node
/**
 * Migration replay gate: proves every Prisma migration applies cleanly to a
 * fresh database, then proves the result matches the Prisma schema.
 *
 * Catches the exact class of bug found in 2026-09 validation:
 *   - migrations that only work after `prisma db push` has silently created
 *     missing tables/columns/constraints (schema <-> migration drift)
 *   - invalid SQL in hand-written migrations (uuid ~~ unknown, bad aliases)
 *
 * The drift step is TIERED:
 *   structural drift  -> hard failure (missing/extra tables, columns, FKs,
 *                        nullability, type-kind changes)
 *   cosmetic drift    -> warning (FK ON UPDATE CASCADE convention, index
 *                        renames/adds, equivalent type/precision deltas)
 *
 * Raw-SQL tables that schema.prisma intentionally does not manage are
 * allowlisted (same set as scripts/prisma-drift-check.cjs).
 *
 * Exit codes: 0 clean, 1 failure (replay or structural drift), 2 usage/prisma error.
 *
 * Usage:
 *   node scripts/prisma-migration-replay-check.cjs [--keep-db]
 *
 * Env:
 *   MIGRATION_CHECK_DATABASE_URL  postgres URL of a DISPOSABLE database.
 *                                 WARNING: the script runs `migrate reset` on
 *                                 it. Never point this at a real environment.
 *                                 Default: postgres://migration_gate:gate@localhost:5432/migration_gate
 *   MIGRATION_CHECK_SKIP_RESET=1  skip the initial reset (faster when the DB
 *                                 is known empty, e.g. a fresh CI service)
 *   MIGRATION_CHECK_STRICT=1      also fail on cosmetic drift
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const BACKEND_DIR = path.join(__dirname, '..', 'ag-extension-dashboard', 'src', 'backend');
const KEEP_DB = process.argv.includes('--keep-db');
const STRICT = process.env.MIGRATION_CHECK_STRICT === '1';
const DB_URL = process.env.MIGRATION_CHECK_DATABASE_URL
  || 'postgres://migration_gate:gate@localhost:5432/migration_gate';

// Raw-SQL tables schema.prisma intentionally does not manage.
const ALLOW_TABLES = new Set([
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
const TYPE_RE = '[A-Z]+(?:\\(\\d+(?:,\\d+)?\\))?(?:\\[\\])?';

function run(cmd, args) {
  const bin = process.platform === 'win32' && cmd === 'npx' ? 'npx.cmd' : cmd;
  const result = spawnSync(bin, args, {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: DB_URL },
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function step(name, fn) {
  process.stdout.write(`▶ ${name}... `);
  const outcome = fn();
  if (outcome.ok) {
    console.log('OK');
    return outcome;
  }
  console.log('FAILED\n');
  console.error(outcome.detail);
  console.error(`\n❌ Migration replay gate failed at: ${name}`);
  process.exit(outcome.exitCode ?? 1);
}

// ---------------------------------------------------------------------------
// Diff-script parsing (Prisma emits a `-- Marker` comment before each statement)
// ---------------------------------------------------------------------------

function parseDiffScript(output) {
  const statements = [];
  let currentMarker = null;
  let currentSql = [];

  const flush = () => {
    const sql = currentSql.join('\n').trim();
    if (currentMarker && sql) statements.push({ marker: currentMarker, sql });
    currentSql = [];
  };

  for (const line of output.split('\n')) {
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

// Matches the object name after CREATE/DROP/ALTER TABLE, tolerating an
// optional schema qualifier ("public"."name" / public.name / "name" / name).
// The qualifier alternative REQUIRES a trailing dot, so unqualified names are
// captured intact.
const QUALIFIED_NAME_RE = '(?:"?[a-zA-Z_][a-zA-Z0-9_]*"?\\s*\\.\\s*)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?';

function extractTableName(sql) {
  const m = sql.match(new RegExp(`(?:CREATE|DROP|ALTER)\\s+TABLE\\s+${QUALIFIED_NAME_RE}`));
  return m ? m[1] : null;
}

function extractConstraintName(sql) {
  const m = sql.match(/(?:ADD|DROP)\s+CONSTRAINT\s+"([a-zA-Z_][a-zA-Z0-9_]*)"/);
  return m ? m[1] : null;
}

function normCols(s) {
  return s.split(',').map(c => c.replace(/"/g, '').trim()).sort().join(',');
}

function parseRefRules(s) {
  const onDelete = (s.match(/ON DELETE (SET NULL|SET DEFAULT|NO ACTION|CASCADE|RESTRICT)/i) || [])[1];
  const onUpdate = (s.match(/ON UPDATE (SET NULL|SET DEFAULT|NO ACTION|CASCADE|RESTRICT)/i) || [])[1];
  return {
    onDelete: onDelete ? onDelete.toUpperCase() : 'NO ACTION',
    onUpdate: onUpdate ? onUpdate.toUpperCase() : 'NO ACTION',
  };
}

function parseAddFkStatement(sql) {
  const m = sql.match(new RegExp(`ADD\\s+CONSTRAINT\\s+"([a-zA-Z_][a-zA-Z0-9_]*)"\\s+FOREIGN KEY\\s*\\(([^)]*)\\)\\s+REFERENCES\\s+${QUALIFIED_NAME_RE}\\s*\\(([^)]*)\\)(.*)$`));
  if (!m) return null;
  return {
    name: m[1],
    columns: normCols(m[2]),
    refTable: m[3],
    refColumns: normCols(m[4]),
    ...parseRefRules(m[5]),
  };
}

/** Normalize types that PostgreSQL treats as equivalent for comparison. */
function normalizeType(type) {
  return type
    .replace(/^(?:VAR)?CHAR\(\d+\)/, 'TEXT')
    .replace(/^TIMESTAMPTZ\(\d+\)/, 'TIMESTAMPTZ')
    .replace(/^TIMESTAMP\(\d+\)/, 'TIMESTAMP');
}

/**
 * Extract the live DB's column types and FK definitions from the RAW reverse
 * diff script (empty -> DB). Works line-by-line so it is insensitive to how
 * statements are grouped: column defs come from CREATE TABLE bodies (which
 * use fully-qualified "public"."name" there), FKs from ADD CONSTRAINT lines.
 */
function buildDbContextFromScript(output) {
  const columns = new Map(); // "table.column" -> normalized type
  const fks = new Map(); // constraint name -> { table, columns, refTable, refColumns, onDelete, onUpdate }

  let currentTable = null;
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    const createMatch = line.match(new RegExp(`CREATE TABLE\\s+${QUALIFIED_NAME_RE}`));
    if (createMatch) {
      currentTable = createMatch[1];
      continue;
    }
    if (currentTable) {
      if (/^\);?$/.test(line)) {
        currentTable = null;
        continue;
      }
      const col = line.match(new RegExp(`^"([a-zA-Z_][a-zA-Z0-9_]*)"\\s+(${TYPE_RE})\\b`));
      if (col) columns.set(`${currentTable}.${col[1]}`, normalizeType(col[2]));
    }
    const fk = line.match(new RegExp(`ALTER TABLE\\s+${QUALIFIED_NAME_RE}\\s+ADD CONSTRAINT\\s+"([a-zA-Z_][a-zA-Z0-9_]*)"\\s+FOREIGN KEY\\s*\\(([^)]*)\\)\\s+REFERENCES\\s+${QUALIFIED_NAME_RE}\\s*\\(([^)]*)\\)\\s*([^;]*)`));
    if (fk) {
      fks.set(fk[2], {
        table: fk[1],
        columns: normCols(fk[3]),
        refTable: fk[4],
        refColumns: normCols(fk[5]),
        ...parseRefRules(fk[6]),
      });
    }
  }
  return { columns, fks };
}

// ---------------------------------------------------------------------------
// Structural vs cosmetic classification of the forward diff (DB -> schema)
// ---------------------------------------------------------------------------

function classifyAlterTable(sql, table, db) {
  if (/ADD COLUMN|DROP COLUMN/i.test(sql)) return 'structural';
  const clauses = sql.split(/(?=ALTER COLUMN)/g).slice(1);
  if (clauses.length === 0) return 'structural';
  for (const clause of clauses) {
    const set = clause.match(new RegExp(`ALTER COLUMN\\s+"([a-zA-Z_][a-zA-Z0-9_]*)"\\s+SET DATA TYPE\\s+(${TYPE_RE})`));
    if (!set) return 'structural'; // SET/DROP NOT NULL, SET/DROP DEFAULT, ...
    const dbType = db.columns.get(`${table}.${set[1]}`);
    if (!dbType || normalizeType(set[2]) !== dbType) return 'structural';
  }
  return 'cosmetic';
}

/**
 * Classify the forward diff (DB -> schema). Constraint handling is set-based,
 * not pair-based: a DropForeignKey/AddForeignKey pair is the rendering of a
 * recreate caused by a name or attribute delta, so each statement is judged
 * by comparing the constraint's shape (table+columns+ref+ON DELETE) between
 * the DB and the schema — an ON UPDATE CASCADE-only delta is the repo's
 * documented cosmetic convention.
 *
 * Returns the statements annotated with verdict:
 * 'structural' | 'cosmetic' | 'allowlisted'
 */
function classifyForwardDiff(statements, db) {
  const verdicts = new Map();

  // Schema-intended FKs (forward diff AddForeignKey statements).
  const schemaFks = new Map(); // statement -> fk def | null
  for (const s of statements) {
    if (s.marker !== 'AddForeignKey') continue;
    const table = extractTableName(s.sql);
    if (table && ALLOW_TABLES.has(table)) { verdicts.set(s, 'allowlisted'); continue; }
    schemaFks.set(s, parseAddFkStatement(s.sql));
  }
  const shapeOf = fk => fk && `${fk.table}|${fk.columns}|${fk.refTable}|${fk.refColumns}`;
  const schemaShapes = new Set(
    [...schemaFks.values()].filter(Boolean).map(shapeOf),
  );

  for (const s of statements) {
    if (verdicts.has(s)) continue;
    const table = extractTableName(s.sql);
    if (table && ALLOW_TABLES.has(table)) { verdicts.set(s, 'allowlisted'); continue; }

    switch (s.marker) {
      case 'AddForeignKey': {
        const fk = schemaFks.get(s);
        if (!fk) { verdicts.set(s, 'structural'); break; }
        // The DB FK this add replaces: same name, else same shape (rename).
        const dbFk = db.fks.get(fk.name)
          ?? [...db.fks.values()].find(d => shapeOf(d) === shapeOf(fk));
        if (!dbFk) {
          // Declared in the schema but no migration ever created it -> drift.
          verdicts.set(s, 'structural');
          break;
        }
        const semanticMatch = dbFk.columns === fk.columns
          && dbFk.refTable === fk.refTable
          && dbFk.refColumns === fk.refColumns
          && dbFk.onDelete === fk.onDelete;
        verdicts.set(s,
          semanticMatch && fk.onUpdate === 'CASCADE' && dbFk.onUpdate !== 'CASCADE'
            ? 'cosmetic'
            : 'structural');
        break;
      }
      case 'DropForeignKey': {
        // Structural only if the FK genuinely disappears (no schema FK of the
        // same shape survives the drop); otherwise part of a recreate.
        const name = extractConstraintName(s.sql);
        const dbFk = name ? db.fks.get(name) : null;
        verdicts.set(s, dbFk && schemaShapes.has(shapeOf(dbFk)) ? 'cosmetic' : 'structural');
        break;
      }
      // Indexes never block deploys or corrupt data.
      case 'RenameIndex':
      case 'CreateIndex':
      case 'DropIndex':
        verdicts.set(s, 'cosmetic');
        break;
      case 'AlterTable':
        verdicts.set(s, classifyAlterTable(s.sql, table, db));
        break;
      default:
        // CreateTable, DropTable, DropColumn, DropConstraint, enums, ... —
        // all deploy-shape-relevant.
        verdicts.set(s, 'structural');
        break;
    }
  }

  return statements.map(s => ({ ...s, verdict: verdicts.get(s) ?? 'structural' }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!process.env.MIGRATION_CHECK_DATABASE_URL) {
    console.log('ℹ MIGRATION_CHECK_DATABASE_URL not set; using the default disposable URL:');
    console.log(`    ${DB_URL}`);
    console.log('  (a local postgres must be listening there — CI provides one as a service)');
  }

  step('prisma CLI available', () => {
    const r = run('npx', ['prisma', '--version']);
    return r.status === 0 ? { ok: true } : { ok: false, detail: r.output, exitCode: 2 };
  });

  if (process.env.MIGRATION_CHECK_SKIP_RESET !== '1') {
    step('reset disposable database (wipe everything)', () => {
      const r = run('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed']);
      return r.status === 0 ? { ok: true } : { ok: false, detail: r.output };
    });
  }

  step('replay all migrations from empty (prisma migrate deploy)', () => {
    const r = run('npx', ['prisma', 'migrate', 'deploy']);
    return r.status === 0 ? { ok: true } : { ok: false, detail: r.output };
  });

  step('replayed schema vs prisma/schema.prisma (migrate diff)', () => {
    const fwd = run('npx', [
      'prisma', 'migrate', 'diff',
      '--from-url', DB_URL,
      '--to-schema-datamodel', 'prisma/schema.prisma',
      '--script',
    ]);
    if (fwd.status !== 0) {
      return { ok: false, detail: fwd.output || 'prisma migrate diff failed', exitCode: 2 };
    }

    // Reverse diff (empty -> DB) provides the live DB's actual column types
    // and FK attributes (inline in CreateTable bodies) so equivalent deltas
    // can be told apart from real ones.
    const rev = run('npx', [
      'prisma', 'migrate', 'diff',
      '--from-empty',
      '--to-url', DB_URL,
      '--script',
    ]);
    if (rev.status !== 0) {
      return { ok: false, detail: rev.output || 'reverse prisma migrate diff failed', exitCode: 2 };
    }

    const db = buildDbContextFromScript(rev.output);
    const classified = classifyForwardDiff(parseDiffScript(fwd.output), db);

    const structural = classified.filter(s => s.verdict === 'structural');
    const cosmetic = classified.filter(s => s.verdict === 'cosmetic');
    const allowlisted = classified.filter(s => s.verdict === 'allowlisted');

    if (structural.length > 0) {
      return {
        ok: false,
        detail:
          'STRUCTURAL DRIFT: the database built purely from prisma/migrations does not\n' +
          'match schema.prisma. Missing/extra tables, columns, constraints, nullability\n' +
          'or type-kind deltas below — create a catch-up migration (never rely on db push):\n\n' +
          structural.map(s => `  [${s.marker}] ${s.sql.replace(/\n/g, ' ')}`).join('\n') +
          (cosmetic.length > 0
            ? `\n\n(${cosmetic.length} cosmetic statement(s) also present — see warnings below)`
            : ''),
      };
    }

    if (cosmetic.length > 0 && STRICT) {
      return {
        ok: false,
        detail:
          'COSMETIC DRIFT (MIGRATION_CHECK_STRICT=1): the replayed schema differs from\n' +
          'schema.prisma only in non-structural ways (FK ON UPDATE rules, index names,\n' +
          'equivalent type deltas). Align them with a catch-up migration:\n\n' +
          cosmetic.map(s => `  [${s.marker}] ${s.sql.replace(/\n/g, ' ')}`).join('\n'),
      };
    }

    console.log('');
    if (cosmetic.length > 0) {
      console.warn(`⚠ Cosmetic drift only (${cosmetic.length} statement(s), non-blocking):`);
      for (const s of cosmetic) console.warn(`   [${s.marker}] ${s.sql.replace(/\n/g, ' ')}`);
    }
    if (allowlisted.length > 0) {
      console.log(`ℹ ${allowlisted.length} allowlisted raw-SQL table statement(s) ignored (expected).`);
    }
    return { ok: true };
  });

  console.log('\n✅ Migration replay gate passed: every migration applies cleanly from empty and the result matches schema.prisma.');
  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ Unexpected error: ${error && error.stack ? error.stack : error}`);
    process.exit(2);
  } finally {
    if (KEEP_DB) {
      console.log(`--keep-db set; disposable database left running at ${DB_URL} for inspection.`);
    }
  }
}

module.exports = {
  parseDiffScript,
  buildDbContextFromScript,
  classifyForwardDiff,
  normalizeType,
  ALLOW_TABLES,
};
