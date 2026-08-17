import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve('dist/assets');
const maxJavaScriptBytes = 700 * 1024;
const maxTotalBytes = 4 * 1024 * 1024;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

const files = await collectFiles(distRoot);
const sizes = await Promise.all(files.map(async file => ({ file, bytes: (await stat(file)).size })));
const javascript = sizes.filter(item => /\.(js|mjs|cjs)$/.test(item.file));
const largestJavaScript = javascript.reduce((largest, item) => item.bytes > largest.bytes ? item : largest, { file: '', bytes: 0 });
// Source maps are debug artifacts and are not counted in the shipped bundle budget.
const totalBytes = sizes.filter(item => !item.file.endsWith('.map')).reduce((total, item) => total + item.bytes, 0);

console.log(`Bundle budget: largest JS ${(largestJavaScript.bytes / 1024).toFixed(1)}KB / ${(maxJavaScriptBytes / 1024).toFixed(0)}KB`);
console.log(`Bundle budget: total assets ${(totalBytes / 1024).toFixed(1)}KB / ${(maxTotalBytes / 1024).toFixed(0)}KB`);

const failures = [];
if (largestJavaScript.bytes > maxJavaScriptBytes) failures.push(`largest JavaScript asset exceeds ${maxJavaScriptBytes / 1024}KB`);
if (totalBytes > maxTotalBytes) failures.push(`total assets exceed ${maxTotalBytes / 1024}KB`);
if (failures.length > 0) {
  console.error(`Bundle budget failed: ${failures.join('; ')}`);
  process.exit(1);
}
