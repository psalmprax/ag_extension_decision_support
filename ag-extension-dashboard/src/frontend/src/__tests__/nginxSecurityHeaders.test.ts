import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * nginx only inherits add_header from the server block when a location sets none of its own.
 * The SPA page and the static assets have their own Cache-Control, so for a long time they
 * went out with no security headers at all. Every location that adds a header must include
 * the shared list again.
 */
const conf = readFileSync(resolve(__dirname, '../../nginx.conf'), 'utf8');
const snippet = readFileSync(resolve(__dirname, '../../security-headers.conf'), 'utf8');
const INCLUDE = 'include /etc/nginx/snippets/security-headers.conf;';

function locationBlocks(text: string): Array<{ head: string; body: string }> {
  const blocks: Array<{ head: string; body: string }> = [];
  const re = /location\s+([^{]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < text.length) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      i++;
    }
    blocks.push({ head: match[1].trim(), body: text.slice(re.lastIndex, i - 1) });
  }
  return blocks;
}

describe('nginx security headers', () => {
  it('lists the headers once, in the shared file', () => {
    for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
      expect(snippet).toContain(`add_header ${header}`);
      expect(conf).not.toContain(`add_header ${header}`);
    }
  });

  it('includes them at server level', () => {
    const serverLevel = conf.slice(0, conf.search(/^\s*location\s/m));
    expect(serverLevel).toContain(INCLUDE);
  });

  it('includes them again in every location that adds its own header', () => {
    const withHeaders = locationBlocks(conf).filter(block => /add_header/.test(block.body));
    expect(withHeaders.length).toBeGreaterThan(0);
    for (const block of withHeaders) expect({ location: block.head, includes: block.body.includes(INCLUDE) }).toEqual({ location: block.head, includes: true });
  });

  // The page draws tiles as images (img-src), and the service worker fetches the same tiles to
  // cache them for offline use, which counts as a connection (connect-src). The service worker
  // file gets this policy too, so a tile host missing from connect-src fails every tile.
  it('allows the map tile servers both as images and as connections from the service worker', () => {
    const csp = snippet.match(/Content-Security-Policy "([^"]+)"/)![1];
    const directive = (name: string) => csp.split(';').map(part => part.trim()).find(part => part.startsWith(`${name} `))!.split(/\s+/);
    for (const host of ['https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org', 'https://server.arcgisonline.com', 'https://*.tile.opentopomap.org']) {
      expect(directive('img-src')).toContain(host);
      expect(directive('connect-src')).toContain(host);
    }
  });

  it('never caches the service worker as immutable', () => {
    const worker = locationBlocks(conf).find(block => block.head.endsWith('= /sw.js'));
    expect(worker?.body).toContain('add_header Cache-Control "no-cache";');
  });

  it('draws the street map from the host the offline download stores tiles under', async () => {
    const { TILE_LAYERS } = await import('@/components/map/mapConstants');
    const offline = readFileSync(resolve(__dirname, '../lib/offlineTiles.ts'), 'utf8');
    expect(TILE_LAYERS.street.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(offline).toContain('https://tile.openstreetmap.org/${z}/${x}/${y}.png');
  });
});
