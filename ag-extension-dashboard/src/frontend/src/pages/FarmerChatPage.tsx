import React, { useState, useEffect } from 'react';
import { Users, Plus, Lock, MessageSquare, ArrowLeft, Trash2, Mic } from 'lucide-react';
import { Conversation, ChatMessage } from '../types/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLanguage } from '@/lib/LanguageContext';
import { useDeviceThermalMemoryBudget } from '@/hooks/useDeviceThermalMemoryBudget';
import { VirtualizedList } from '@/components/common/VirtualizedList';
import { useDemoMode } from '@/demo';
import { FarmerChatMessage } from '@/components/chat/FarmerChatMessage';
import { OfficerCopilot } from '@/components/chat/OfficerCopilot';
import { OfficerChatComposer } from '@/components/chat/OfficerChatComposer';
import { UnreadCount } from '@/components/chat/UnreadCount';
import { useAppStore } from '@/store/useAppStore';
import { useConversationRealtime } from '@/hooks/useConversationRealtime';
import { PlotTelemetryDrawer, type DetectedHazard, type HazardEvaluation } from '@/components/chat/PlotTelemetryDrawer';
import { VoiceNoteTaker } from '@/components/audio/VoiceNoteTaker';
import { fetchWeather } from '@/api/weatherService';
import apiClient from '@/api/client';
import { buildHazardDays, toPlotTelemetry, type PlotTelemetry, type WeatherForecastDay } from './farmerChatSafety';

interface FarmerChatPageProps {
  farmerConversations: Conversation[];
  activeFarmerConvId: string | null;
  setActiveFarmerConvId: (id: string | null) => void;
  loadFarmerMessages: (id: string) => void;
  farmerChatMessages: ChatMessage[];
  farmerChatInput: string;
  setFarmerChatInput: (input: string) => void;
  handleFarmerChatSend: (e: React.FormEvent) => void;
  loadFarmers: () => void;
  setShowFarmerModal: (show: boolean) => void;
  onDeleteConversation?: (id: string) => void;
}


const CHANNEL_LABELS = { all: 'All', sms: 'SMS', whatsapp: 'WhatsApp', telegram: 'Telegram' } as const;

export const FarmerChatPage: React.FC<FarmerChatPageProps> = ({
  farmerConversations,
  activeFarmerConvId,
  setActiveFarmerConvId,
  loadFarmerMessages,
  farmerChatMessages,
  farmerChatInput,
  setFarmerChatInput,
  handleFarmerChatSend,
  loadFarmers,
  setShowFarmerModal,
  onDeleteConversation,
  // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
  const { t, language } = useLanguage();
  const isFarmerUser = useAppStore(state => state.user?.role) === 'farmer';
  const { isLowEndDevice } = useDeviceThermalMemoryBudget();
  const { isDemo } = useDemoMode();
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'sms' | 'whatsapp' | 'telegram'>('all');

  const filteredConversations = selectedChannel === 'all' ? farmerConversations : farmerConversations.filter(c => {
    const ch = (c as unknown as { channel?: string; lastChannel?: string }).channel || (c as unknown as { lastChannel?: string }).lastChannel || '';
    return !ch || ch.toLowerCase() === selectedChannel;
  });

  const activeConv = farmerConversations.find(c => c.id === activeFarmerConvId);
  const activeFarmer = activeConv as unknown as { ndvi?: number; ph?: number; temperature?: number; outbreakRisk?: number } | undefined;

  const [plotState, setPlotTelemetry] = useState<PlotTelemetry>({ conversationId: null, ph: null, soc: null, moisture: null, temp: null, loading: false });
  const plotTelemetry = plotState.conversationId === activeFarmerConvId
    ? plotState : { ph: null, soc: null, moisture: null, temp: null, loading: false };
  const [showVoiceComposer, setShowVoiceComposer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPlotTelemetry({ conversationId: activeFarmerConvId, ph: null, soc: null, moisture: null, temp: null, loading: false });
    if (!activeFarmerConvId || !activeConv) return;
    const farmerId = (activeConv as unknown as { farmerId?: string }).farmerId;
    if (!farmerId) return;
    setPlotTelemetry(prev => ({ ...prev, loading: true }));
    import('@/api/soilService').then(async mod => {
      try {
        const res = await mod.fetchFarmerSoilProfile(farmerId);
        if (cancelled) return;
        setPlotTelemetry(toPlotTelemetry(activeFarmerConvId, res.data));
      } catch (error) {
        console.warn('Farmer soil profile unavailable:', error);
        if (!cancelled) setPlotTelemetry(prev => ({ ...prev, loading: false }));
      }
    }).catch(error => {
      console.warn('Farmer soil service unavailable:', error);
      if (!cancelled) setPlotTelemetry(prev => ({ ...prev, loading: false }));
    });
    return () => { cancelled = true; };
  }, [activeFarmerConvId, activeConv]);

  // Outbreak risk: evaluated from the live forecast via /pillars/hazard/evaluate.
  // Days with missing measured fields are skipped (never defaulted), and a failed
  // weather/evaluation call degrades the card instead of scoring fabricated inputs.
  const [hazardState, setHazardEval] = useState<HazardEvaluation>({ conversationId: null, status: 'idle', hazards: [] });
  const hazardEval: HazardEvaluation = hazardState.conversationId === activeFarmerConvId
    ? hazardState : { conversationId: activeFarmerConvId, status: 'idle', hazards: [] };

  useEffect(() => {
    const region = activeConv?.farmerRegion;
    if (!activeFarmerConvId || !activeConv || !region) {
      setHazardEval({ conversationId: activeFarmerConvId, status: 'idle', hazards: [] });
      return;
    }
    let cancelled = false;
    setHazardEval({ conversationId: activeFarmerConvId, status: 'loading', hazards: [] });
    (async () => {
      try {
        const weatherRes = await fetchWeather(region);
        const forecast = (weatherRes?.data?.forecast ?? []) as WeatherForecastDay[];
        const hazardDays = buildHazardDays(forecast);
        if (!hazardDays.length) throw new Error('Live forecast returned no measurable days');
        const res = await apiClient.post<{ success: boolean; data: { hazards?: DetectedHazard[] } }>(
          '/pillars/hazard/evaluate',
          { forecast: hazardDays }
        );
        if (cancelled) return;
        setHazardEval({
          conversationId: activeFarmerConvId, status: 'ready', hazards: res.data?.data?.hazards ?? [],
          evaluatedDays: hazardDays.length, totalDays: Math.min(forecast.length, 3),
        });
      } catch (err) {
        console.error('Live hazard evaluation failed:', err);
        if (cancelled) return;
        setHazardEval({ conversationId: activeFarmerConvId, status: 'unavailable', hazards: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [activeFarmerConvId, activeConv]);

  // Realtime: join the open thread's room and reload on new messages.
  const realtime = useConversationRealtime({
    conversationId: activeFarmerConvId,
    enabled: !isDemo,
    onNewMessage: loadFarmerMessages,
  });
  const socketConnected = realtime.connected;
  const typingUser = realtime.typingUser;
  const handleTyping = (value: string) => {
    setFarmerChatInput(value);
    realtime.notifyTyping();
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-150px)] md:h-[calc(100vh-140px)] gap-4 md:gap-6">
      <PageHeader
        bare
        title={t('ui_farmer_chat_page_farmer_chat')}
        description={t('chat_subtitle') || 'Messages with your farmers by SMS, WhatsApp and Telegram.'}
        actions={
          /* Live updates need the socket; without it the thread refreshes when opened. */
          <span
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-white/50"
            title={socketConnected ? undefined : t('chat_live_updates_off_hint', { defaultValue: 'New messages appear when you reopen a conversation.' })}
          >
            <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-600' : 'bg-amber-500'}`} aria-hidden="true" />
            {socketConnected
              ? t('chat_live_updates_on', { defaultValue: 'Live updates on' })
              : t('chat_live_updates_off', { defaultValue: 'Live updates off' })}
          </span>
        }
      />

      <div className="flex flex-1 gap-4 md:gap-6 overflow-hidden relative">
        {/* Left Column: Farmer Conversations Roster */}
        <div
          className={`w-full md:w-80 flex flex-col bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden ${
            activeFarmerConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-slate-900/[0.08] dark:border-white/[0.08] flex justify-between items-center">
            <div>
              <h3 className="font-medium text-sm text-slate-900 dark:text-white">{t('chat_farmer_chats') || 'Conversations'}</h3>
              <div className="text-xs text-slate-500 dark:text-white/50">{t('ui_farmer_chat_page_active_smallholders', { length: farmerConversations.length })}</div>
            </div>

            {isDemo ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 rounded-md text-xxs font-medium"
                title={t('demo_not_available') ?? 'Not available in demo version'}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t('ui_index_demo')}</span>
              </span>
            ) : (
              <button
                onClick={() => {
                  loadFarmers();
                  setShowFarmerModal(true);
                }}
                className="h-9 w-9 flex items-center justify-center rounded-md bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
                aria-label={t('common_new_conversation') || 'New conversation'}
                title={t('common_new_conversation') || 'New conversation'}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Channel Filter Strip */}
          <div className="p-2 border-b border-slate-900/[0.08] dark:border-white/[0.08] flex gap-1" role="group" aria-label={t('chat_channel_filter', { defaultValue: 'Channel' })}>
            {(['all', 'sms', 'whatsapp', 'telegram'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                aria-pressed={selectedChannel === ch}
                className={`flex-1 h-8 rounded-md text-xs transition-colors ${
                  selectedChannel === ch
                    ? 'bg-emerald-50 dark:bg-emerald-400/[0.1] text-emerald-800 dark:text-emerald-200 font-medium'
                    : 'text-slate-600 hover:text-slate-900 dark:text-white/60 dark:hover:text-white'
                }`}
              >
                {CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>

          <VirtualizedList
            items={filteredConversations}
            itemHeight={76}
            overscan={isLowEndDevice ? 2 : 5}
            keyExtractor={conv => conv.id}
            className="flex-1 p-2 space-y-1.5"
            emptyComponent={
              <div className="p-8 text-center text-slate-400 dark:text-white/40 text-xs space-y-2">
                <Users className="w-8 h-8 text-slate-300 dark:text-white/20 mx-auto" />
                <div>{t('chat_no_conversations') || 'No conversations yet'}</div>
                <div className="text-xs text-slate-400 dark:text-white/30">{t('chat_start_new_chat') || 'Click + to start'}</div>
              </div>
            }
            renderItem={conv => {
              const isSelected = activeFarmerConvId === conv.id;
              const displayName = conv.farmerName || conv.title || (conv.farmerId ? `Farmer #${conv.farmerId.slice(0, 8)}` : 'Smallholder Client');
              const initial = displayName.trim().charAt(0).toUpperCase() || 'F';
              const regionText = conv.farmerRegion;
              return (
                <div
                  key={conv.id}
                  className={`group relative flex items-center w-full rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-slate-900 dark:text-white shadow-sm'
                      : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200/70 dark:border-white/[0.04] hover:border-slate-300 dark:hover:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-slate-950/80 text-slate-700 dark:text-white/70'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveFarmerConvId(conv.id);
                      loadFarmerMessages(conv.id);
                    }}
                    className="flex-1 p-3 text-left flex items-center gap-3 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {displayName}
                        </span>
                        <UnreadCount conversationId={conv.id} className="ml-auto mr-2" />
                        <span className="text-xs text-slate-500 dark:text-white/40">
                          {(() => {
                            const rawStarted = conv.startedAt || conv.updatedAt;
                            if (!rawStarted) return '—';
                            const parsed = new Date(rawStarted);
                            return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
                          })()}
                        </span>
                      </div>
                      {regionText && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400/80 truncate">
                          {regionText}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-white/50 truncate mt-0.5 font-sans">
                        {conv.lastMessage || 'Advisory session active'}
                      </p>
                    </div>
                  </button>

                  {/* Delete Conversation Action */}
                  {onDeleteConversation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete conversation with ${displayName}?`)) {
                          onDeleteConversation(conv.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 mr-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-all border border-rose-500/20"
                      title="Delete Conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            }}
          />
        </div>

        {/* Center Column: Active Chat Thread */}
        <div
          className={`flex-1 flex flex-col backdrop-blur-xl bg-white/95 dark:bg-slate-900/70 border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-sm overflow-hidden ${
            activeFarmerConvId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeFarmerConvId && activeConv ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-3 sm:p-4 border-b border-slate-200/80 dark:border-white/[0.08] flex justify-between items-center gap-2 bg-slate-50/80 dark:bg-slate-950/40">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => setActiveFarmerConvId(null)}
                    className="md:hidden p-2 rounded-lg bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-white transition-colors mr-1"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold shrink-0">
                    {(activeConv.farmerName || activeConv.title || 'F').trim().charAt(0).toUpperCase() || 'F'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {activeConv.farmerName || activeConv.title || 'Smallholder Client'}
                    </h4>
                    <div className="flex items-center gap-2 text-xxs text-slate-500 dark:text-white/40">
                      <span>{t('ui_farmer_chat_page_1_to_1_advisory')}</span>
                      <span>•</span>
                      <span className="truncate">{activeConv?.farmerRegion || 'ACTIVE REGION'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onDeleteConversation && (
                    <button
                      onClick={() => {
                        const name = activeConv.farmerName || activeConv.title || 'this conversation';
                        if (window.confirm(`Delete conversation with ${name}?`)) {
                          onDeleteConversation(activeConv.id);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors border border-rose-500/20 flex items-center gap-1.5 text-xs"
                      title="Delete Conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('common_delete')}</span>
                    </button>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400'}`} aria-hidden="true" />
                  <span className={`text-xxs hidden lg:inline ${socketConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                    {socketConnected ? 'Live updates' : 'Updates paused'}
                  </span>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {typingUser && (
                  <div className="flex justify-start">
                    <div className="px-3 py-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300/60 dark:border-white/[0.06] text-xxs text-slate-600 dark:text-white/60">
                      {t('ui_farmer_chat_page_typing')}
                    </div>
                  </div>
                )}
                {farmerChatMessages.map((msg, i) => (
                  <FarmerChatMessage key={i} message={msg} />
                ))}
              </div>

              {/* The copilot is the officer's private tool; farmers never see it. */}
              {!isFarmerUser && activeFarmerConvId && (
                <OfficerCopilot
                  conversationId={activeFarmerConvId}
                  messages={farmerChatMessages}
                  language={language}
                  onUseText={setFarmerChatInput}
                />
              )}

              {/* Voice Note Composer for Extension Officer / Hands-free */}
              {showVoiceComposer && (
                <div className="p-3 bg-white dark:bg-slate-900/95 border-t border-emerald-500/20 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xxs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                      <Mic className="w-3 h-3" />
                      {t('ui_farmer_chat_page_multilingual_voice_dictation')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowVoiceComposer(false)}
                      className="text-slate-500 hover:text-slate-800 dark:text-white/40 dark:hover:text-white text-xxs px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      {t('common_close')}
                    </button>
                  </div>
                  <VoiceNoteTaker
                    compact
                    placeholder="Dictate field advice in Kiswahili, English, Hausa, or Chichewa..."
                    onSaveNote={transcript => {
                      setFarmerChatInput(farmerChatInput ? `${farmerChatInput} ${transcript}` : transcript);
                      setShowVoiceComposer(false);
                    }}
                  />
                </div>
              )}

              <OfficerChatComposer
                value={farmerChatInput}
                onType={handleTyping}
                clear={() => setFarmerChatInput('')}
                onSubmit={handleFarmerChatSend}
                voiceOpen={showVoiceComposer}
                toggleVoice={() => setShowVoiceComposer(prev => !prev)}
                photoTarget={activeConv?.farmerId ? { conversationId: activeConv.id, farmerId: activeConv.farmerId } : null}
                onPhotoSent={id => loadFarmerMessages(id)}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('chat_select_conversation') || 'Select a Farmer Conversation'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-white/50 max-w-xs text-center">
                {t('chat_connect_farmers') || 'Connect with smallholders across SMS, WhatsApp, and Telegram in real time.'}
              </p>
            </div>
          )}
        </div>

        {activeConv && (
          <PlotTelemetryDrawer farmer={activeFarmer} telemetry={plotTelemetry} hazardEval={hazardEval} />
        )}
      </div>
    </div>
  );
};

export default FarmerChatPage;
