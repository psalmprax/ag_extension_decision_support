/**
 * Messages leave the app as plain text: SMS has no formatting, and WhatsApp
 * and Telegram are sent without a parse mode so stray symbols never break a
 * message. Links keep their address so the farmer can still open them.
 */
export function toPlainText(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, block => block.replace(/```\w*\n?/g, ''))
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 ($2)')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '- ')
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(^|[\s(])[*_](\S[^*_]*?)[*_](?=[\s).,!?;:]|$)/g, '$1$2')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Three SMS parts (153 characters each in a multi-part message). */
export const SMS_MAX_CHARS = 459;

/** Fit a reply into a few SMS parts, cutting at a word and saying so. */
export function fitSms(text: string, maxChars: number = SMS_MAX_CHARS): string {
    const plain = toPlainText(text).replace(/\s+/g, ' ').trim();
    if (plain.length <= maxChars) return plain;
    const more = ' ... (more in the app or from your officer)';
    const cut = plain.slice(0, maxChars - more.length);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut}${more}`;
}
