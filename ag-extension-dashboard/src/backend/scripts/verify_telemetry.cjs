#!/usr/bin/env node
/**
 * Runtime check for the OpenTelemetry pipeline.
 *
 * Starts a local OTLP/HTTP collector, boots the real telemetry module, issues an
 * instrumented Express request plus a manual span, and asserts that both spans
 * reached the collector with the backend service name attached.
 *
 * Usage (after `npm run build`):
 *   node scripts/verify_telemetry.cjs
 */
const http = require('http');
const path = require('path');

const COLLECTOR_PORT = Number(process.env.VERIFY_OTLP_PORT || 4318);
const received = [];

function startCollector() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        if (req.url === '/v1/traces') {
          received.push({
            contentType: req.headers['content-type'] || '',
            bytes: Buffer.concat(chunks).length,
            text: Buffer.concat(chunks).toString('latin1'),
          });
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
    });
    server.once('error', reject);
    server.listen(COLLECTOR_PORT, '127.0.0.1', () => resolve(server));
  });
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  const collector = await startCollector();
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${COLLECTOR_PORT}`;

  const telemetry = require(path.join(__dirname, '..', 'dist', 'utils', 'telemetry.js'));
  await telemetry.initTelemetry();

  const { trace } = require('@opentelemetry/api');
  const express = require('express');

  // The global provider may register a tick after start(); wait until a probe
  // span reports recording instead of assuming it is instantly available.
  const deadline = Date.now() + 5000;
  for (;;) {
    const probe = trace.getTracer('telemetry-verification').startSpan('readiness-probe');
    const recording = probe.isRecording();
    probe.end();
    if (recording) break;
    if (Date.now() > deadline) fail('tracer provider never became active');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Required after the SDK starts so the http/express instrumentation patches them.
  const app = express();
  app.get('/verify-ping', (_req, res) => res.json({ ok: true }));

  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();

  await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/verify-ping`, res => {
      res.resume();
      res.on('end', resolve);
    }).on('error', reject);
  });
  await new Promise(resolve => server.close(resolve));

  const span = trace.getTracer('telemetry-verification').startSpan('manual-verification-span');
  span.setAttribute('verification.marker', 'otel-runtime-check');
  span.end();

  // Batch processor default schedule delay is 5s; give it one full cycle.
  await new Promise(resolve => setTimeout(resolve, 7000));

  collector.close();

  if (received.length === 0) fail('collector received no OTLP export');

  const spans = [];
  const resourceAttributes = [];
  for (const entry of received) {
    if (!entry.contentType.includes('json')) continue;
    let body;
    try {
      body = JSON.parse(entry.text);
    } catch (error) {
      fail(`OTLP JSON export could not be parsed: ${error.message}`);
    }
    for (const resourceSpan of body.resourceSpans || []) {
      for (const attr of (resourceSpan.resource && resourceSpan.resource.attributes) || []) {
        resourceAttributes.push(attr);
      }
      for (const scopeSpan of resourceSpan.scopeSpans || []) {
        spans.push(...(scopeSpan.spans || []));
      }
    }
  }

  const serviceName = resourceAttributes.find(attr => attr.key === 'service.name');
  const spanNames = spans.map(s => s.name);
  const httpSpan = spans.find(s => /verify-ping|\/verify-ping|GET/.test(s.name) ||
    (s.attributes || []).some(a => String(a.value && a.value.stringValue).includes('/verify-ping')));
  const manualSpan = spans.find(s => s.name === 'manual-verification-span');

  const checks = [
    ['received one or more spans', spans.length > 0],
    ['resource carries service.name = ag-extension-backend', Boolean(serviceName && serviceName.value && serviceName.value.stringValue === 'ag-extension-backend')],
    ['manual span exported intact', Boolean(manualSpan)],
    ['manual span kept its attribute', Boolean(manualSpan && (manualSpan.attributes || []).some(a => a.key === 'verification.marker'))],
    ['express/http instrumentation produced a server span', Boolean(httpSpan)],
  ];

  console.log(`OTLP exports received: ${received.length} (${received.reduce((n, r) => n + r.bytes, 0)} bytes, ${spans.length} spans)`);
  console.log(`span names: ${spanNames.join(', ') || '(none)'}`);
  let ok = true;
  for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'FAIL'}: ${label}`);
    ok = ok && passed;
  }
  if (!ok) process.exit(1);
  console.log('Telemetry pipeline verified.');
}

main().catch(error => {
  console.error('FAIL: telemetry verification crashed:', error);
  process.exit(1);
});
