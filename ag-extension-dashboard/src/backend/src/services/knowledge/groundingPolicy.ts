/**
 * Grounding quarantine policy — containment for unvalidated ingested content.
 *
 * Stealth-scraped web extracts enter the vector store flagged
 * `unverified_scrape` but were still retrievable as grounding context, so a
 * poisoned or wrong source could ground agronomic advice. Quarantined
 * documents are now EXCLUDED from grounding context (LLM prompt text and
 * extractive fallback) until reviewed. They remain listed in provenance so
 * reviewers can find and clear them.
 */
import { logger } from '../../utils/logger';
import { aegisShield } from '../security/aegisShield';
import type { SearchResult } from '../vectorService';

type Meta = Record<string, unknown>;

function metaOf(res: SearchResult): Meta {
  return (res.metadata ?? {}) as Meta;
}

/** True when a result must not ground answers (pending human review). */
export function isQuarantined(res: SearchResult): boolean {
  const meta = metaOf(res);
  if (meta.groundingAllowed === false || meta.quarantine === true) return true;
  const tags = Array.isArray(meta.tags) ? meta.tags.map(String) : [];
  const status = typeof meta.dataStatus === 'string' ? meta.dataStatus : '';
  const source = typeof meta.source === 'string' ? meta.source.trim() : '';
  let faostatUrl = false;
  if (typeof meta.sourceUrl === 'string') {
    try {
      const url = new URL(meta.sourceUrl);
      faostatUrl = ['fao.org', 'www.fao.org', 'fenixservices.fao.org'].includes(url.hostname.toLowerCase()) &&
        /^\/faostat(?:\/|$)/i.test(url.pathname);
    } catch {
      // Invalid URLs do not establish provenance.
    }
  }
  return tags.includes('unverified_scrape') || status === 'unverified_scrape' ||
    /^faostat(?:[\s_-]|$)/i.test(source) || faostatUrl;
}

/** Partition retrieval results into groundable context vs. withheld items. */
export function splitQuarantined(results: SearchResult[]): { groundable: SearchResult[]; withheld: SearchResult[] } {
  const groundable: SearchResult[] = [];
  const withheld: SearchResult[] = [];
  for (const res of results) {
    (isQuarantined(res) ? withheld : groundable).push(res);
  }
  if (withheld.length > 0) {
    logger.warn(`Grounding quarantine withheld ${withheld.length}/${results.length} unverified result(s)`);
  }
  return { groundable, withheld };
}

/** Disclosure appended to grounding context when items were withheld. */
export function quarantineDisclosure(withheld: SearchResult[]): string {
  if (withheld.length === 0) return '';
  const titles = withheld
    .slice(0, 3)
    .map(res => safeDisclosureTitle(String((metaOf(res).title as string) || res.id || 'untitled')));
  return `\n\n[Note: ${withheld.length} unverified source(s) withheld from grounding pending review: ${titles.join('; ')}.]`;
}

/**
 * Withheld titles are attacker-controllable (scraped source titles) and land
 * in LLM grounding text — sanitize before disclosure. Titles carrying
 * injection patterns are replaced outright rather than patched.
 */
function safeDisclosureTitle(raw: string): string {
  const result = aegisShield.sanitizeToolResult(raw.slice(0, 160));
  if (!result.clean) {
    logger.warn(`Quarantine disclosure stripped injection patterns from withheld title (severity=${result.severity})`);
    return '[title withheld: failed safety screen]';
  }
  return result.sanitizedInput;
}
