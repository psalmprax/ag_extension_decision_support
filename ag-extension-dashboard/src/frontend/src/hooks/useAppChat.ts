import { useState, useCallback } from 'react';
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
        if (activeConvId === id) {
          setActiveConvId(null);
          setChatMessages([]);
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
      setFarmerConversations(res.data);
      if (res.data.length > 0 && !activeFarmerConvId) {
        setActiveFarmerConvId(res.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load farmer conversations:', error);
    }
  }, [activeFarmerConvId]);

  const loadFarmerMessages = useCallback(async (id: string) => {
    try {
      const res = await fetchMessages(id);
      setFarmerChatMessages(res.data);
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

    try {
      const res = await sendMessage({
        conversationId: activeFarmerConvId || undefined,
        message: currentInput,
        mode: 'farmer',
        language,
      });
      if (res.success && activeFarmerConvId) {
        loadFarmerMessages(activeFarmerConvId);
      }
    } catch (error) {
      console.error('Failed to send farmer message:', error);
    }
  };

  const handleStartConversation = async (farmer: Farmer, chatType: 'ai' | 'farmer' = 'ai') => {
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
        if (chatType === 'farmer') {
          setFarmerConversations(prev => [res.data, ...prev]);
          setActiveFarmerConvId(res.data.id);
          setFarmerChatMessages([]);
        } else {
          setConversations(prev => [res.data, ...prev]);
          setActiveConvId(res.data.id);
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
