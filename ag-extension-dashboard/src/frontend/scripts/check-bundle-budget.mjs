import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const distRoot = path.resolve('dist');
const maxJavaScriptBytes = 700 * 1024;
const maxTotalBytes = 6 * 1024 * 1024;
// One translation file is fetched per user (LanguageContext: /locales/<lang>.json).
const maxLocaleBytes = 100 * 1024;

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
const largestJavaScript = javascript.reduce(
  (largest, item) => item.bytes > largest.bytes ? item : largest,
  { file: '', bytes: 0 }
);

// Source maps are debug artifacts; offline edge AI model/WASM binaries (/models/) and the
// per-language translation files (/locales/, one fetched per user) are on-demand assets.
// None is part of the shipped core web application bundle budget. Translations get their
// own per-file cap instead, so a bloated language file still fails the build.
const isUnder = dir => item => item.file.includes(`${path.sep}${dir}${path.sep}`);
const locales = sizes.filter(isUnder('locales'));
const largestLocale = locales.reduce((largest, item) => (item.bytes > largest.bytes ? item : largest), { file: '', bytes: 0 });
const shippedFiles = sizes.filter(
  item => !item.file.endsWith('.map') && !isUnder('models')(item) && !isUnder('locales')(item)
);
const totalBytes = shippedFiles.reduce((total, item) => total + item.bytes, 0);

console.log(`Bundle budget: largest JS ${(largestJavaScript.bytes / 1024).toFixed(1)}KB / ${(maxJavaScriptBytes / 1024).toFixed(0)}KB`);
console.log(`Bundle budget: total generated assets ${(totalBytes / 1024).toFixed(1)}KB / ${(maxTotalBytes / 1024).toFixed(0)}KB`);
console.log(
  `Bundle budget: largest translation ${(largestLocale.bytes / 1024).toFixed(1)}KB / ${(maxLocaleBytes / 1024).toFixed(0)}KB (${path.basename(largestLocale.file) || 'none'})`
);

const failures = [];
if (largestJavaScript.bytes > maxJavaScriptBytes) {
  failures.push(`largest JavaScript asset exceeds ${maxJavaScriptBytes / 1024}KB`);
}
if (totalBytes > maxTotalBytes) {
  failures.push(`total generated assets exceed ${maxTotalBytes / 1024}KB`);
}
if (largestLocale.bytes > maxLocaleBytes) {
  failures.push(`translation ${path.basename(largestLocale.file)} exceeds ${maxLocaleBytes / 1024}KB`);
}
if (failures.length > 0) {
  console.error(`Bundle budget failed: ${failures.join('; ')}`);
  process.exit(1);
}
