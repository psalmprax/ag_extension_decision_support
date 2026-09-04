/**
 * Pure DOM → candidate extractor shared by the scraper page-evaluation and tests.
 * Must stay self-contained (no closures over module scope): it is stringified and
 * re-created inside the browser page context.
 *
 * @param {Document} doc
 * @param {{containerSelector?: string|null, maxResults: number, pageUrl: string}} args
 */
export function extractCandidatesFromDocument(doc, { containerSelector, maxResults, pageUrl }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const abs = (href) => {
    try { return new URL(href, pageUrl).toString(); } catch { return ''; }
  };
  const out = [];
  const seen = new Set();

  const isBoilerplate = (el) => {
    if (!el || typeof el.closest !== 'function') return false;
    return Boolean(
      el.closest('nav, header, footer, aside, noscript, [role="navigation"], [role="banner"], [role="contentinfo"], .nav, .navbar, .menu, .sidebar, .social, .share, .breadcrumbs, .comments')
    );
  };

  const sanitizeDesc = (desc, title) => {
    let d = clean(desc);
    if (title) d = d.replace(clean(title), '');
    // Strip social sharing and navigation noise
    d = d.replace(/\b(Facebook|Twitter|X|LinkedIn|Pinterest|WhatsApp|Instagram)\b(\s+(Facebook|Twitter|X|LinkedIn|Pinterest|WhatsApp|Instagram)\b)*/gi, '');
    d = d.replace(/\b(Share on|Follow us|Leave a Reply|Cancel reply):?[^\n.]*/gi, '');
    d = d.replace(/\bWhat are You Looking for\?[^\n.]*/gi, '');
    return clean(d);
  };

  const pushItem = (title, url, description, thumbnail) => {
    title = clean(title);
    url = abs(url);
    if (!title || title.length < 8 || !url || seen.has(url)) return;
    seen.add(url);
    const cleanedDesc = sanitizeDesc(description, title);
    out.push({
      id: String(out.length + 1) + '-' + url.replace(/[^a-z0-9]/gi, '').slice(-24),
      url,
      title: title.slice(0, 200),
      description: cleanedDesc.slice(0, 1200),
      author: '',
      thumbnail: thumbnail ? abs(thumbnail) : '',
      views: 0,
    });
  };

  if (containerSelector) {
    for (const el of doc.querySelectorAll(containerSelector)) {
      if (out.length >= maxResults) break;
      if (isBoilerplate(el)) continue;
      const a = el.querySelector('a[href]');
      const h = el.querySelector('h1,h2,h3,h4') || a;
      const img = el.querySelector('img');
      const text = clean(el.textContent);
      const title = h ? h.textContent : text.slice(0, 120);
      const desc = text.replace(clean(title), '').trim();
      if (a) pushItem(title, a.getAttribute('href'), desc, img ? img.getAttribute('src') : '');
    }
  }

  if (out.length === 0) {
    const roots = doc.querySelectorAll('main, article, [role="main"], #content, .results, .search-results, body');
    for (const root of roots) {
      if (isBoilerplate(root)) continue;
      for (const a of root.querySelectorAll('a[href]')) {
        if (out.length >= maxResults) break;
        if (isBoilerplate(a)) continue;
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
        const title = a.textContent;
        if (clean(title).length < 20) continue;
        const parent = a.closest('li, article, div, p') || a.parentElement;
        const desc = parent ? clean(parent.textContent).replace(clean(title), '') : '';
        pushItem(title, href, desc, '');
      }
      if (out.length >= maxResults) break;
    }
  }
  return out.slice(0, maxResults);
}
