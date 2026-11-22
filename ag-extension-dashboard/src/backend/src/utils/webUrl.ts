/**
 * Whether a link someone saves (a knowledge source, an article's reference) is a web
 * address. Anything else, such as `javascript:` or `data:`, is refused: these links are
 * shown to every user and opened in their browser.
 */
export function isWebUrl(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
        return false;
    }
}
