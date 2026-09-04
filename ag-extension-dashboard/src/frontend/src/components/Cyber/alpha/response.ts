// Advisory request/response helpers moved verbatim from components/Cyber/AlphaAI.tsx (pure move).

import type React from 'react';
import apiClient from '@/api/client';
import { selectCanvasForQuery } from './rules';
import type { CanvasViewType } from './rules';
import { enqueueOfflineQuery, nowStamp } from './offlineQueue';

export interface AdvisoryCitation {
  sourceId: string;
  title: string;
  category: string;
  excerpt: string;
  score: number;
}

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  canvasTrigger?: CanvasViewType;
  canvasLabel?: string;
  citations?: AdvisoryCitation[];
  usedTools?: string[];
}

function extractCitations(data: unknown): AdvisoryCitation[] {
  const d = data as { citations?: unknown } | null | undefined;
  if (!Array.isArray(d?.citations)) return [];
  return (d.citations as Array<Record<string, unknown>>)
    .filter(c => c && typeof c === 'object' && typeof c.title === 'string')
    .map(c => ({
      sourceId: String(c.sourceId ?? c.id ?? c.title),
      title: String(c.title),
      category: String(c.category ?? 'general'),
      excerpt: String(c.excerpt ?? ''),
      score: typeof c.score === 'number' ? c.score : 0,
    }));
}

/** Pull the advisory text out of the chatbot payload, whatever shape it takes. */
function extractResponseText(data: unknown): string | null {
  const d = data as { messages?: { content?: string }[]; response?: string; text?: string } | string | null | undefined;
  if (typeof d === 'string') return d;
  return d?.messages?.[1]?.content || d?.response || d?.text || null;
}

/** Collect RAG categories from either citations or contextUsed metadata. */
function extractRagCategories(data: unknown): string[] {
  const d = data as { citations?: { category?: string }[]; contextUsed?: { metadata?: { category?: string } }[] } | null | undefined;
  if (Array.isArray(d?.citations)) return (d.citations).map(c => c.category || '').filter(Boolean);
  if (Array.isArray(d?.contextUsed)) return (d.contextUsed).map(c => c.metadata?.category || '').filter(Boolean);
  return [];
}

export type SetChatMessages = React.Dispatch<React.SetStateAction<ChatMessageItem[]>>;

/** Stash a query in the offline queue and reflect the pending state in the chat. */
export function stashQueryOffline(query: string, setMessages: SetChatMessages): void {
  enqueueOfflineQuery(query);
  setMessages(prev => [...prev,
    { id: `user-${Date.now()}`, sender: 'user', text: query, timestamp: nowStamp() } as ChatMessageItem,
    { id: `off-${Date.now()}`, sender: 'assistant', text: '📡 Offline — your agronomic question is queued and will be sent when back online.', timestamp: nowStamp() } as ChatMessageItem,
  ]);
}

/** Fetch the advisory for a query and build the assistant chat item (throws when empty). */
export async function requestAdvisoryMessage(query: string): Promise<ChatMessageItem> {
  const res = await apiClient.post('/chatbot/completions', { message: query });
  const data = res.data?.data || res.data;
  const responseText = extractResponseText(data);
  if (typeof responseText !== 'string' || responseText.trim().length === 0) {
    throw new Error('AI service returned no advisory content');
  }
  const ragCats = extractRagCategories(data);
  const { view, label } = selectCanvasForQuery(query, ragCats);
  const usedTools = Array.isArray((data as { usedTools?: unknown })?.usedTools)
    ? ((data as { usedTools: unknown[] }).usedTools).map(String)
    : [];
  return {
    id: `asst-${Date.now()}`,
    sender: 'assistant',
    text: responseText,
    timestamp: nowStamp(),
    canvasTrigger: view,
    canvasLabel: label,
    citations: extractCitations(data),
    usedTools,
  };
}

/** Record the failure state: queue on network errors, surface a clear fallback message. */
export function handleAdvisoryFailure(err: unknown, query: string, setMessages: SetChatMessages): void {
  console.error('[AlphaAI] Chatbot request error:', err);
  const isNetwork = !navigator.onLine || String((err as { message?: string })?.message || '').toLowerCase().includes('network');
  if (isNetwork) enqueueOfflineQuery(query);
  setMessages(prev => [...prev, {
    id: `asst-${Date.now()}`,
    sender: 'assistant',
    text: isNetwork
      ? '📡 Network unavailable — your agronomic question was queued offline and will be sent when back online.'
      : 'The advisory service is currently unavailable. No agronomic guidance was generated for this query — please retry shortly or consult your local extension officer.',
    timestamp: nowStamp(),
  } as ChatMessageItem]);
}
