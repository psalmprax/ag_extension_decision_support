import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MessageSquare,
  Smartphone,
  Bot,
  RefreshCw,
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
import { SmsTab } from './SmsTab';
import { WhatsAppTab } from './WhatsAppTab';
import { TelegramTab } from './TelegramTab';
import { SimulatorTab } from './SimulatorTab';

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

  const [testRecipient, setTestRecipient] = useState('+254712345678');
  const [verifiedBotHandle, setVerifiedBotHandle] = useState<string | null>(null);

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
        message: '🌾 Verified test message from your GPExts Decision Support Gateway!',
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
          className="bg-slate-900 border border-slate-700/60 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100"
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
