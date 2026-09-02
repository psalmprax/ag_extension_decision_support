import { useState, useCallback, useEffect } from 'react';
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  updateConversation,
  deleteConversation,
  createConversation,
} from '@/api/chatbotService';
import { Conversation, ChatMessage, Farmer } from '../types/dashboard';

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

    const userMsg: ChatMessage = {
      role: 'officer',
      content: farmerChatInput,
      timestamp: new Date().toISOString(),
    };
    setFarmerChatMessages(prev => [...prev, userMsg]);
    const currentInput = farmerChatInput;
    setFarmerChatInput('');

    // Offline queue: if offline or network fails, stash and retry on online
    const queueKey = `chatOfflineQueue:${activeFarmerConvId || 'new'}`;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (offline) {
      const q = JSON.parse(localStorage.getItem(queueKey) || '[]') as unknown[];
      q.push({ conversationId: activeFarmerConvId, message: currentInput, language, at: Date.now() });
      localStorage.setItem(queueKey, JSON.stringify(q));
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
        const q = JSON.parse(localStorage.getItem(queueKey) || '[]') as unknown[];
        q.push({ conversationId: activeFarmerConvId, message: currentInput, language, at: Date.now() });
        localStorage.setItem(queueKey, JSON.stringify(q));
        console.warn('Chat queued after failure:', currentInput.slice(0, 40));
      } else console.error('Failed to send farmer message:', error);
    }
  };

  // Drain offline queue when back online
  useEffect(() => {
    const drain = async () => {
      if (!navigator.onLine) return;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('chatOfflineQueue:')) continue;
        const items = JSON.parse(localStorage.getItem(key) || '[]') as { conversationId: string | null; message: string; language: string }[];
        if (items.length === 0) continue;
        for (const item of [...items]) {
          try {
            await sendMessage({ conversationId: item.conversationId || undefined, message: item.message, mode: 'farmer', language: item.language });
            items.shift();
            localStorage.setItem(key, JSON.stringify(items));
          } catch { break; }
        }
        if (items.length === 0) localStorage.removeItem(key);
      }
      if (activeFarmerConvId) loadFarmerMessages(activeFarmerConvId);
    };
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, [activeFarmerConvId, language, loadFarmerMessages]);

  const handleStartConversation = async (farmer: Farmer, chatType: 'ai' | 'farmer' = 'farmer') => {
    try {
      const existingConversations = chatType === 'farmer' ? farmerConversations : conversations;
      const existingConv = existingConversations.find(
        (c: Conversation) => c.farmerId === farmer.id
      );

      if (existingConv) {
        if (chatType === 'farmer') {
          setActiveFarmerConvId(existingConv.id);
          loadFarmerMessages(existingConv.id);
        } else {
          setActiveConvId(existingConv.id);
          loadMessages(existingConv.id);
        }
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
          setFarmerConversations(prev => {
            const exists = prev.some(c => c.id === newConv.id);
            if (exists) return prev;
            return [newConv, ...prev];
          });
          setActiveFarmerConvId(newConv.id);
          loadFarmerMessages(newConv.id);
        } else {
          setConversations(prev => [newConv, ...prev]);
          setActiveConvId(newConv.id);
          setChatMessages([]);
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
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
