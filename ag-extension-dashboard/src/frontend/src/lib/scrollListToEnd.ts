/**
 * Scrolls a message list to its newest entry without moving the page. scrollIntoView also
 * scrolls every scrollable ancestor, the window included, so on a phone opening a chat used
 * to push the page title and the first messages out of view.
 */
export function scrollListToEnd(end: HTMLElement | null, smooth = true): void {
  let list = end?.parentElement ?? null;
  while (list && list.scrollHeight <= list.clientHeight && list !== document.body) list = list.parentElement;
  if (!list || list === document.body || list === document.documentElement) return;
  list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}
