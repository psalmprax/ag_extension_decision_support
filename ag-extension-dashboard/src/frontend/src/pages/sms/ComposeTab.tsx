import React from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, XCircle, Loader2, Plus, Sparkles } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';

export function SMSComposerComposeTab({
  sendMode,
  phoneNumber,
  setPhoneNumber,
  recipients,
  setRecipients,
  message,
  setMessage,
  isTranslating,
  handleTranslate,
  response,
  error,
  isSending,
  handleSend,
  radiusClass,
}: {
  sendMode: 'single' | 'bulk';
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  recipients: string;
  setRecipients: (recs: string) => void;
  message: string;
  setMessage: (msg: string) => void;
  isTranslating: boolean;
  handleTranslate: () => void;
  response: Record<string, unknown> | null;
  error: string | null;
  isSending: boolean;
  handleSend: (e: React.FormEvent) => void;
  radiusClass: string;
}) {
  const { t } = useLanguage();
  return (
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
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+254 --- --- ---"
                className={`w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 ${radiusClass} px-5 py-4 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all font-mono text-lg`}
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
              onChange={e => setRecipients(e.target.value)}
              placeholder="+2541, +2542, +2543..."
              rows={3}
              className={`w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 ${radiusClass} px-5 py-4 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono`}
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
                className="flex items-center gap-1.5 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-xxs font-bold uppercase tracking-wider hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                {isTranslating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {t('common_translate') || 'Translate'}
              </button>
            </div>
            <span
              className={`text-xxs font-bold px-2 py-0.5 rounded-full ${message.length > 150 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
            >
              {t('sms_char_count').replace('{count}', message.length.toString())}
            </span>
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="..."
            rows={6}
            className={`w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 ${radiusClass} px-5 py-4 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-lg leading-relaxed resize-none`}
          />
        </div>

        {(response || error) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${error ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'}`}
          >
            {error ? (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">
              {error || ((response?.message ?? '') as React.ReactNode)}
            </p>
          </motion.div>
        )}

        <button
          disabled={isSending || !message || (sendMode === 'single' ? !phoneNumber : !recipients)}
          onClick={handleSend}
          className={`w-full py-4 ${radiusClass} font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all ${
            isSending
              ? 'bg-slate-200 dark:bg-slate-800'
              : 'bg-primary-600 hover:bg-primary-500 text-white'
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
  );
}
