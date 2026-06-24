import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle, Book, MessageSquare, Mail, ExternalLink, ChevronRight, Bug, Send, Loader2, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { fetchFAQs, createSupportTicket, FAQ } from '@/api/supportService';

interface HelpCenterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function SupportTicketForm({
    setShowTicketForm,
    ticketSubject, setTicketSubject,
    ticketCategory, setTicketCategory,
    ticketDescription, setTicketDescription,
    ticketSubmitting, ticketSubmitted, handleTicketSubmit
}: {
    setShowTicketForm: (show: boolean) => void;
    ticketSubject: string;
    setTicketSubject: (subject: string) => void;
    ticketCategory: string;
    setTicketCategory: (category: string) => void;
    ticketDescription: string;
    setTicketDescription: (desc: string) => void;
    ticketSubmitting: boolean;
    ticketSubmitted: boolean;
    handleTicketSubmit: (e: React.FormEvent) => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Submit Support Ticket</h3>
                <button onClick={() => setShowTicketForm(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            </div>
            {ticketSubmitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Ticket Submitted</h4>
                    <p className="text-sm text-gray-500">We'll get back to you soon.</p>
                </div>
            ) : (
                <form onSubmit={handleTicketSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</label>
                        <input
                            type="text"
                            value={ticketSubject}
                            onChange={(e) => setTicketSubject(e.target.value)}
                            placeholder="Brief description of your issue"
                            className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Category</label>
                        <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value)}
                            className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="general">General</option>
                            <option value="farmers">Farmer Management</option>
                            <option value="visits">Visits</option>
                            <option value="ai">AI Advisor</option>
                            <option value="billing">Billing</option>
                            <option value="bug">Bug Report</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                        <textarea
                            value={ticketDescription}
                            onChange={(e) => setTicketDescription(e.target.value)}
                            placeholder="Describe your issue in detail..."
                            rows={4}
                            className="w-full mt-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={ticketSubmitting}
                        className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        {ticketSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {ticketSubmitting ? 'Submitting...' : 'Submit Ticket'}
                    </button>
                </form>
            )}
        </motion.div>
    );
}

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const setActiveTab = useAppStore((s) => s.setActiveTab);
    const addNotification = useAppStore((s) => s.addNotification);
    const [expandedFaq, setExpandedFaq] = React.useState<number | null>(null);
    const [faqs, setFaqs] = React.useState<FAQ[]>([]);
    const [faqsLoading, setFaqsLoading] = React.useState(false);
    const [showTicketForm, setShowTicketForm] = React.useState(false);
    const [ticketSubject, setTicketSubject] = React.useState('');
    const [ticketCategory, setTicketCategory] = React.useState('general');
    const [ticketDescription, setTicketDescription] = React.useState('');
    const [ticketSubmitting, setTicketSubmitting] = React.useState(false);
    const [ticketSubmitted, setTicketSubmitted] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setFaqsLoading(true);
            fetchFAQs()
                .then(res => { if (res.success) setFaqs(res.data); })
                .catch(() => { /* fallback to empty */ })
                .finally(() => setFaqsLoading(false));
        }
    }, [isOpen]);

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticketSubject.trim() || !ticketDescription.trim()) return;
        setTicketSubmitting(true);
        try {
            const res = await createSupportTicket({
                subject: ticketSubject,
                category: ticketCategory,
                description: ticketDescription,
            });
            if (res.success) {
                setTicketSubmitted(true);
                setTicketSubject('');
                setTicketDescription('');
                addNotification({ type: 'success', message: 'Support ticket submitted successfully' });
                setTimeout(() => { setShowTicketForm(false); setTicketSubmitted(false); }, 2000);
            }
        } catch {
            addNotification({ type: 'error', message: 'Failed to submit support ticket' });
        } finally {
            setTicketSubmitting(false);
        }
    };

    const quickLinks = [
        { icon: Book, label: t('help_docs') || 'Documentation', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', action: () => { onClose(); React.startTransition(() => setActiveTab('knowledge')); } },
        { icon: MessageSquare, label: t('help_chat') || 'Live Chat', color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400', action: () => { onClose(); React.startTransition(() => setActiveTab('aiassistant')); } },
        { icon: Mail, label: 'Submit Ticket', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', action: () => setShowTicketForm(true) },
    ];

    const keyboardShortcuts = [
        { key: 'Ctrl + K', action: 'Global Search' },
        { key: 'Ctrl + B', action: 'Toggle Sidebar' },
        { key: 'Esc', action: 'Close Modal' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
                    >
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                            <HelpCircle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold">{t('help_center_title') || 'Help Center'}</h2>
                                            <p className="text-sm opacity-90">{t('help_center_subtitle') || 'Find answers and get support'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-xl hover:bg-white/20 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {showTicketForm ? (
                                    <SupportTicketForm
                                        setShowTicketForm={setShowTicketForm}
                                        ticketSubject={ticketSubject}
                                        setTicketSubject={setTicketSubject}
                                        ticketCategory={ticketCategory}
                                        setTicketCategory={setTicketCategory}
                                        ticketDescription={ticketDescription}
                                        setTicketDescription={setTicketDescription}
                                        ticketSubmitting={ticketSubmitting}
                                        ticketSubmitted={ticketSubmitted}
                                        handleTicketSubmit={handleTicketSubmit}
                                    />
                                ) : (
                                    <>
                                        {/* Quick Links */}
                                        <div className="grid grid-cols-3 gap-3">
                                            {quickLinks.map(({ icon: Icon, label, color, action }, i) => (
                                                <button
                                                    key={i}
                                                    onClick={action}
                                                    className={`p-4 rounded-2xl ${color} flex flex-col items-center gap-2 hover:scale-105 transition-transform`}
                                                >
                                                    <Icon className="w-6 h-6" />
                                                    <span className="text-xs font-bold">{label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* FAQs */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                                {t('help_faq') || 'Frequently Asked Questions'}
                                            </h3>
                                            {faqsLoading ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                                </div>
                                            ) : faqs.length === 0 ? (
                                                <p className="text-sm text-gray-400 text-center py-4">No FAQs available</p>
                                            ) : (
                                                faqs.map((faq, i) => (
                                                    <div
                                                        key={faq.id || i}
                                                        className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden"
                                                    >
                                                        <button
                                                            onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                                                            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                        >
                                                            <span className="text-sm font-bold text-gray-900 dark:text-white pr-4">{faq.question}</span>
                                                            <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expandedFaq === i ? 'rotate-90' : ''}`} />
                                                        </button>
                                                        {expandedFaq === i && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                className="px-4 pb-4"
                                                            >
                                                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{faq.answer}</p>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Keyboard Shortcuts */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                                {t('help_shortcuts') || 'Keyboard Shortcuts'}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2">
                                                {keyboardShortcuts.map(({ key, action }, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">{action}</span>
                                                        <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-xs font-mono rounded text-gray-700 dark:text-gray-300">{key}</kbd>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            {!showTicketForm && (
                                <div className="p-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setShowTicketForm(true)}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <Bug className="w-4 h-4" />
                                        {t('help_report_issue') || 'Report an Issue'}
                                    </button>
                                    <button
                                        onClick={() => setShowTicketForm(true)}
                                        className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        {t('help_feature_request') || 'Feature Request'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default HelpCenterModal;
