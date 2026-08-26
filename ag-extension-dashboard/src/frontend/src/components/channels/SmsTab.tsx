import React from 'react';
import {
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Send,
} from 'lucide-react';

export interface SmsTabProps {
  smsForm: {
    provider: string;
    isEnabled: boolean;
    autoOnboarding: boolean;
    username: string;
    apiKey: string;
    senderId: string;
    twilioAccountSid: string;
    twilioPhoneNumber: string;
  };
  setSmsForm: React.Dispatch<React.SetStateAction<SmsTabProps['smsForm']>>;
  webhookUrl: string;
  testRecipient: string;
  setTestRecipient: (val: string) => void;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  handleTestDispatch: (channel: 'sms') => void;
  handleSaveSms: () => void;
  isTesting: boolean;
  isSaving: boolean;
}

export const SmsTab: React.FC<SmsTabProps> = ({
  smsForm,
  setSmsForm,
  webhookUrl,
  testRecipient,
  setTestRecipient,
  copiedKey,
  copyToClipboard,
  handleTestDispatch,
  handleSaveSms,
  isTesting,
  isSaving,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Africa's Talking & Twilio SMS Gateways</div>
            <div className="text-xs text-slate-400">
              Provides 2-way SMS advisory, USSD menu dialers (*384#), and bulk regional alerts
            </div>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={smsForm.isEnabled}
            onChange={e => setSmsForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">SMS Provider Selection</label>
          <select
            value={smsForm.provider}
            onChange={e => setSmsForm(prev => ({ ...prev, provider: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="africas_talking">Africa's Talking (East Africa Standard)</option>
            <option value="twilio">Twilio SMS (Global Telecom)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Sender ID / Shortcode</label>
          <input
            type="text"
            value={smsForm.senderId}
            onChange={e => setSmsForm(prev => ({ ...prev, senderId: e.target.value }))}
            placeholder="e.g. AG-EXTEND or 384"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {smsForm.provider === 'africas_talking' ? (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Africa's Talking Username</label>
              <input
                type="text"
                value={smsForm.username}
                onChange={e => setSmsForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="sandbox or production username"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Africa's Talking API Key</label>
              <input
                type="password"
                value={smsForm.apiKey}
                onChange={e => setSmsForm(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter API Key"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Twilio Account SID</label>
              <input
                type="text"
                value={smsForm.twilioAccountSid}
                onChange={e => setSmsForm(prev => ({ ...prev, twilioAccountSid: e.target.value }))}
                placeholder="ACxxxxxxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Twilio Phone Number</label>
              <input
                type="text"
                value={smsForm.twilioPhoneNumber}
                onChange={e => setSmsForm(prev => ({ ...prev, twilioPhoneNumber: e.target.value }))}
                placeholder="+1234567890"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </>
        )}
      </div>

      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-300">Inbound SMS & USSD Webhook URL:</span>
          <button
            onClick={() => copyToClipboard(webhookUrl, 'sms_webhook')}
            className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
          >
            {copiedKey === 'sms_webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'sms_webhook' ? 'Copied' : 'Copy Webhook'}</span>
          </button>
        </div>
        <code className="text-xs text-emerald-400 font-mono select-all break-all">{webhookUrl}</code>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 space-y-3">
        <div className="text-xs font-bold text-slate-200">🧪 Live SMS Dispatch Tester</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={testRecipient}
            onChange={e => setTestRecipient(e.target.value)}
            placeholder="+254712345678"
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
          />
          <button
            onClick={() => handleTestDispatch('sms')}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Send Test SMS</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveSms}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>Save SMS Gateway Config</span>
        </button>
      </div>
    </div>
  );
};
