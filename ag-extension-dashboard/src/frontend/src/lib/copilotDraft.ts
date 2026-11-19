/**
 * The copilot draft an officer put into a thread's message box, kept until they
 * send, so the server can mark the reply as AI-drafted (and see if they edited it).
 */
const drafts = new Map<string, string>();

export function rememberCopilotDraft(conversationId: string, text: string): void {
  drafts.set(conversationId, text);
}

/** The draft behind the reply being sent now, if any; it is used up. */
export function takeCopilotDraft(conversationId: string): string | undefined {
  const text = drafts.get(conversationId);
  drafts.delete(conversationId);
  return text;
}
