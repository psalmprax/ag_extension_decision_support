import React from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export interface TelegramTabProps {
  telegramForm: {
    isEnabled: boolean;
    autoOnboarding: boolean;
    botToken: string;
    botUsername: string;
  };
  setTelegramForm: React.Dispatch<React.SetStateAction<TelegramTabProps['telegramForm']>>;
  webhookUrl: string;
  verifiedBotHandle: string | null;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  handleVerifyTelegramBot: () => void;
  handleSaveTelegram: () => void;
  isTesting: boolean;
  isSaving: boolean;
}

export const TelegramTab: React.FC<TelegramTabProps> = ({
  telegramForm,
  setTelegramForm,
  webhookUrl,
  verifiedBotHandle,
  copiedKey,
  copyToClipboard,
  handleVerifyTelegramBot,
  handleSaveTelegram,
  isTesting,
  isSaving,
}) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-500/20 text-slate-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">{t('ui_telegram_tab_telegram_bot_gateway')}</div>
            <div className="text-xs text-slate-400">
              {t('ui_telegram_tab_zero_cost_instant_bot_messaging_for')}
            </div>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={telegramForm.isEnabled}
            onChange={e => setTelegramForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">{t('ui_telegram_tab_telegram_bot_token_from_botfather')}</label>
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-xxs text-slate-400 hover:underline flex items-center gap-1"
            >
              <span>{t('ui_telegram_tab_create_bot_via_botfather')}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={telegramForm.botToken}
              onChange={e => setTelegramForm(prev => ({ ...prev, botToken: e.target.value }))}
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-slate-500/50"
            />
            <button
              onClick={handleVerifyTelegramBot}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{t('ui_telegram_tab_verify_token')}</span>
            </button>
          </div>
          {verifiedBotHandle && (
            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {t('ui_telegram_tab_connected_to')} <strong>{verifiedBotHandle}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">{t('ui_telegram_tab_telegram_webhook_url')}</span>
          <button
            onClick={() => copyToClipboard(webhookUrl, 'tg_webhook')}
            className="text-xs flex items-center gap-1 text-slate-400 hover:text-slate-300"
          >
            {copiedKey === 'tg_webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{t('ui_telegram_tab_copy_webhook')}</span>
          </button>
        </div>
        <code className="text-xs text-slate-400 font-mono block select-all break-all">{webhookUrl}</code>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-200">{t('ui_telegram_tab_direct_bot_launch_link')}</div>
          <div className="text-xxs text-slate-400">
            {t('ui_telegram_tab_farmers_can_tap_this_link_to_launch')}
          </div>
        </div>
        <a
          href={`https://t.me/${telegramForm.botUsername}?start=onboard`}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <span>{t('ui_telegram_tab_open', { botUsername: telegramForm.botUsername })}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveTelegram}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-slate-900/30"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{t('ui_telegram_tab_save_telegram_bot_config')}</span>
        </button>
      </div>
    </div>
  );
};
