const { spawnSync } = require('node:child_process');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'fallow',
    'dead-code',
    '--fail-on-regression',
    '--regression-baseline',
    '.fallow/regression-baseline.json',
    '--tolerance',
    '0',
  ],
  { encoding: 'utf8' },
);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
process.stdout.write(output);

if (result.error) {
  console.error(`Unable to run Fallow: ${result.error.message}`);
  process.exit(1);
}

const regression = output.match(
  /Regression check (passed|failed): .*?delta:\s*([+-]?\d+)/,
);

if (!regression) {
  console.error('Fallow did not emit a regression summary.');
  process.exit(1);
}

const delta = Number(regression[2]);
if (regression[1] === 'failed' || delta > 0) {
  console.error(`Fallow regression detected (delta: ${delta}).`);
  process.exit(1);
}

console.log(`Fallow regression gate passed (delta: ${delta}).`);
