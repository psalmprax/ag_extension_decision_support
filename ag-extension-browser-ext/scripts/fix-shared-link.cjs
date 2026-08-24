const fs = require('fs');
const path = require('path');

// npm creates the wrong relative target for scoped `file:` deps installed in
// nested node_modules (4 ups instead of 3), leaving a dangling symlink.
const link = path.join(__dirname, '..', 'node_modules', '@ag-extension', 'shared');
const expectedTarget = '../../../ag-extension-shared';

try {
    const current = fs.readlinkSync(link);
    if (current === expectedTarget && fs.existsSync(link)) {
        process.exit(0);
    }
} catch {
    // missing or not a symlink - fall through and create it
}

fs.rmSync(link, { force: true, recursive: true });
fs.symlinkSync(expectedTarget, link, 'dir');

if (!fs.existsSync(path.join(link, 'package.json'))) {
    console.error('Failed to repair @ag-extension/shared symlink');
    process.exit(1);
}
console.log('Repaired @ag-extension/shared symlink');
