const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const dashboard = path.resolve(__dirname, '../ag-extension-dashboard/src');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

// Twice the app asked /reporting/generate for a type it does not make ('synthesis',
// 'soil_diagnostic') and every click failed with 400. The types the frontend sends must be
// ones the backend generates.
test('every report type the frontend asks for is one the backend generates', () => {
  const route = readFileSync(path.join(dashboard, 'backend/src/routes/reporting/generate.ts'), 'utf8');
  const declared = route.match(/SUPPORTED_REPORT_TYPES = new Set\(\[([^\]]*)\]\)/);
  assert.ok(declared, 'SUPPORTED_REPORT_TYPES not found in the report route');
  const supported = new Set([...declared[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]));

  const requested = sourceFiles(path.join(dashboard, 'frontend/src')).flatMap(file =>
    [...readFileSync(file, 'utf8').matchAll(/generateReport\(\s*'([a-z_]+)'/g)].map(m => ({ file: path.relative(dashboard, file), type: m[1] }))
  );
  assert.ok(requested.length > 0, 'no generateReport calls found');
  const unsupported = requested.filter(r => !supported.has(r.type));
  assert.deepEqual(unsupported, [], `unsupported report types: ${JSON.stringify(unsupported)}`);
});
