const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text made safe to place in HTML, inside an element or a quoted attribute. */
export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ENTITIES[character] ?? character);
}
