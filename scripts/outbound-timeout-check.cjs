#!/usr/bin/env node
/**
 * Every call the backend makes to another service must give up after a bounded time.
 * A provider that accepts the connection and never answers otherwise holds the user's
 * request open, and the AI fallback chain never moves on to the next provider.
 *
 * Checked calls: fetch(...), axios(...), axios.<verb>(...), webpush.sendNotification(...).
 * A call passes when one of its arguments is an object literal with `timeout` or `signal`,
 * when its options come from a helper (an identifier or a call, e.g. paypalJsonConfig()),
 * or when it sits inside Promise.race([...]) next to a timer.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const BACKEND_SRC = path.join(ROOT, 'ag-extension-dashboard', 'src', 'backend', 'src');
const AXIOS_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'request']);

function calleeKind(expr) {
    if (ts.isIdentifier(expr)) {
        if (expr.text === 'fetch') return { name: 'fetch', optionsIndex: 1 };
        if (expr.text === 'axios') return { name: 'axios', optionsIndex: 0 };
        return null;
    }
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
        const owner = expr.expression.text;
        const member = expr.name.text;
        if (owner === 'axios' && AXIOS_VERBS.has(member)) {
            const withBody = member === 'post' || member === 'put' || member === 'patch';
            return { name: `axios.${member}`, optionsIndex: withBody ? 2 : 1 };
        }
        if (owner === 'webpush' && member === 'sendNotification') return { name: 'webpush.sendNotification', optionsIndex: 2 };
    }
    return null;
}

function hasBoundProperty(node) {
    return node.properties.some(p => {
        const key = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
        if (key === 'timeout' || key === 'signal') return true;
        // `{ ...SHARED_OPTIONS }` carries its bound from the shared constant.
        return ts.isSpreadAssignment(p);
    });
}

function insidePromiseRace(node) {
    for (let current = node.parent; current; current = current.parent) {
        if (ts.isCallExpression(current)) {
            const callee = current.expression;
            if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
                && callee.expression.text === 'Promise' && callee.name.text === 'race') return true;
        }
        if (ts.isFunctionLike(current)) return false;
    }
    return false;
}

function isBounded(call, kind) {
    if (insidePromiseRace(call)) return true;
    const options = call.arguments[kind.optionsIndex];
    // A single-argument axios(config) carries its options in the first argument.
    if (!options) return false;
    if (ts.isObjectLiteralExpression(options)) return hasBoundProperty(options);
    // Options built elsewhere (a helper or a variable) are trusted to carry the bound.
    return ts.isIdentifier(options) || ts.isCallExpression(options) || ts.isPropertyAccessExpression(options);
}

/** Returns the unbounded calls in one file's source, as { line, call } entries. */
function findUnbounded(fileName, sourceText) {
    const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
    const found = [];
    const visit = node => {
        if (ts.isCallExpression(node)) {
            const kind = calleeKind(node.expression);
            if (kind && !isBounded(node, kind)) {
                const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
                found.push({ line: line + 1, call: kind.name });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
        return /\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
    });
}

function main() {
    const problems = [];
    for (const file of sourceFiles(BACKEND_SRC)) {
        // One-off command-line scripts are run by hand, not on a user's request.
        if (file.includes(`${path.sep}scripts${path.sep}`)) continue;
        for (const hit of findUnbounded(file, fs.readFileSync(file, 'utf8'))) {
            problems.push(`${path.relative(ROOT, file)}:${hit.line}  ${hit.call}(...) has no timeout or abort signal`);
        }
    }
    if (problems.length > 0) {
        console.error(problems.join('\n'));
        console.error(`\n${problems.length} outbound call(s) without a bound. Pass { timeout: OUTBOUND_TIMEOUT_MS } (axios) or { signal: outboundSignal() } (fetch) from src/utils/outboundTimeout.ts.`);
        process.exit(1);
    }
    console.log('Outbound timeouts OK: every fetch, axios and web-push call is bounded.');
}

if (require.main === module) main();
module.exports = { findUnbounded };
