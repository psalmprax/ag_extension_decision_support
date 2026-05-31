import React from 'react';
import { Users, Plus, Send } from 'lucide-react';
import { Conversation, ChatMessage, Farmer } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';

interface FarmerChatPageProps {
    farmerConversations: Conversation[];
    activeFarmerConvId: string | null;
    setActiveFarmerConvId: (id: string) => void;
    loadFarmerMessages: (id: string) => void;
    farmerChatMessages: ChatMessage[];
    farmerChatInput: string;
    setFarmerChatInput: (input: string) => void;
    handleFarmerChatSend: (e: React.FormEvent) => void;
    loadFarmers: () => void;
    setShowFarmerModal: (show: boolean) => void;
    isModern: boolean;
    headingClass: string;
    btnClass: string;
    radiusClass: string;
}

export const FarmerChatPage: React.FC<FarmerChatPageProps> = ({
    farmerConversations, activeFarmerConvId, setActiveFarmerConvId,
    loadFarmerMessages, farmerChatMessages, farmerChatInput, setFarmerChatInput,
    handleFarmerChatSend, loadFarmers, setShowFarmerModal,
    isModern, headingClass, btnClass, radiusClass,
}) => {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
            <div className="mb-2">
                <h1 className={`text-3xl font-bold ${headingClass}`}>
                    {isModern ? 'Network Communications' : 'Farmer Chat'}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('chat_subtitle')}</p>
            </div>
            <div className="flex flex-1 gap-6 overflow-hidden">
                <div className={`w-80 flex flex-col bg-theme-bg-card dark:bg-gray-800 ${radiusClass} border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden`}>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white">{t('chat_farmer_chats')}</h3>
                        <button
                            onClick={() => { loadFarmers(); setShowFarmerModal(true); }}
                            className={`p-2 bg-primary-600 hover:bg-primary-700 text-white ${btnClass} transition-colors`}
                            title={t('common_new_conversation')}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {farmerConversations.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                {t('chat_no_conversations')}<br />{t('chat_start_new_chat')}
                            </div>
                        ) : (
                            farmerConversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => {
                                        setActiveFarmerConvId(conv.id);
                                        loadFarmerMessages(conv.id);
                                    }}
                                    className={`w-full p-3 ${radiusClass} text-left transition-all ${activeFarmerConvId === conv.id
                                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                            {conv.farmerName?.[0]}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{conv.farmerName}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(conv.startedAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</p>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-theme-bg-card dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    {activeFarmerConvId ? (
                        <>
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/20">
                                        {farmerConversations.find(c => c.id === activeFarmerConvId)?.farmerName?.[0]}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">
                                            {farmerConversations.find(c => c.id === activeFarmerConvId)?.farmerName}
                                        </h4>
                                        <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-secondary-500 rounded-full animate-pulse"></span>
                                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('chat_direct_chat')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {farmerChatMessages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'officer' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.role === 'officer'
                                            ? 'bg-primary-600 text-white rounded-tr-none'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                                            }`}>
                                            <p className="text-sm leading-relaxed">{msg.content}</p>
                                            <span className={`text-[9px] mt-2 block ${msg.role === 'officer' ? 'text-primary-200' : 'text-gray-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleFarmerChatSend} className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700">
                                <div className="relative flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={farmerChatInput}
                                        onChange={(e) => setFarmerChatInput(e.target.value)}
                                        placeholder={t('farmer_chat_placeholder')}
                                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!farmerChatInput.trim()}
                                        className={`p-3 ${isModern ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20 shadow-lg' : 'bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-200 text-slate-900 dark:text-white'} ${btnClass} transition-all disabled:opacity-50`}
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                            <div className={`w-20 h-20 ${radiusClass} bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4`}>
                                <Users className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('chat_select_conversation')}</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-xs">{t('chat_connect_farmers')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
