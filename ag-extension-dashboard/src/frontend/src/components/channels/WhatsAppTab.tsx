import React from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export interface WhatsAppTabProps {
  whatsappForm: {
    provider: string;
    isEnabled: boolean;
    autoOnboarding: boolean;
    phoneNumber: string;
    metaPhoneNumberId: string;
    metaAccessToken: string;
    webhookVerifyToken: string;
  };
  setWhatsappForm: React.Dispatch<React.SetStateAction<WhatsAppTabProps['whatsappForm']>>;
  webhookUrl: string;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  handleSaveWhatsApp: () => void;
  isSaving: boolean;
}

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({
  whatsappForm,
  setWhatsappForm,
  webhookUrl,
  copiedKey,
  copyToClipboard,
  handleSaveWhatsApp,
  isSaving,
}) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-theme-bg-tertiary border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-sm text-slate-900 dark:text-theme-text-primary">{t('ui_whats_app_tab_meta_whatsapp_cloud_api_twilio')}</div>
            <div className="text-xs text-slate-600 dark:text-theme-text-muted">
              {t('ui_whats_app_tab_supports_rich_2_way_chats_crop_sympt')}
            </div>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={whatsappForm.isEnabled}
            onChange={e => setWhatsappForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary mb-1.5">{t('ui_whats_app_tab_whatsapp_gateway_provider')}</label>
          <select
            value={whatsappForm.provider}
            onChange={e => setWhatsappForm(prev => ({ ...prev, provider: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-theme-bg-tertiary border border-slate-900/[0.08] dark:border-white/[0.08] text-sm text-slate-900 dark:text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="meta_cloud">{t('ui_whats_app_tab_meta_whatsapp_cloud_api_official')}</option>
            <option value="twilio">{t('ui_whats_app_tab_twilio_whatsapp_sandbox')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary mb-1.5">{t('ui_whats_app_tab_business_phone_number_id')}</label>
          <input
            type="text"
            value={whatsappForm.metaPhoneNumberId}
            onChange={e => setWhatsappForm(prev => ({ ...prev, metaPhoneNumberId: e.target.value }))}
            placeholder="e.g. 1049281092830"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-theme-bg-tertiary border border-slate-900/[0.08] dark:border-white/[0.08] text-sm text-slate-900 dark:text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary mb-1.5">{t('ui_whats_app_tab_system_user_access_token')}</label>
          <input
            type="password"
            value={whatsappForm.metaAccessToken}
            onChange={e => setWhatsappForm(prev => ({ ...prev, metaAccessToken: e.target.value }))}
            placeholder="EAAG... (Permanent Token)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-theme-bg-tertiary border border-slate-900/[0.08] dark:border-white/[0.08] text-sm text-slate-900 dark:text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700 dark:text-theme-text-secondary">{t('ui_whats_app_tab_meta_webhook_callback_url')}</span>
          <button
            onClick={() => copyToClipboard(webhookUrl, 'wa_webhook')}
            className="text-xs flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-300"
          >
            {copiedKey === 'wa_webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{t('ui_telegram_tab_copy_webhook')}</span>
          </button>
        </div>
        <code className="text-xs text-emerald-700 dark:text-emerald-400 font-mono block select-all break-all">{webhookUrl}</code>
        <div className="text-xxs text-slate-600 dark:text-theme-text-muted pt-1">
          {t('ui_whats_app_tab_verify_token')} <span className="font-mono text-emerald-700 dark:text-emerald-400 font-medium">{whatsappForm.webhookVerifyToken || '(set in environment)'}</span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-100 dark:bg-theme-bg-tertiary border border-slate-900/[0.08] dark:border-white/[0.08] flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-700 dark:text-theme-text-secondary">{t('ui_whats_app_tab_1_click_client_onboarding_link')}</div>
          <div className="text-xxs text-slate-600 dark:text-theme-text-muted">
            {t('ui_whats_app_tab_share_this_direct_link_with_farmers')}
          </div>
        </div>
        <a
          href={`https://wa.me/${whatsappForm.phoneNumber.replace('+', '')}?text=HABARI`}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all"
        >
          <span>{t('ui_whats_app_tab_test_on_whatsapp')}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveWhatsApp}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-2 transition-all shadow-lg"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{t('ui_whats_app_tab_save_whatsapp_config')}</span>
        </button>
      </div>
    </div>
  );
};
