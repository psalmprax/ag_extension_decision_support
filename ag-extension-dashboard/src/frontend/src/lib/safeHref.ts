/**
 * A link target taken from stored data (an article's source, an invoice, a video), or
 * undefined when it is not a web, mail or phone address or a path on this site.
 * React 18 still renders `javascript:` hrefs, so a source link someone saved as
 * `javascript:…` would otherwise run when a farmer clicks it.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  const value = url?.trim();
  if (!value) return undefined;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('#')) return value;
  return /^(?:https?:\/\/|mailto:|tel:)/i.test(value) ? value : undefined;
}
