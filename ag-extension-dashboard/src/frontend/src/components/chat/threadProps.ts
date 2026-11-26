import type { FormEvent } from 'react';
import type { ChatMessage, Conversation } from '@/types/dashboard';

/** Older pages of the open thread: whether there are any, and how to load the next one. */
export interface ThreadHistory {
  hasEarlier: boolean;
  loadEarlier: () => void | Promise<void>;
}

/** How an officer asked for a reply to be sent. */
export interface ReplySendOptions {
  /** Also send it as a spoken voice message where the farmer's channel can carry one (WhatsApp). */
  speak?: boolean;
}

/** The thread state both chat pages share (officers' Farmer Chat and the farmer's own). */
export interface ThreadPageProps {
  farmerConversations: Conversation[];
  activeFarmerConvId: string | null;
  setActiveFarmerConvId: (id: string | null) => void;
  loadFarmerMessages: (id: string) => void | Promise<void>;
  farmerChatMessages: ChatMessage[];
  farmerHistory: ThreadHistory;
  farmerChatInput: string;
  setFarmerChatInput: (value: string) => void;
  handleFarmerChatSend: (e?: FormEvent, options?: ReplySendOptions) => void | Promise<void>;
}

type ThreadSource = Omit<ThreadPageProps, 'farmerConversations' | 'farmerChatMessages'> & {
  farmerConversations: unknown;
  farmerChatMessages: unknown;
};

/** Pick the shared thread props out of the app-level tab props. */
export function threadProps(source: ThreadSource): ThreadPageProps {
  return {
    farmerConversations: source.farmerConversations as Conversation[],
    activeFarmerConvId: source.activeFarmerConvId,
    setActiveFarmerConvId: source.setActiveFarmerConvId,
    loadFarmerMessages: source.loadFarmerMessages,
    farmerChatMessages: source.farmerChatMessages as ChatMessage[],
    farmerHistory: source.farmerHistory,
    farmerChatInput: source.farmerChatInput,
    setFarmerChatInput: source.setFarmerChatInput,
    handleFarmerChatSend: source.handleFarmerChatSend,
  };
}
