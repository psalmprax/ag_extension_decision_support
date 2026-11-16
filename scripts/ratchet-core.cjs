/**
 * Shared ratchet logic: compare per-file measurements with a recorded
 * baseline. New offenders and growth fail; shrinkage passes and is reported
 * so it can be locked in with --update. Used by component-size-ratchet.cjs
 * and explicit-any-ratchet.cjs.
 */
const { readFileSync, writeFileSync } = require('node:fs');

/**
 * @param {object} opts
 * @param {Record<string, number>} opts.current   file -> measurement now
 * @param {string} opts.baselineFile              JSON file holding the baseline
 * @param {boolean} opts.update                   write `current` as the new baseline
 * @param {string} opts.name                      ratchet name for messages
 * @param {(file: string, value: number) => string} opts.newMessage
 * @param {(file: string, from: number, to: number) => string} opts.grewMessage
 * @param {string} opts.unit                      e.g. "lines", "explicit any"
 * @returns {number} process exit code
 */
function runRatchet({ current, baselineFile, update, name, newMessage, grewMessage, unit }) {
  let baseline = {};
  try {
    baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const total = obj => Object.values(obj).reduce((a, b) => a + b, 0);

  if (update) {
    writeFileSync(baselineFile, JSON.stringify(current, null, 2) + '\n');
    console.log(`${name} baseline updated: ${Object.keys(current).length} files, ${total(current)} ${unit}.`);
    return 0;
  }

  const errors = [];
  for (const [file, value] of Object.entries(current)) {
    if (!(file in baseline)) errors.push(newMessage(file, value));
    else if (value > baseline[file]) errors.push(grewMessage(file, baseline[file], value));
  }

  const shrunk = Object.keys(baseline).filter(f => !(f in current) || current[f] < baseline[f]);
  if (shrunk.length && !errors.length) {
    console.log(`Progress: ${shrunk.length} baselined file(s) improved — run with --update to lock it in.`);
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    return 1;
  }
  console.log(`${name} OK (${Object.keys(current).length} grandfathered files, ${total(current)} ${unit}, 0 regressions).`);
  return 0;
}

module.exports = { runRatchet };
