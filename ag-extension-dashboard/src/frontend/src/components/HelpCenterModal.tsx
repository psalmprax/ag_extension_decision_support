import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle, Book, MessageSquare, Mail, ExternalLink, ChevronRight, Bug } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';

interface HelpCenterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const faqs = [
    {
        question: 'How do I register a new farmer?',
        answer: 'Navigate to "Register Farmer" in the sidebar. Fill in the farmer\'s details including name, phone, location, and crops. You can also use the "Detect Location" button to auto-fill GPS coordinates.',
    },
    {
        question: 'How does the AI Advisor work?',
        answer: 'The AI Advisor uses RAG (Retrieval-Augmented Generation) to search the knowledge base and provide contextual agricultural advice. Simply type your question in the Knowledge Search tab.',
    },
    {
        question: 'How do I schedule a farm visit?',
        answer: 'Go to the "Visits" tab and click "Schedule New Visit". Select a farmer, choose the visit type, set the date/time, and add optional notes.',
    },
    {
        question: 'How do I send SMS to farmers?',
        answer: 'Navigate to the SMS section from the sidebar. You can send individual messages or bulk SMS. Select contacts from the farmer list, compose your message, and hit Send.',
    },
    {
        question: 'How do I export farmer data?',
        answer: 'In the Farmer Portfolio view, select the farmers you want to export using checkboxes, then click "Export CSV". You can also right-click on a farmer for context menu options.',
    },
    {
        question: 'How does offline mode work?',
        answer: 'The browser extension supports offline operation. Actions are queued and synced when connectivity is restored. The dashboard shows your online/offline status in the header.',
    },
];

export const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const setActiveTab = useAppStore((s) => s.setActiveTab);
    const [expandedFaq, setExpandedFaq] = React.useState<number | null>(null);

    const quickLinks = [
        { icon: Book, label: t('help_docs') || 'Documentation', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', action: () => { onClose(); setActiveTab('knowledge'); } },
        { icon: MessageSquare, label: t('help_chat') || 'Live Chat', color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400', action: () => { onClose(); setActiveTab('aiassistant'); } },
        { icon: Mail, label: t('help_email') || 'Email Support', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400', action: () => { window.open('mailto:support@agextension.org', '_blank'); } },
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
                                    {faqs.map((faq, i) => (
                                        <div
                                            key={i}
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
                                    ))}
                                </div>

                                {/* Keyboard shortcuts are registered globally in App.tsx */}
                                {/* Keyboard Shortcuts */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                        {t('help_shortcuts') || 'Keyboard Shortcuts'}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'Ctrl + K', action: 'Global Search' },
                                            { key: 'Ctrl + B', action: 'Toggle Sidebar' },
                                            { key: 'Esc', action: 'Close Modal' },
                                        ].map(({ key, action }, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">{action}</span>
                                                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-xs font-mono rounded text-gray-700 dark:text-gray-300">{key}</kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-2">
                                <a
                                    href="mailto:support@agextension.org?subject=Issue%20Report%20-%20Ag%20Extension%20Dashboard"
                                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Bug className="w-4 h-4" />
                                    {t('help_report_issue') || 'Report an Issue'}
                                </a>
                                <a
                                    href="mailto:support@agextension.org?subject=Feature%20Request%20-%20Ag%20Extension%20Dashboard"
                                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {t('help_feature_request') || 'Feature Request'}
                                </a>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default HelpCenterModal;
