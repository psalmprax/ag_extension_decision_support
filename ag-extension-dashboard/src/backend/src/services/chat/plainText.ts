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
