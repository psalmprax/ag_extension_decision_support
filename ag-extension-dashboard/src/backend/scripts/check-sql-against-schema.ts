/**
 * Every raw SQL statement in the backend, checked by Postgres itself against the
 * migrated schema. Mocked unit tests cannot see a query that names a column the
 * database does not have; this can.
 *
 * Each string or template literal that starts with a SQL verb is prepared (never run)
 * inside a transaction that is rolled back. Interpolated fragments are filled with a
 * few neutral stand-ins until one parses; a statement that never parses is skipped,
 * because its shape depends on runtime code. Only "no such column", "no such table" and
 * "no such function" answers fail the check, so it reports real mismatches only.
 *
 * Usage: DATABASE_URL=... npx ts-node --transpile-only scripts/check-sql-against-schema.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Client } from 'pg';

const SRC = path.resolve(__dirname, '../src');
const VERB = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;
/** A statement, not prose that happens to start with "Select": each verb needs its clause. */
const SHAPE: Record<string, RegExp> = {
  select: /\bFROM\b/i, insert: /\bINTO\b/i, update: /\bSET\b/i, delete: /\bFROM\b/i, with: /\bAS\s*\(/i,
};
/** A stand-in that landed where a name belongs (`cv.${column}`) is the check's doing, not the code's. */
const STAND_IN_NAME = /column "?(?:\w+\.)?(?:null|x)"? does not exist/i;
const MISMATCH = new Set(['42703', '42P01', '42883']);
const STAND_INS = ['', 'NULL', '1', "'x'"];

interface Statement { file: string; line: number; parts: string[] }

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.includes('.test.') ? [full] : [];
  });
}

/** The literal text of each SQL statement, split around its ${...} holes. */
function statementsIn(file: string): Statement[] {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: Statement[] = [];
  const visit = (node: ts.Node) => {
    let parts: string[] | null = null;
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) parts = [node.text];
    else if (ts.isTemplateExpression(node)) parts = [node.head.text, ...node.templateSpans.map(span => span.literal.text)];
    const verb = parts ? VERB.exec(parts[0])?.[1]?.toLowerCase() : undefined;
    if (parts && verb && SHAPE[verb].test(parts.join(' '))) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push({ file: path.relative(path.resolve(SRC, '..'), file), line, parts });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Fills every hole with one stand-in, so a statement either parses or is skipped. */
const fill = (parts: string[], standIn: string) => parts.join(` ${standIn} `);

type Outcome = { kind: 'ok' } | { kind: 'skipped' } | { kind: 'mismatch'; message: string };

async function check(client: Client, statement: Statement): Promise<Outcome> {
  for (const standIn of STAND_INS) {
    const sql = fill(statement.parts, standIn);
    await client.query('BEGIN');
    try {
      await client.query({ name: '', text: `PREPARE sql_check AS ${sql}` });
      return { kind: 'ok' };
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      // A missing function can come from a stand-in's type, so only a hole-free
      // statement is held to it.
      const holeFree = statement.parts.length === 1;
      const message = (error as Error).message;
      if (MISMATCH.has(code) && (code !== '42883' || holeFree) && !STAND_IN_NAME.test(message)) return { kind: 'mismatch', message };
    } finally {
      await client.query('ROLLBACK');
      await client.query('DEALLOCATE ALL');
    }
  }
  return { kind: 'skipped' };
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const statements = sourceFiles(SRC).flatMap(statementsIn);
  const problems: string[] = [];
  let prepared = 0;
  for (const statement of statements) {
    const outcome = await check(client, statement);
    if (outcome.kind === 'ok') prepared++;
    if (outcome.kind === 'mismatch') problems.push(`${statement.file}:${statement.line}  ${outcome.message}`);
  }
  await client.end();
  console.log(`Checked ${statements.length} SQL statements against the migrated schema: ${prepared} prepared, ${statements.length - prepared - problems.length} skipped because their shape is built at runtime.`);
  if (problems.length > 0) {
    console.error(`${problems.length} name a table, column or function the database does not have:\n${problems.join('\n')}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
