import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const runtimeDirectory = path.dirname(require.resolve('onnxruntime-web/wasm'));
let browser;
let server;
let origin;
const requests = new Set();

before(async () => {
  const worker = await build({
    entryPoints: [path.join(root, 'src/sw.ts')], bundle: true, write: false,
    format: 'iife', platform: 'browser', logLevel: 'silent',
    define: { 'self.__WB_MANIFEST': JSON.stringify(['/index.html', '/classifier.js']), 'process.env.NODE_ENV': '"production"' },
  });
  const classifier = await build({
    stdin: {
      contents: "export { diagnosePlantOffline } from './src/services/edgePlantVisionClassifier'; export * as ort from 'onnxruntime-web/wasm';",
      resolveDir: root,
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
  });
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    requests.add(pathname);
    try {
      if (pathname === '/sw.js' || pathname === '/classifier.js') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end((pathname === '/sw.js' ? worker : classifier).outputFiles[0].text);
      } else if (pathname === '/api/profile') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ owner: req.headers.cookie?.includes('account=b') ? 'b' : 'a' }));
      } else if (/^\/models\/ort\/[^/]+\.(wasm|mjs)$/.test(pathname)) {
        res.setHeader('Content-Type', pathname.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(await readFile(path.join(runtimeDirectory, path.basename(pathname))));
      } else if (/^\/models\/[^/]+\.onnx$/.test(pathname)) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(await readFile(path.join(root, 'models', path.basename(pathname))));
      } else {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:");
        res.end('<!doctype html><title>Offline regression</title>');
      }
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
}, { timeout: 60000 });

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function installWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test('a new worker purges legacy private responses and never replays them to another account', { timeout: 60000 }, async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(async () => {
      const cache = await caches.open('api-cache');
      await cache.put('/api/profile', new Response(JSON.stringify({ owner: 'old-account' })));
    });
    await installWorker(page);
    assert.equal(await page.evaluate(() => caches.has('api-cache')), false);
    await context.addCookies([{ name: 'account', value: 'a', url: origin }]);
    assert.equal(await page.evaluate(async () => (await (await fetch('/api/profile')).json()).owner), 'a');
    await context.addCookies([{ name: 'account', value: 'b', url: origin }]);
    assert.equal(await page.evaluate(async () => (await (await fetch('/api/profile')).json()).owner), 'b');
    await context.setOffline(true);
    assert.equal(await page.evaluate(() => fetch('/api/profile').then(() => 'leaked').catch(() => 'unavailable')), 'unavailable');
    assert.equal(await page.evaluate(() => caches.match('/api/profile').then(Boolean)), false);
  } finally {
    await context.close();
  }
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`the bundled classifier loads its runtime and executes a model online and offline at ${viewport.width}px`, { timeout: 120000 }, async () => {
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      await page.goto(origin);
      await installWorker(page);
      requests.clear();
      await page.evaluate(async () => {
        const { diagnosePlantOffline } = await import('/classifier.js');
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 224;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#318c35';
        ctx.fillRect(0, 0, 224, 224);
        await diagnosePlantOffline(canvas, 'Tomato');
      });
      const execute = async () => page.evaluate(async () => {
        const { ort } = await import('/classifier.js');
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.wasmPaths = '/models/ort/';
        const session = await ort.InferenceSession.create('/models/plant-disease.onnx', { executionProviders: ['wasm'] });
        try {
          const tensor = new ort.Tensor('float32', new Float32Array(3 * 224 * 224), [1, 3, 224, 224]);
          const outputs = await session.run({ [session.inputNames[0]]: tensor });
          const values = Array.from(outputs[session.outputNames[0]].data);
          return values.length > 0 && values.every(Number.isFinite);
        } finally {
          await session.release();
        }
      });
      assert.equal(await execute(), true);
      assert.ok(requests.has('/models/mobilevit-classifier.onnx'), `the classifier must reach the real model loader; requests: ${[...requests].join(', ')}`);
      assert.ok(requests.has('/models/ort/ort-wasm-simd-threaded.wasm'), 'WASM must load from the self-hosted runtime');
      await page.waitForFunction(async () => Boolean(await caches.match('/models/plant-disease.onnx')) && Boolean(await caches.match('/models/ort/ort-wasm-simd-threaded.wasm')));
      await context.setOffline(true);
      await page.reload();
      assert.equal(await execute(), true, 'model execution must survive an offline page reload');
    } finally {
      await context.close();
    }
  });
}
