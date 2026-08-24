import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MessageSquare,
  Send,
  Smartphone,
  Bot,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Zap,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  fetchChannelConfigs,
  updateChannelConfig,
  testChannelDispatch,
  ChannelConfigsMap,
} from '@/api/channelService';

interface ChannelOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'sms' | 'whatsapp' | 'telegram' | 'onboarding';

function advanceSimulator(step: number, userMsg: string): { nextStep: number; botText: string; nextDefaultInput: string } {
  switch (step) {
    case 0:
      return {
        nextStep: 1,
        botText: '🌾 Welcome to the Advisory Network!\n\n👉 What is your Full Name?',
        nextDefaultInput: 'Jane Wanjiku',
      };
    case 1:
      return {
        nextStep: 2,
        botText: `Great to meet you, *${userMsg}*! 🌽\n\n👉 What is your Primary Crop? (e.g. Maize, Coffee, Cassava)`,
        nextDefaultInput: 'Maize & Beans',
      };
    case 2:
      return {
        nextStep: 3,
        botText: `Noted: *${userMsg}* 🌱\n\n👉 In which Region or County is your farm located?`,
        nextDefaultInput: 'Nakuru',
      };
    case 3:
      return {
        nextStep: 4,
        botText: `Got it: *${userMsg}* 📍\n\n👉 What is the estimated Size of your farm in hectares or acres?`,
        nextDefaultInput: '3.5 ha',
      };
    case 4:
      return {
        nextStep: 5,
        botText: `🎉 *Registration Complete!*\n\nWelcome aboard! Your Farm Profile is active for Nakuru (Maize & Beans, 3.5 ha).\n\n📱 Type *WEATHER* for forecasts or *PRICES* for market updates!`,
        nextDefaultInput: 'WEATHER',
      };
    default:
      return {
        nextStep: 6,
        botText: `🌤 *Nakuru Forecast:* 24°C, Sunny intervals. 35% chance of light afternoon showers. Optimal for top-dressing!`,
        nextDefaultInput: 'PRICES',
      };
  }
}

// -----------------------------------------------------------------------------
// TAB 1: SMS COMPONENT
// -----------------------------------------------------------------------------

interface SmsTabProps {
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

const SmsTab: React.FC<SmsTabProps> = ({
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

// -----------------------------------------------------------------------------
// TAB 2: WHATSAPP COMPONENT
// -----------------------------------------------------------------------------

interface WhatsAppTabProps {
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

const WhatsAppTab: React.FC<WhatsAppTabProps> = ({
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

// -----------------------------------------------------------------------------
// TAB 3: TELEGRAM COMPONENT
// -----------------------------------------------------------------------------

interface TelegramTabProps {
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

const TelegramTab: React.FC<TelegramTabProps> = ({
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
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Telegram Bot Gateway</div>
            <div className="text-xs text-slate-400">
              Zero-cost instant bot messaging for farmers, field workers, and community agronomy groups
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
          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">Telegram Bot Token (from @BotFather)</label>
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-xxs text-sky-400 hover:underline flex items-center gap-1"
            >
              <span>Create bot via @BotFather</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={telegramForm.botToken}
              onChange={e => setTelegramForm(prev => ({ ...prev, botToken: e.target.value }))}
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            <button
              onClick={handleVerifyTelegramBot}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Verify Token</span>
            </button>
          </div>
          {verifiedBotHandle && (
            <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Connected to <strong>{verifiedBotHandle}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Telegram Webhook URL:</span>
          <button
            onClick={() => copyToClipboard(webhookUrl, 'tg_webhook')}
            className="text-xs flex items-center gap-1 text-sky-400 hover:text-sky-300"
          >
            {copiedKey === 'tg_webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Webhook</span>
          </button>
        </div>
        <code className="text-xs text-sky-400 font-mono block select-all break-all">{webhookUrl}</code>
      </div>

      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-200">🚀 Direct Bot Launch Link</div>
          <div className="text-xxs text-slate-400">
            Farmers can tap this link to launch the automated onboarding bot directly in Telegram
          </div>
        </div>
        <a
          href={`https://t.me/${telegramForm.botUsername}?start=onboard`}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <span>Open @{telegramForm.botUsername}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveTelegram}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-sky-900/30"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>Save Telegram Bot Config</span>
        </button>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// TAB 4: ONBOARDING SIMULATOR COMPONENT
// -----------------------------------------------------------------------------

interface SimulatorTabProps {
  simulatorMessages: Array<{ sender: 'farmer' | 'bot'; text: string }>;
  simulatorInput: string;
  setSimulatorInput: (val: string) => void;
  handleSimulatorSend: () => void;
  onResetSimulator: () => void;
}

const SimulatorTab: React.FC<SimulatorTabProps> = ({
  simulatorMessages,
  simulatorInput,
  setSimulatorInput,
  handleSimulatorSend,
  onResetSimulator,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
          <Sparkles className="w-4 h-4" />
          <span>How Multi-Channel Self-Enrollment Works</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          When an unregistered farmer texts your SMS number, WhatsApp Business account, or Telegram Bot, the system
          automatically walks them through interactive conversational registration. Once finished, their profile is
          instantly added to your dashboard with real regional GPS coordinates!
        </p>
      </div>

      <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col h-80">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-300">Live Conversational Simulation</span>
          </div>
          <button
            onClick={onResetSimulator}
            className="text-xxs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Simulator</span>
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-2.5 custom-scrollbar text-xs">
          {simulatorMessages.map((m, idx) => (
            <div key={idx} className={`flex ${m.sender === 'farmer' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                  m.sender === 'farmer'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                }`}
              >
                <div className="whitespace-pre-line">{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            value={simulatorInput}
            onChange={e => setSimulatorInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSimulatorSend()}
            placeholder="Type your response..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={handleSimulatorSend}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// MAIN MODAL
// -----------------------------------------------------------------------------

function extractSmsForm(data: ChannelConfigsMap) {
  const sms = data.sms;
  return {
    provider: sms.provider || 'africas_talking',
    isEnabled: sms.isEnabled ?? true,
    autoOnboarding: sms.autoOnboarding ?? true,
    username: sms.config.africasTalkingUsername || 'sandbox',
    apiKey: sms.config.africasTalkingApiKey || '',
    senderId: sms.config.senderId || 'AG-EXTEND',
    twilioAccountSid: sms.config.twilioAccountSid || '',
    twilioPhoneNumber: sms.config.twilioPhoneNumber || '',
  };
}

function extractWhatsappForm(data: ChannelConfigsMap) {
  const wa = data.whatsapp;
  return {
    provider: wa.provider || 'meta_cloud',
    isEnabled: wa.isEnabled ?? true,
    autoOnboarding: wa.autoOnboarding ?? true,
    phoneNumber: wa.config.phoneNumber || '+14155238886',
    metaPhoneNumberId: wa.config.metaPhoneNumberId || '',
    metaAccessToken: wa.config.metaAccessToken || '',
    webhookVerifyToken: wa.config.webhookVerifyToken || '',
  };
}

function extractTelegramForm(data: ChannelConfigsMap) {
  const tg = data.telegram;
  return {
    isEnabled: tg.isEnabled ?? true,
    autoOnboarding: tg.autoOnboarding ?? true,
    botToken: tg.config.botToken || '',
    botUsername: tg.config.botUsername || 'AgExtensionBot',
  };
}

export const ChannelOnboardingModal: React.FC<ChannelOnboardingModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('sms');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [configs, setConfigs] = useState<ChannelConfigsMap | null>(null);
  const [stats, setStats] = useState({ sms: 0, whatsapp: 0, telegram: 0 });

  // Test form state
  const [testRecipient, setTestRecipient] = useState('+254712345678');
  const [verifiedBotHandle, setVerifiedBotHandle] = useState<string | null>(null);

  // Form states
  const [smsForm, setSmsForm] = useState({
    provider: 'africas_talking',
    isEnabled: true,
    autoOnboarding: true,
    username: 'sandbox',
    apiKey: '',
    senderId: 'AG-EXTEND',
    twilioAccountSid: '',
    twilioPhoneNumber: '',
  });

  const [whatsappForm, setWhatsappForm] = useState({
    provider: 'meta_cloud',
    isEnabled: true,
    autoOnboarding: true,
    phoneNumber: '+14155238886',
    metaPhoneNumberId: '',
    metaAccessToken: '',
    webhookVerifyToken: '',
  });

  const [telegramForm, setTelegramForm] = useState({
    isEnabled: true,
    autoOnboarding: true,
    botToken: '',
    botUsername: 'AgExtensionBot',
  });

  // Simulator state
  const [simulatorMessages, setSimulatorMessages] = useState<Array<{ sender: 'farmer' | 'bot'; text: string }>>([
    { sender: 'bot', text: '🌾 Welcome to Agricultural Advisory! Type START or HABARI to begin.' },
  ]);
  const [simulatorInput, setSimulatorInput] = useState('HABARI');
  const [simulatorStep, setSimulatorStep] = useState(0);

  const loadConfigs = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchChannelConfigs();
      if (res.success && res.data) {
        setConfigs(res.data);
        if (res.stats) setStats(res.stats);
        setSmsForm(extractSmsForm(res.data));
        setWhatsappForm(extractWhatsappForm(res.data));
        setTelegramForm(extractTelegramForm(res.data));
      }
    } catch {
      toast.error('Failed to load channel configurations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen, loadConfigs]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveSms = async () => {
    setIsSaving(true);
    try {
      await updateChannelConfig({
        channel: 'sms',
        provider: smsForm.provider,
        isEnabled: smsForm.isEnabled,
        autoOnboarding: smsForm.autoOnboarding,
        config: {
          africasTalkingUsername: smsForm.username,
          africasTalkingApiKey: smsForm.apiKey,
          senderId: smsForm.senderId,
          twilioAccountSid: smsForm.twilioAccountSid,
          twilioPhoneNumber: smsForm.twilioPhoneNumber,
        },
      });
      toast.success('SMS Gateway settings saved!');
      loadConfigs();
    } catch {
      toast.error('Failed to save SMS settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    setIsSaving(true);
    try {
      await updateChannelConfig({
        channel: 'whatsapp',
        provider: whatsappForm.provider,
        isEnabled: whatsappForm.isEnabled,
        autoOnboarding: whatsappForm.autoOnboarding,
        config: {
          phoneNumber: whatsappForm.phoneNumber,
          metaPhoneNumberId: whatsappForm.metaPhoneNumberId,
          metaAccessToken: whatsappForm.metaAccessToken,
          webhookVerifyToken: whatsappForm.webhookVerifyToken,
        },
      });
      toast.success('WhatsApp Gateway settings saved!');
      loadConfigs();
    } catch {
      toast.error('Failed to save WhatsApp settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTelegram = async () => {
    setIsSaving(true);
    try {
      await updateChannelConfig({
        channel: 'telegram',
        provider: 'telegram_bot',
        isEnabled: telegramForm.isEnabled,
        autoOnboarding: telegramForm.autoOnboarding,
        config: {
          botToken: telegramForm.botToken,
          botUsername: telegramForm.botUsername,
        },
      });
      toast.success('Telegram Bot settings saved!');
      loadConfigs();
    } catch {
      toast.error('Failed to save Telegram settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyTelegramBot = async () => {
    if (!telegramForm.botToken) {
      toast.error('Please enter a Telegram Bot Token first');
      return;
    }
    setIsTesting(true);
    try {
      const res = await testChannelDispatch({
        channel: 'telegram',
        botToken: telegramForm.botToken,
      });
      if (res.success && res.bot) {
        setVerifiedBotHandle(`@${res.bot.username}`);
        setTelegramForm(prev => ({ ...prev, botUsername: res.bot?.username || prev.botUsername }));
        toast.success(`Verified! Connected to @${res.bot.username}`);
      } else {
        toast.error(res.error || 'Invalid Bot Token');
      }
    } catch {
      toast.error('Failed to connect to Telegram API');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestDispatch = async (channel: 'sms') => {
    setIsTesting(true);
    try {
      if (!testRecipient) {
        toast.error('Please provide a recipient phone number');
        setIsTesting(false);
        return;
      }

      const res = await testChannelDispatch({
        channel,
        recipient: testRecipient,
        message: '🌾 Verified test message from your AgExtension Decision Support Gateway!',
      });

      if (res.success) {
        toast.success(`Test message dispatched via ${channel.toUpperCase()}!`);
      } else {
        toast.error(res.error || `Dispatch failed on ${channel.toUpperCase()}`);
      }
    } catch {
      toast.error(`Failed to send test message on ${channel}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSimulatorSend = () => {
    if (!simulatorInput.trim()) return;
    const userMsg = simulatorInput.trim();
    const advanced = advanceSimulator(simulatorStep, userMsg);
    setSimulatorMessages(prev => [
      ...prev,
      { sender: 'farmer', text: userMsg },
      { sender: 'bot', text: advanced.botText },
    ]);
    setSimulatorStep(advanced.nextStep);
    setSimulatorInput(advanced.nextDefaultInput);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={e => e.stopPropagation()}
          className="bg-slate-900 border border-slate-700/60 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Client & Farmer Channel Onboarding
                  <span className="text-xxs uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Live Hub
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Configure SMS, WhatsApp Business, and Telegram Bot gateways for automated farmer advisory
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2">
            <button
              onClick={() => setActiveTab('sms')}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'sms'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>SMS & USSD Gateway</span>
              <span className="text-xxs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {stats.sms}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'whatsapp'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Business</span>
              <span className="text-xxs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {stats.whatsapp}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('telegram')}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'telegram'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Telegram Bot</span>
              <span className="text-xxs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {stats.telegram}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('onboarding')}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'onboarding'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Auto-Enrollment Simulator</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Loading channel configurations...</span>
              </div>
            ) : null}

            {!isLoading && activeTab === 'sms' && (
              <SmsTab
                smsForm={smsForm}
                setSmsForm={setSmsForm}
                webhookUrl={configs?.sms.webhookUrl || 'https://api.gpexts.com/api/v1/sms/inbound'}
                testRecipient={testRecipient}
                setTestRecipient={setTestRecipient}
                copiedKey={copiedKey}
                copyToClipboard={copyToClipboard}
                handleTestDispatch={handleTestDispatch}
                handleSaveSms={handleSaveSms}
                isTesting={isTesting}
                isSaving={isSaving}
              />
            )}

            {!isLoading && activeTab === 'whatsapp' && (
              <WhatsAppTab
                whatsappForm={whatsappForm}
                setWhatsappForm={setWhatsappForm}
                webhookUrl={configs?.whatsapp.webhookUrl || 'https://api.gpexts.com/api/v1/whatsapp/inbound'}
                copiedKey={copiedKey}
                copyToClipboard={copyToClipboard}
                handleSaveWhatsApp={handleSaveWhatsApp}
                isSaving={isSaving}
              />
            )}

            {!isLoading && activeTab === 'telegram' && (
              <TelegramTab
                telegramForm={telegramForm}
                setTelegramForm={setTelegramForm}
                webhookUrl={
                  configs?.telegram.webhookUrl || 'https://api.gpexts.com/api/v1/channels/telegram/webhook'
                }
                verifiedBotHandle={verifiedBotHandle}
                copiedKey={copiedKey}
                copyToClipboard={copyToClipboard}
                handleVerifyTelegramBot={handleVerifyTelegramBot}
                handleSaveTelegram={handleSaveTelegram}
                isTesting={isTesting}
                isSaving={isSaving}
              />
            )}

            {!isLoading && activeTab === 'onboarding' && (
              <SimulatorTab
                simulatorMessages={simulatorMessages}
                simulatorInput={simulatorInput}
                setSimulatorInput={setSimulatorInput}
                handleSimulatorSend={handleSimulatorSend}
                onResetSimulator={() => {
                  setSimulatorMessages([
                    {
                      sender: 'bot',
                      text: '🌾 Welcome to Agricultural Advisory! Type START or HABARI to begin.',
                    },
                  ]);
                  setSimulatorStep(0);
                  setSimulatorInput('HABARI');
                }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
