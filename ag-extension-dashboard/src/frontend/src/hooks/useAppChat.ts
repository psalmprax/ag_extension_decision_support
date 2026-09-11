import toast from 'react-hot-toast';
import { useState, useCallback, useEffect } from 'react';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  updateConversation,
  deleteConversation,
  createConversation,
} from '@/api/chatbotService';
import { isDemoFarmerId } from '@/demo/demoIds';
import { Conversation, ChatMessage, Farmer } from '../types/dashboard';

interface QueuedChatItem {
  conversationId: string | null;
  message: string;
  language: string;
  at?: number;
}

/** Send one queued item; true when it drained (caller may drop it from the queue). */
async function sendQueuedChatItem(item: QueuedChatItem): Promise<boolean> {
  try {
    await sendMessage({
      conversationId: item.conversationId || undefined,
      message: item.message,
      mode: 'farmer',
      language: item.language,
    });
    return true;
  } catch {
    return false;
  }
}

/** Drain one conversation's offline chat queue out of localStorage. */
async function drainChatOfflineQueue(key: string): Promise<void> {
  const items = JSON.parse(localStorage.getItem(key) || '[]') as QueuedChatItem[];
  for (const item of [...items]) {
    if (!(await sendQueuedChatItem(item))) return;
    items.shift();
    localStorage.setItem(key, JSON.stringify(items));
  }
  if (items.length === 0) localStorage.removeItem(key);
}

function enqueueOfflineMessage(
  queueKey: string,
  item: QueuedChatItem
): void {
  const q = JSON.parse(localStorage.getItem(queueKey) || '[]') as QueuedChatItem[];
  q.push(item);
  localStorage.setItem(queueKey, JSON.stringify(q));
}

function sendDemoFarmerResponse(
  currentInput: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
): void {
  const sentMsg: ChatMessage = {
    role: 'officer',
    content: currentInput,
    timestamp: new Date().toISOString(),
  };
  setMessages(prev => [...prev, sentMsg]);
  setTimeout(() => {
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: 'Asante sana! I have received your advisory and will update you on the crop progress.',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, 700);
}

function buildDemoConversation(farmer: Farmer): Conversation {
  return {
    id: `conv-${farmer.id}`,
    title: `Chat with ${farmer.firstName} ${farmer.lastName}`,
    farmerId: farmer.id,
    farmerName: `${farmer.firstName} ${farmer.lastName}`,
    lastMessage: `Hello ${farmer.firstName}, how can I help you today?`,
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
}

export const useAppChat = (language: string) => {
  // AI Assistant Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  // Farmer Chat State
  const [farmerConversations, setFarmerConversations] = useState<Conversation[]>([]);
  const [activeFarmerConvId, setActiveFarmerConvId] = useState<string | null>(null);
  const [farmerChatMessages, setFarmerChatMessages] = useState<ChatMessage[]>([]);
  const [farmerChatInput, setFarmerChatInput] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetchConversations();
      setConversations(res.data);
      if (res.data.length > 0 && !activeConvId) {
        setActiveConvId(res.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [activeConvId]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await fetchMessages(id);
      setChatMessages(res.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, []);

  const updateConversationTitle = async (id: string, title: string) => {
    try {
      const res = await updateConversation(id, { title });
      if (res.success) {
        setConversations(prev => prev.map(c => (c.id === id ? { ...c, title } : c)));
        setEditingConvId(null);
      }
    } catch (error) {
      console.error('Failed to update conversation:', error);
      toast.error('Could not rename conversation');
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await deleteConversation(id);
      if (res.success) {
        setConversations(prev => prev.filter(c => c.id !== id));
        setFarmerConversations(prev => prev.filter(c => c.id !== id));
        if (activeConvId === id) {
          setActiveConvId(null);
          setChatMessages([]);
        }
        if (activeFarmerConvId === id) {
          setActiveFarmerConvId(null);
          setFarmerChatMessages([]);
        }
        setDeletingConvId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('Could not delete conversation');
    }
  };

  // Farmer Chat functions
  const loadFarmerConversations = useCallback(async () => {
    try {
      const res = await fetchConversations();
      const list = res.data || [];
      setFarmerConversations(list);
      if (list.length > 0 && !activeFarmerConvId) {
        setActiveFarmerConvId(list[0].id);
      }
    } catch (error) {
      console.error('Failed to load farmer conversations:', error);
    }
  }, [activeFarmerConvId]);

  const loadFarmerMessages = useCallback(async (id: string) => {
    if (id.startsWith('conv-demo-farmer-')) {
      return;
    }
    try {
      const res = await fetchMessages(id);
      setFarmerChatMessages(res.data || []);
    } catch (error) {
      console.error('Failed to load farmer messages:', error);
    }
  }, []);

  const handleFarmerChatSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!farmerChatInput.trim()) return;

    const currentInput = farmerChatInput;
    setFarmerChatInput('');

    if (activeFarmerConvId?.startsWith('conv-demo-farmer-')) {
      sendDemoFarmerResponse(currentInput, setFarmerChatMessages);
      return;
    }

    // Offline queue: if offline or network fails, stash and retry on online
    const queueKey = `chatOfflineQueue:${activeFarmerConvId || 'new'}`;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (offline) {
      enqueueOfflineMessage(queueKey, { conversationId: activeFarmerConvId, message: currentInput, language, at: Date.now() });
      console.warn('Chat offline queued:', currentInput.slice(0, 40));
      return;
    }

    try {
      const res = await sendMessage({
        conversationId: activeFarmerConvId || undefined,
        message: currentInput,
        mode: 'farmer',
        language,
      });
      if (res.success && activeFarmerConvId) {
        loadFarmerMessages(activeFarmerConvId);
        loadFarmerConversations();
      }
    } catch (error) {
      const isNetwork = (error as Error)?.message?.toLowerCase().includes('network') || !navigator.onLine;
      if (isNetwork) {
        enqueueOfflineMessage(queueKey, { conversationId: activeFarmerConvId, message: currentInput, language, at: Date.now() });
        console.warn('Chat queued after failure:', currentInput.slice(0, 40));
      } else {
        console.error('Failed to send farmer message:', error);
      }
    }
  };

  // Drain offline queue when back online
  useEffect(() => {
    const drain = async () => {
      if (!navigator.onLine) return;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('chatOfflineQueue:')) continue;
        await drainChatOfflineQueue(key);
      }
      if (activeFarmerConvId) loadFarmerMessages(activeFarmerConvId);
    };
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, [activeFarmerConvId, language, loadFarmerMessages]);

  const selectActiveConversation = (convId: string, chatType: 'ai' | 'farmer') => {
    if (chatType === 'farmer') {
      setActiveFarmerConvId(convId);
      loadFarmerMessages(convId);
    } else {
      setActiveConvId(convId);
      loadMessages(convId);
    }
  };

  const initDemoConversation = (farmer: Farmer, chatType: 'ai' | 'farmer') => {
    const newConv = buildDemoConversation(farmer);
    if (chatType === 'farmer') {
      setFarmerConversations(prev => [newConv, ...prev]);
      setActiveFarmerConvId(newConv.id);
      setFarmerChatMessages([
        {
          role: 'user',
          content: `Jambo! I would like some advice on my ${farmer.crops?.[0] || 'farm'}.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } else {
      setConversations(prev => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setChatMessages([]);
    }
  };

  const handleStartConversation = async (farmer: Farmer, chatType: 'ai' | 'farmer' = 'farmer') => {
    try {
      const existingConversations = chatType === 'farmer' ? farmerConversations : conversations;
      const existingConv = existingConversations.find(c => c.farmerId === farmer.id);

      if (existingConv) {
        selectActiveConversation(existingConv.id, chatType);
        return true;
      }

      if (isDemoFarmerId(farmer.id)) {
        initDemoConversation(farmer, chatType);
        return true;
      }

      const res = await createConversation({
        farmerId: farmer.id,
        farmerName: `${farmer.firstName} ${farmer.lastName}`,
        language: 'en',
      });

      if (res.success && res.data) {
        const newConv = res.data;
        if (chatType === 'farmer') {
          setFarmerConversations(prev => (prev.some(c => c.id === newConv.id) ? prev : [newConv, ...prev]));
        } else {
          setConversations(prev => [newConv, ...prev]);
        }
        selectActiveConversation(newConv.id, chatType);
        if (chatType !== 'farmer') setChatMessages([]);
        return true;
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error('Could not start a new conversation');
    }
    return false;
  };

  return {
    conversations,
    setConversations,
    activeConvId,
    setActiveConvId,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    isTyping,
    setIsTyping,
    editingConvId,
    setEditingConvId,
    editingTitle,
    setEditingTitle,
    deletingConvId,
    setDeletingConvId,
    loadConversations,
    loadMessages,
    updateConversationTitle,
    handleDeleteConversation,

    farmerConversations,
    setFarmerConversations,
    activeFarmerConvId,
    setActiveFarmerConvId,
    farmerChatMessages,
    setFarmerChatMessages,
    farmerChatInput,
    setFarmerChatInput,
    loadFarmerConversations,
    loadFarmerMessages,
    handleFarmerChatSend,
    handleStartConversation,
  };
};
