import React, { useState, useEffect } from 'react';
import {
    Send, Users, Clock, CheckCircle,
    XCircle, Loader2, Search, Plus, BarChart3,
    Layout, Bell, History, Info, ChevronRight, User, Sparkles, MapPin, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { fetchSMSHistory, sendSMS, sendBulkSMS, translateMessage } from '../api/smsService';
import { fetchFarmers, Farmer } from '../api/farmerService';
import { fetchUsage } from '../api/billingService';

interface SMSMessage {
    id: string;
    to: string;
    message: string;
    status: 'success' | 'failed' | 'pending';
    timestamp: Date;
}

interface Contact {
    id: string;
    name: string;
    phone: string;
    lastSeen?: string;
}

export function SMSPage() {
    const { t, language } = useLanguage();
    const { pendingSMS, setPendingSMS } = useAppStore();

    // UI State
    const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
    const [sendMode, setSendMode] = useState<'single' | 'bulk'>('single');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

    const templates = [
        { id: '1', title: t('sms_template_greeting'), content: "Hello, this is your Ag Extension officer. How is your crop doing?", icon: Sparkles, color: 'bg-amber-100 text-amber-600' },
        { id: '2', title: t('sms_template_visit'), content: "I will be visiting your farm tomorrow at 10 AM. Please be available.", icon: MapPin, color: 'bg-blue-100 text-blue-600' },
        { id: '3', title: t('sms_template_alert'), content: "URGENT: Heavy rain expected. Please take necessary precautions for your harvest.", icon: AlertTriangle, color: 'bg-rose-100 text-rose-600' },
    ];

    const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);

    // Form State
    const [phoneNumber, setPhoneNumber] = useState('');
    const [message, setMessage] = useState('');
    const [recipients, setRecipients] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [showRightPanel, setShowRightPanel] = useState(true);

    // Status State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [response, setResponse] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<SMSMessage[]>([]);
    
    // Quota State - fetched from billing API
    const [quota, setQuota] = useState({ current: 0, limit: 10000, sent: 0, failed: 0 });
    const [isLoadingQuota, setIsLoadingQuota] = useState(false);
    
    // Fetch History
    const loadHistory = async () => {
        try {
            const data = await fetchSMSHistory();
            if (data.success) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setHistory(data.data.map((msg: any) => ({
                    id: msg.id,
                    to: msg.phoneNumber,
                    message: msg.message,
                    status: msg.status === 'sent' ? 'success' : msg.status === 'failed' ? 'failed' : 'pending',
                    timestamp: new Date(msg.createdAt)
                })));
            }
        } catch (err) {
            console.error('Failed to fetch SMS history:', err);
        }
    };

    const loadContacts = async () => {
        setIsLoadingContacts(true);
        try {
            const res = await fetchFarmers();
            if (res.success) {
                setRecentContacts(res.data.farmers.map((f: Farmer) => ({
                    id: f.id,
                    name: `${f.firstName} ${f.lastName}`,
                    phone: f.phone || '',
                })));
            }
        } catch (err) {
            console.error('Failed to fetch farmers for SMS contacts:', err);
        } finally {
            setIsLoadingContacts(false);
        }
    };

    useEffect(() => {
        loadHistory();
        loadContacts();
        // Load quota from billing API
        setIsLoadingQuota(true);
        fetchUsage()
            .then((data) => {
                if (data?.success && data?.data) {
                    const usageData = data.data;
                    // Find SMS-related usage entries
                    const smsUsage = Array.isArray(usageData)
                        ? usageData.find((u: { type: string }) => u.type === 'sms' || u.type === 'SMS')
                        : usageData;
                    if (smsUsage) {
                        setQuota(prev => ({
                            ...prev,
                            current: smsUsage.current || 0,
                            limit: smsUsage.limit || 10000,
                        }));
                    }
                }
            })
            .catch(() => {
                // Silently fail - quota stays at defaults
            })
            .finally(() => setIsLoadingQuota(false));
    }, []);

    // Check for pending SMS on mount
    useEffect(() => {
        if (pendingSMS) {
            setPhoneNumber(pendingSMS.phone);
            setSendMode('single'); // Ensure we are in single mode to see the number
            setPendingSMS(null); // Clear it after consuming
        }
    }, [pendingSMS, setPendingSMS]);

    // Handle Translation
    const handleTranslate = async () => {
        if (!message) return;
        setIsTranslating(true);
        try {
            const res = await translateMessage({ text: message, targetLanguage: language });
            if (res.success) {
                setMessage(res.data.translatedText);
            }
        } catch (err) {
            console.error('Translation failed:', err);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        setError(null);
        setResponse(null);

        try {
            let res;
            if (sendMode === 'single') {
                res = await sendSMS({ to: phoneNumber, message, farmerId: selectedContact?.id });
            } else {
                const recipientList = recipients.split(',').map(r => r.trim()).filter(r => r);
                res = await sendBulkSMS({ recipients: recipientList, message });
            }

            if (res.success) {
                setResponse({ message: t('sms_sent_success') || 'Message sent successfully!' });
                setPhoneNumber('');
                setRecipients('');
                setMessage('');
                loadHistory();
            } else {
                setError(res.error || 'Failed to send message');
            }
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setError((err as any).response?.data?.message || (err as any).message);
        } finally {
            setIsSending(false);
        }
    };

    const applyTemplate = (content: string) => {
        setMessage(content);
    };

    const selectContact = (contact: Contact) => {
        setSelectedContact(contact);
        setPhoneNumber(contact.phone);
        if (sendMode === 'bulk') setSendMode('single');
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden gap-4 p-4 lg:p-6 bg-slate-50 dark:bg-slate-950">
            {/* LEFT PANEL: Contacts & Search */}
            <div className="w-full lg:w-1/4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary-600" />
                        {t('sms_recent_recipients')}
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('farmer_search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isLoadingContacts ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        </div>
                    ) : (
                        recentContacts
                            .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery))
                            .map((contact) => (
                        <button
                            key={contact.id}
                            onClick={() => selectContact(contact)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedContact?.id === contact.id
                                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                        >
                            <div className="flex items-center gap-3 text-left">
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                    <User className="w-5 h-5 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{contact.name}</p>
                                    <p className="text-xs text-slate-500">{contact.phone}</p>
                                </div>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-300 ${selectedContact?.id === contact.id ? 'text-primary-500' : ''}`} />
                        </button>
                    )))}
                    {!isLoadingContacts && recentContacts.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-xs uppercase font-bold tracking-widest">
                            No farmers found
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <button className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Plus className="w-4 h-4" />
                        {t('common_add')}
                    </button>
                </div>
            </div>

            {/* MIDDLE PANEL: Composer */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('compose')}
                            className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'compose' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            <Layout className="w-4 h-4 inline-block mr-2" />
                            {t('sms_tab_compose')}
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            <History className="w-4 h-4 inline-block mr-2" />
                            {t('sms_tab_history')}
                        </button>
                    </div>

                    {activeTab === 'compose' && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <button
                                onClick={() => setSendMode('single')}
                                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${sendMode === 'single' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                                    }`}
                            >
                                {t('sms_single_tab')}
                            </button>
                            <button
                                onClick={() => setSendMode('bulk')}
                                className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${sendMode === 'bulk' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                                    }`}
                            >
                                {t('sms_bulk_tab')}
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setShowRightPanel(!showRightPanel)}
                        className={`p-2 rounded-xl transition-all ml-auto ${showRightPanel ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        title="Toggle Sidebar"
                    >
                        <Info className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {activeTab === 'compose' ? (
                            <motion.div
                                key="compose"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="max-w-xl mx-auto space-y-6"
                            >
                                <div className="space-y-4">
                                    {sendMode === 'single' ? (
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                                {t('sms_phone_label')}
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    type="tel"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                    placeholder="+254 --- --- ---"
                                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-mono text-lg"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500">
                                                    <Plus className="w-5 h-5 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                                {t('sms_bulk_recipients')}
                                            </label>
                                            <textarea
                                                value={recipients}
                                                onChange={(e) => setRecipients(e.target.value)}
                                                placeholder="+2541, +2542, +2543..."
                                                rows={3}
                                                className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center ml-1">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {t('sms_message_label')}
                                                </label>
                                                <button
                                                    onClick={handleTranslate}
                                                    disabled={isTranslating || !message}
                                                    className="flex items-center gap-1.5 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary-100 transition-colors disabled:opacity-50"
                                                >
                                                    {isTranslating ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-3 h-3" />
                                                    )}
                                                    {t('common_translate') || 'Translate'}
                                                </button>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${message.length > 150 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {t('sms_char_count').replace('{count}', message.length.toString())}
                                            </span>
                                        </div>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="..."
                                            rows={6}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-lg leading-relaxed resize-none"
                                        />
                                    </div>

                                    {(response || error) && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`p-4 rounded-xl flex items-center gap-3 ${error ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'}`}
                                        >
                                            {error ? <XCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                                            <p className="text-sm font-medium">{error || response?.message}</p>
                                        </motion.div>
                                    )}

                                    <button
                                        disabled={isSending || !message || (sendMode === 'single' ? !phoneNumber : !recipients)}
                                        onClick={handleSend}
                                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all ${isSending ? 'bg-slate-200 dark:bg-slate-800' : 'bg-primary-600 hover:bg-primary-500 text-white'
                                            }`}
                                    >
                                        {isSending ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span>{t('sms_sending')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                <span>{sendMode === 'bulk' ? t('sms_bulk_button') : t('sms_send_button')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="history"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-4"
                            >
                                {history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                        <Clock className="w-12 h-12 mb-4 opacity-20" />
                                        <p>{t('common_no_data')}</p>
                                    </div>
                                ) : (
                                    history.map((msg) => (
                                        <div key={msg.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-1 p-2 rounded-lg ${msg.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                    {msg.status === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">{msg.to}</p>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{msg.message}</p>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 mt-2 inline-block">
                                                        {msg.timestamp.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* RIGHT PANEL: Analytics & Utilities */}
            {showRightPanel && (
                <div className="w-full lg:w-1/4 space-y-4 overflow-y-auto pr-1">
                    {/* GLASS DASHBOARD CARD */}
                    <div className="relative overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 shadow-xl space-y-6">
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl"></div>

                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                <Plus className="w-5 h-5 text-emerald-500 p-1 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg" />
                                {t('sms_quota_title')}
                            </h3>
                            <button onClick={() => setShowRightPanel(false)} className="relative z-10 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-rose-500">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-end justify-between">
                                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                                    {isLoadingQuota ? <Loader2 className="w-8 h-8 animate-spin inline" /> : quota.current.toLocaleString()}
                                </span>
                                <span className="text-sm font-bold text-slate-500 flex items-center gap-1 mb-1">
                                    / {quota.limit.toLocaleString()}
                                    <span title={`SMS quota resets monthly. You've used ${quota.current} of ${quota.limit} messages.`}>
                                        <Info className="w-3 h-3 cursor-help" />
                                    </span>
                                </span>
                            </div>
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min((quota.current / quota.limit) * 100, 100)}%` }}
                                    className="h-full bg-gradient-to-r from-primary-600 to-indigo-600 rounded-full"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('sms_stats_title')}</span>
                                <BarChart3 className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xl font-bold text-emerald-600">
                                        {history.filter(m => m.status === 'success').length}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{t('sms_stats_sent')}</p>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-rose-500 font-mono">
                                        {history.filter(m => m.status === 'failed').length}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{t('sms_stats_failed')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TEMPLATES CARD */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            {t('sms_template_title')}
                        </h3>
                        <div className="space-y-3">
                            {templates.map((tpl) => (
                                <button
                                    key={tpl.id}
                                    onClick={() => applyTemplate(tpl.content)}
                                    className="w-full group p-3 text-left border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-900 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <div className={`p-1.5 rounded-lg ${tpl.color}`}>
                                            <tpl.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{tpl.title}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">"{tpl.content}"</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SMSPage;
