#!/usr/bin/env node

/**
 * AIHubMix Account Management CLI
 *
 * Usage:
 *   node scripts/aihubmix-cli.cjs self
 *   node scripts/aihubmix-cli.cjs models
 *   node scripts/aihubmix-cli.cjs list-keys
 *   node scripts/aihubmix-cli.cjs search-keys <keyword>
 *   node scripts/aihubmix-cli.cjs create-key <name> [quota] [models]
 *   node scripts/aihubmix-cli.cjs delete-key <id>
 */

const https = require('https');

const ACCESS_KEY = process.env.AIHUBMIX_ACCESS_KEY || '';
const BASE_HOST = 'aihubmix.com';
const API_PREFIX = '/api';

if (!ACCESS_KEY) {
  console.error('\x1b[31mError: AIHUBMIX_ACCESS_KEY environment variable is not set.\x1b[0m');
  console.error('Export it using: export AIHUBMIX_ACCESS_KEY="your-access-key"');
  process.exit(1);
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const authHeader = ACCESS_KEY.startsWith('Bearer ') ? ACCESS_KEY : `Bearer ${ACCESS_KEY}`;

    const headers = {
      'Authorization': authHeader,
      'User-Agent': 'AgExtension-CLI/1.0',
    };

    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const options = {
      hostname: BASE_HOST,
      port: 443,
      path: `${API_PREFIX}${path}`,
      method: method,
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch {
          resolve({ statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'self';

  try {
    switch (command) {
      case 'self':
      case 'profile': {
        console.log('\x1b[36mChecking AIHubMix connection and account profile...\x1b[0m');
        const res = await request('GET', '/user/self');
        if (res.statusCode === 200 && res.body?.success) {
          const d = res.body.data;
          console.log('\x1b[32m✔ Connected successfully!\x1b[0m');
          console.log(`Username:       ${d.username || 'N/A'}`);
          console.log(`Email:          ${d.email || 'N/A'}`);
          console.log(`Quota Balance:  ${d.quota} (internal units)`);
          console.log(`Used Quota:     ${d.used_quota}`);
          console.log(`Group:          ${d.group}`);
        } else {
          console.error('\x1b[31mFailed to fetch profile:\x1b[0m', res.body || res.raw);
        }
        break;
      }

      case 'models':
      case 'available_models': {
        console.log('\x1b[36mFetching available models...\x1b[0m');
        const res = await request('GET', '/user/available_models');
        if (res.statusCode === 200 && res.body?.success) {
          const models = res.body.data || [];
          console.log(`\x1b[32m✔ ${models.length} Models Available:\x1b[0m`);
          models.forEach(m => console.log(`  • ${m}`));
        } else {
          console.error('\x1b[31mFailed to fetch models:\x1b[0m', res.body || res.raw);
        }
        break;
      }

      case 'list-keys':
      case 'keys': {
        console.log('\x1b[36mFetching issued API keys...\x1b[0m');
        const res = await request('GET', '/token/?p=0&size=20');
        if (res.statusCode === 200 && res.body?.success) {
          const tokens = res.body.data || [];
          console.log(`\x1b[32m✔ Found ${tokens.length} API key(s):\x1b[0m`);
          tokens.forEach(t => {
            console.log(`  [ID: ${t.id}] ${t.name} (Status: ${t.status === 1 ? 'Active' : 'Disabled'}) - Quota: ${t.unlimited_quota ? 'Unlimited' : t.remain_quota}`);
          });
        } else {
          console.error('\x1b[31mFailed to list keys:\x1b[0m', res.body || res.raw);
        }
        break;
      }

      case 'search-keys': {
        const keyword = args[1] || '';
        console.log(`\x1b[36mSearching API keys for "${keyword}"...\x1b[0m`);
        const res = await request('GET', `/token/search?keyword=${encodeURIComponent(keyword)}`);
        if (res.statusCode === 200 && res.body?.success) {
          const tokens = res.body.data || [];
          console.log(`\x1b[32m✔ Found ${tokens.length} match(es):\x1b[0m`);
          tokens.forEach(t => console.log(`  [ID: ${t.id}] ${t.name} - Quota: ${t.remain_quota}`));
        } else {
          console.error('\x1b[31mFailed to search keys:\x1b[0m', res.body || res.raw);
        }
        break;
      }

      case 'create-key': {
        const name = args[1] || `key-${Date.now()}`;
        const quota = args[2] ? parseInt(args[2], 10) : 500000;
        const models = args[3] || undefined;
        console.log(`\x1b[36mIssuing API key "${name}" (quota: ${quota})...\x1b[0m`);
        const res = await request('POST', '/token/', {
          name,
          remain_quota: quota,
          unlimited_quota: !quota,
          models,
        });
        if (res.statusCode === 200 && res.body?.success) {
          const t = res.body.data;
          console.log('\x1b[32m✔ API Key created successfully!\x1b[0m');
          console.log(`Name:    ${t.name}`);
          console.log(`ID:      ${t.id}`);
          console.log(`Key:     ${t.key}`);
        } else {
          console.error('\x1b[31mFailed to create key:\x1b[0m', res.body || res.raw);
        }
        break;
      }

      case 'delete-key': {
        const id = args[1];
        if (!id) {
          console.error('Specify token ID to delete: node scripts/aihubmix-cli.cjs delete-key <id>');
          process.exit(1);
        }
        console.log(`\x1b[36mDeleting API key ID ${id}...\x1b[0m`);
        const res = await request('DELETE', `/token/${id}`);
        if (res.statusCode === 200 && res.body?.success) {
          console.log('\x1b[32m✔ API Key deleted successfully.\x1b[0m');
        } else {
          console.error('\x1b[31mFailed to delete key:\x1b[0m', res.body || res.raw);
        }
        break;
      }

      default:
        console.log(`
\x1b[1mAIHubMix CLI Helper\x1b[0m
Commands:
  self                        Check connection, profile, and quota balance
  models                      List available models
  list-keys                   List issued API keys
  search-keys <keyword>       Search API keys
  create-key <name> [quota]   Issue a new API key
  delete-key <id>             Delete an API key
`);
    }
  } catch (err) {
    console.error('\x1b[31mRequest error:\x1b[0m', err.message);
  }
}

main();
