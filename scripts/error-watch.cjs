#!/usr/bin/env node
/**
 * Reads the production failure summary (GET /api/v1/monitoring/failures) from stdin and
 * decides whether it is worth a person's attention. Used by .github/workflows/error-watch.yml.
 *
 * Alerts on:
 * - any server error (status 500 and up), even once;
 * - any route answering with the same 4xx status at least 5 times in the window
 *   (401 is never recorded: it is the normal "please sign in" answer);
 * - any browser error (uncaught error, failed promise or crash screen) seen 3 times or more.
 *
 * Writes `alert=true|false` and a Markdown table to the files given as arguments
 * (normally $GITHUB_OUTPUT and a body file).
 */
'use strict';

const fs = require('node:fs');

const THRESHOLDS = { serverError: 1, clientError: 5, browser: 3 };

/** @param {{kind:string,method:string,route:string,status:number,count:number,sample?:string}} failure */
function needsAttention(failure) {
  if (failure.kind === 'browser') return failure.count >= THRESHOLDS.browser;
  if (failure.status >= 500) return failure.count >= THRESHOLDS.serverError;
  return failure.count >= THRESHOLDS.clientError;
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').slice(0, 200);
}

/** Markdown table of the failures that need attention, most frequent first. */
function report(summary) {
  const failures = Array.isArray(summary?.failures) ? summary.failures : [];
  const flagged = failures.filter(needsAttention).sort((a, b) => b.count - a.count);
  if (flagged.length === 0) return { alert: false, body: '' };
  const rows = flagged.map(f => {
    const what = f.kind === 'browser' ? `browser (${f.method.toLowerCase()})` : f.method;
    const status = f.kind === 'browser' ? '' : f.status;
    return `| ${cell(what)} | \`${cell(f.route)}\` | ${status} | ${f.count} | ${cell(f.sample)} |`;
  });
  const body = [
    `Failures in the last ${summary.hours ?? 1} hour(s), up to ${summary.generatedAt ?? 'now'}:`,
    '',
    '| What | Route or page | Status | Times | Error text |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `Alerts at: any 5xx; the same 4xx on one route ${THRESHOLDS.clientError}+ times; the same browser error ${THRESHOLDS.browser}+ times. ` +
      'Stack traces are in Sentry when SENTRY_DSN is set. This issue closes itself after a check with nothing over these limits.',
  ].join('\n');
  return { alert: true, body };
}

if (require.main === module) {
  const [outputFile, bodyFile] = process.argv.slice(2);
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch (error) {
    console.error(`error-watch: the failure summary is not JSON (${error.message})`);
    process.exit(2);
  }
  const { alert, body } = report(summary);
  if (outputFile) fs.appendFileSync(outputFile, `alert=${alert}\n`);
  if (bodyFile) fs.writeFileSync(bodyFile, body);
  console.log(alert ? body : 'Nothing over the alert limits.');
}

module.exports = { needsAttention, report, THRESHOLDS };
