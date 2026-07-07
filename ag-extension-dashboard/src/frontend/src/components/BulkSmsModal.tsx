import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, Send, AlertCircle, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface BulkSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  selectedCount: number;
  isLoading?: boolean;
}

export const BulkSmsModal: React.FC<BulkSmsModalProps> = ({
  isOpen,
  onClose,
  onSend,
  selectedCount,
  isLoading = false,
}) => {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');

  const templates = [
    {
      id: 'urgent',
      text: 'URGENT: New agricultural updates for your area. Please check the USSD menu *384*100# or contact your extension officer.',
    },
    {
      id: 'meeting',
      text: 'REMINDER: Farmers group meeting tomorrow at 09:00 AM at the community center. Please attend.',
    },
    {
      id: 'survey',
      text: 'SURVEY: We are conducting a crop yield assessment. Your participation is valuable. Dial *384*100# to respond.',
    },
  ];

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Bulk SMS Composer
                    </h3>
                    <p className="text-xs font-bold text-primary-600 uppercase tracking-widest">
                      Sending to {selectedCount} farmers
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                <label className="text-xxs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Quick Templates
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {templates.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setMessage(tpl.text)}
                      className="text-left p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-500/50 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all group"
                    >
                      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                        {tpl.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xxs font-black uppercase tracking-widest text-gray-500">
                    Custom Message
                  </label>
                  <span
                    className={`text-xxs font-black tracking-widest ${message.length > 160 ? 'text-amber-500' : 'text-gray-400'}`}
                  >
                    {message.length} / 160 chars
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full h-32 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none dark:text-white"
                />
                {message.length > 160 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-xxs font-bold text-amber-700 dark:text-amber-400 leading-tight">
                      Warning: Messages over 160 characters may be split into multiple SMS.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-black text-xs uppercase tracking-widest rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all"
              >
                {t('nav_cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleSend}
                disabled={!message.trim() || isLoading}
                className="flex-[2] px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {isLoading ? 'SENDING...' : `SEND TO ${selectedCount} FARMERS`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
