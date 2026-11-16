const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function runWithReport(report) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explicit-any-ratchet-'));
    const scriptsDir = path.join(dir, 'scripts');
    const backendDir = path.join(dir, 'ag-extension-dashboard', 'src', 'backend');
    const binDir = path.join(dir, 'bin');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.mkdirSync(backendDir, { recursive: true });
    fs.mkdirSync(binDir);
    for (const file of ['explicit-any-ratchet.cjs', 'ratchet-core.cjs']) {
        fs.copyFileSync(path.join(ROOT, 'scripts', file), path.join(scriptsDir, file));
    }
    const baseline = path.join(scriptsDir, 'explicit-any-baseline.json');
    fs.writeFileSync(baseline, '{"src/existing.ts":1}\n');
    const npx = path.join(binDir, 'npx');
    const absoluteReport = report.map(file => ({
        ...file,
        filePath: path.join(backendDir, file.filePath),
    }));
    fs.writeFileSync(npx, `#!/bin/sh\nprintf '%s' '${JSON.stringify(absoluteReport)}'\nexit 1\n`);
    fs.chmodSync(npx, 0o755);
    const result = spawnSync(process.execPath, [path.join(scriptsDir, 'explicit-any-ratchet.cjs'), '--update'], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
    });
    return { result, baseline: fs.readFileSync(baseline, 'utf8') };
}

test('fatal ESLint diagnostics fail before the baseline can be updated', () => {
    const { result, baseline } = runWithReport([{
        filePath: 'src/unparsed.ts',
        fatalErrorCount: 1,
        messages: [{ fatal: true, ruleId: null, message: 'Parsing error: Unexpected token' }],
    }]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /fatal diagnostics/);
    assert.equal(baseline, '{"src/existing.ts":1}\n');
});

test('ordinary ESLint rule violations still produce a valid measurement', () => {
    const { result, baseline } = runWithReport([{
        filePath: 'src/new.ts',
        fatalErrorCount: 0,
        messages: [{ fatal: false, ruleId: '@typescript-eslint/no-explicit-any' }],
    }]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /baseline updated: 1 files, 1 explicit any/);
    assert.deepEqual(JSON.parse(baseline), { 'src/new.ts': 1 });
});
