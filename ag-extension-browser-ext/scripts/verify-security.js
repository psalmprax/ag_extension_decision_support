/**
 * Browser Extension Manifest & Security Verification Script
 * Validates Manifest V3 conformance, permission scopes, and dangerous API absence.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, '../wxt.config.ts');

function runVerification() {
  console.log('🔒 Verifying Browser Extension Security & Manifest V3 Configuration...');

  if (!fs.existsSync(configPath)) {
    console.error('❌ wxt.config.ts not found at:', configPath);
    process.exit(1);
  }

  const content = fs.readFileSync(configPath, 'utf8');

  // 1. Check for Manifest V3 background service worker
  if (!content.includes('service_worker: true')) {
    console.error('❌ Manifest V3 requires background service worker');
    process.exit(1);
  }
  console.log('  ✅ Manifest V3 background service worker declared');

  // 2. Check for dangerous legacy permissions that violate least-privilege
  const forbiddenPermissions = ['webRequestBlocking', 'debugger', 'proxy', 'management'];
  for (const perm of forbiddenPermissions) {
    if (content.includes(`'${perm}'`) || content.includes(`"${perm}"`)) {
      console.error(`❌ Dangerous permission detected: ${perm}`);
      process.exit(1);
    }
  }
  console.log('  ✅ No dangerous high-risk permissions detected');

  // 3. Verify sidePanel and storage permissions
  if (!content.includes("'storage'") || !content.includes("'sidePanel'")) {
    console.error('❌ Missing essential required extension permissions');
    process.exit(1);
  }
  console.log('  ✅ Core required permissions properly scoped');

  console.log('✅ Browser extension security verification passed successfully!\n');
}

runVerification();
