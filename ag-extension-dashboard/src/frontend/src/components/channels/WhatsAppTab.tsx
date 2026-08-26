import React from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

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
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Meta WhatsApp Cloud API & Twilio</div>
            <div className="text-xs text-slate-400">
              Supports rich 2-way chats, crop symptom photo diagnosis, and automated voice notes
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
          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">WhatsApp Gateway Provider</label>
          <select
            value={whatsappForm.provider}
            onChange={e => setWhatsappForm(prev => ({ ...prev, provider: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="meta_cloud">Meta WhatsApp Cloud API (Official)</option>
            <option value="twilio">Twilio WhatsApp Sandbox</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Business Phone Number ID</label>
          <input
            type="text"
            value={whatsappForm.metaPhoneNumberId}
            onChange={e => setWhatsappForm(prev => ({ ...prev, metaPhoneNumberId: e.target.value }))}
            placeholder="e.g. 1049281092830"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">System User Access Token</label>
          <input
            type="password"
            value={whatsappForm.metaAccessToken}
            onChange={e => setWhatsappForm(prev => ({ ...prev, metaAccessToken: e.target.value }))}
            placeholder="EAAG... (Permanent Token)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Meta Webhook Callback URL:</span>
          <button
            onClick={() => copyToClipboard(webhookUrl, 'wa_webhook')}
            className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
          >
            {copiedKey === 'wa_webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Webhook</span>
          </button>
        </div>
        <code className="text-xs text-emerald-400 font-mono block select-all break-all">{webhookUrl}</code>
        <div className="text-xxs text-slate-400 pt-1">
          Verify Token: <span className="font-mono text-emerald-300 font-bold">{whatsappForm.webhookVerifyToken || '(set in environment)'}</span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-200">📱 1-Click Client Onboarding Link</div>
          <div className="text-xxs text-slate-400">
            Share this direct link with farmers to start automated onboarding
          </div>
        </div>
        <a
          href={`https://wa.me/${whatsappForm.phoneNumber.replace('+', '')}?text=HABARI`}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <span>Test on WhatsApp</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveWhatsApp}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>Save WhatsApp Config</span>
        </button>
      </div>
    </div>
  );
};
