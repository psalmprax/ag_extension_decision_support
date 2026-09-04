import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Layout, History, Info, Zap, Target } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import type { SMSMessage } from './types';
import { SMSComposerComposeTab } from './ComposeTab';
import { SMSComposerHistoryTab } from './HistoryTab';

export function SMSComposerPanel({
  activeTab,
  setActiveTab,
  sendMode,
  setSendMode,
  showRightPanel,
  setShowRightPanel,
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
  history,
  radiusClass,
  onOpenGateways,
  onOpenGoalMode,
}: {
  activeTab: 'compose' | 'history';
  setActiveTab: (tab: 'compose' | 'history') => void;
  sendMode: 'single' | 'bulk';
  setSendMode: (mode: 'single' | 'bulk') => void;
  showRightPanel: boolean;
  setShowRightPanel: (show: boolean) => void;
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
  history: SMSMessage[];
  radiusClass: string;
  onOpenGateways?: () => void;
  onOpenGoalMode?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="flex-1 backdrop-blur-xl bg-slate-900/60 rounded-xl border border-white/10 flex flex-col shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between p-4 border-b border-white/5 gap-3">
        <div className="flex bg-white/[0.03] border border-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'compose'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Layout className="w-3.5 h-3.5 inline-block mr-1.5" />
            {t('sms_tab_compose') || 'Compose'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 inline-block mr-1.5" />
            {t('sms_tab_history') || 'History'}
          </button>
        </div>

        {activeTab === 'compose' && (
          <div className="flex bg-white/[0.03] border border-white/5 p-1 rounded-xl">
            <button
              onClick={() => setSendMode('single')}
              className={`px-3 py-1 text-xxs font-bold uppercase tracking-wider rounded-lg transition-all ${
                sendMode === 'single'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {t('sms_single_tab') || 'Single'}
            </button>
            <button
              onClick={() => setSendMode('bulk')}
              className={`px-3 py-1 text-xxs font-bold uppercase tracking-wider rounded-lg transition-all ${
                sendMode === 'bulk'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {t('sms_bulk_tab') || 'Bulk Cohort'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mx-auto">
          <button
            type="button"
            onClick={onOpenGoalMode}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/20 transition-all shadow-sm"
            title="Launch Autonomous Agronomy Goal Campaign"
          >
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Goal Mode</span>
          </button>
          <button
            type="button"
            onClick={onOpenGateways}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all shadow-sm"
            title="Configure SMS, WhatsApp & Telegram Gateways"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Gateways</span>
          </button>
          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className="p-1.5 rounded-xl bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/10 transition-all"
            title="Toggle Sidebar"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'compose' ? (
            <SMSComposerComposeTab
              sendMode={sendMode}
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              recipients={recipients}
              setRecipients={setRecipients}
              message={message}
              setMessage={setMessage}
              isTranslating={isTranslating}
              handleTranslate={handleTranslate}
              response={response}
              error={error}
              isSending={isSending}
              handleSend={handleSend}
              radiusClass={radiusClass}
            />
          ) : (
            <SMSComposerHistoryTab history={history} radiusClass={radiusClass} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
