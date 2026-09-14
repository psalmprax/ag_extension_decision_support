/**
 * Source-completeness gate for locales.
 *
 * audit-locales.js diffs other locales against en.json, which makes it blind
 * to keys the source code uses but en.json lacks (runtime falls back to raw
 * key names or inline English). This script scans src for static t('key')
 * usages and fails the build when any key is missing from en.json.
 *
 * Only static string literals are checked; dynamic keys (template literals,
 * concatenation) are reported as info and must be covered by review.
 */
const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '../src/frontend/src');
const enPath = path.join(__dirname, '../src/frontend/public/locales/en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = new Set(Object.keys(enData));

const STATIC_KEY = /(?<![a-zA-Z0-9_.])t\(\s*['"]([a-zA-Z0-9_.]+)['"]\s*[,)]/g;
const DYNAMIC_KEY = /(?<![a-zA-Z0-9_.])t\(\s*[`'"]/g;

let missing = new Map(); // key -> first file
let dynamicCount = 0;
let filesScanned = 0;

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
            walk(full);
            continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        filesScanned += 1;
        const text = fs.readFileSync(full, 'utf8');
        let m;
        STATIC_KEY.lastIndex = 0;
        while ((m = STATIC_KEY.exec(text)) !== null) {
            if (!enKeys.has(m[1]) && !missing.has(m[1])) {
                missing.set(m[1], path.relative(srcDir, full));
            }
        }
        DYNAMIC_KEY.lastIndex = 0;
        while (DYNAMIC_KEY.exec(text) !== null) dynamicCount += 1;
    }
}

walk(srcDir);

if (missing.size > 0) {
    console.error(`\n❌ Locale source check failed: ${missing.size} key(s) used in source but missing from en.json:`);
    for (const [key, file] of [...missing.entries()].sort()) {
        console.error(`   - ${key}  (first use: ${file})`);
    }
    console.error('\nAdd the keys to en.json, run `npm run sync-locales`, and re-run the audit.');
    process.exit(1);
}

console.log(`✅ Locale source check passed: source-referenced keys all present in en.json (${filesScanned} files scanned).`);
process.exit(0);
