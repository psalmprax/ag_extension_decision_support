import type { FormEvent } from 'react';
import type { ChatMessage, Conversation } from '@/types/dashboard';

/** The thread state both chat pages share (officers' Farmer Chat and the farmer's own). */
export interface ThreadPageProps {
  farmerConversations: Conversation[];
  activeFarmerConvId: string | null;
  setActiveFarmerConvId: (id: string | null) => void;
  loadFarmerMessages: (id: string) => void | Promise<void>;
  farmerChatMessages: ChatMessage[];
  farmerChatInput: string;
  setFarmerChatInput: (value: string) => void;
  handleFarmerChatSend: (e?: FormEvent) => void | Promise<void>;
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
    farmerChatInput: source.farmerChatInput,
    setFarmerChatInput: source.setFarmerChatInput,
    handleFarmerChatSend: source.handleFarmerChatSend,
  };
}
