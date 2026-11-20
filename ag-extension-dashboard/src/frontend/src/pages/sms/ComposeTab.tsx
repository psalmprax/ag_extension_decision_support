import React from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, XCircle, Loader2, Languages } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { smsParts } from '@/lib/smsParts';

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
  const parts = smsParts(message);
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
            <label htmlFor="sms-phone" className="text-sm text-slate-700 dark:text-slate-300">
              {t('sms_phone_label')}
            </label>
            <div className="relative group">
              <input
                id="sms-phone"
                type="tel"
                inputMode="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+254 --- --- ---"
                className={`w-full bg-white dark:bg-white/[0.03] border border-slate-900/[0.12] dark:border-white/[0.12] ${radiusClass} px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-base tabular-nums`}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="sms-recipients" className="text-sm text-slate-700 dark:text-slate-300">
              {t('sms_bulk_recipients')}
            </label>
            <textarea
              id="sms-recipients"
              value={recipients}
              onChange={e => setRecipients(e.target.value)}
              placeholder="+2541, +2542, +2543..."
              rows={3}
              className={`w-full bg-white dark:bg-white/[0.03] border border-slate-900/[0.12] dark:border-white/[0.12] ${radiusClass} px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-base tabular-nums`}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between items-center ml-1">
            <div className="flex items-center gap-2">
              <label htmlFor="sms-message" className="text-sm text-slate-700 dark:text-slate-300">
                {t('sms_message_label')}
              </label>
              <button
                onClick={handleTranslate}
                disabled={isTranslating || !message}
                className="flex items-center gap-1.5 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                {isTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
                {t('common_translate') || 'Translate'}
              </button>
            </div>
            <span aria-live="polite" className={`text-xs tabular-nums ${parts.parts > 1 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-white/60'}`}>
              {t('sms_char_parts', { count: message.length, parts: parts.parts, defaultValue: '{count} characters · {parts} SMS' })}
              {parts.unicode && ` · ${t('sms_unicode_note', { defaultValue: 'special characters make each SMS shorter' })}`}
            </span>
          </div>
          <textarea
            id="sms-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            className={`w-full bg-white dark:bg-white/[0.03] border border-slate-900/[0.12] dark:border-white/[0.12] ${radiusClass} px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-base leading-relaxed resize-none`}
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
