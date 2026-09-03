import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Users,
  Plus,
  Send,
  Lock,
  MessageSquare,
  Radio,
  Sparkles,
  Sprout,
  CheckCircle2,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { Conversation, ChatMessage } from '../types/dashboard';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useDeviceThermalMemoryBudget } from '@/hooks/useDeviceThermalMemoryBudget';
import { VirtualizedList } from '@/components/common/VirtualizedList';
import { useDemoMode } from '@/demo';

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

/** Map hazard evaluation to a 0–100 outbreak risk score. */
function scoreOutbreakRisk(hazards: { threatLevel: string }[]): number {
  const hasWatch = hazards.some(h => h.threatLevel === 'watch' || h.threatLevel === 'warning' || h.threatLevel === 'emergency');
  const hasEmergency = hazards.some(h => h.threatLevel === 'emergency');
  return hasEmergency ? 85 : hasWatch ? 55 : hazards.length ? 25 : 10;
}

/** Evaluate live outbreak risk for a farmer's plot from current telemetry. */
async function fetchOutbreakRisk(telemetry: { temp: number | null; moisture: number | null }, fallbackTemp: number | undefined): Promise<number> {
  const { default: apiClient } = await import('@/api/client');
  const temp = telemetry.temp ?? fallbackTemp ?? 25;
  const moisture = telemetry.moisture ?? 20;
  const rh = 75 + (moisture > 25 ? 10 : 0);
  const { data } = await apiClient.post('/pillars/hazard/evaluate', {
    forecast: [{ date: new Date().toISOString().slice(0, 10), minTempC: Math.max(8, temp - 6), maxTempC: temp + 4, precipitationMm: moisture > 30 ? 18 : 4, relativeHumidityPct: rh, windSpeedKmh: 12 }],
  });
  const rawHazards = (data as { data?: unknown })?.data ?? data;
  const hazards = Array.isArray(rawHazards) ? rawHazards as { threatLevel: string }[] : [];
  return scoreOutbreakRisk(hazards);
}

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
  const { t } = useLanguage();
  const { headingClass, btnClass } = useThemeClasses();
  const { isLowEndDevice } = useDeviceThermalMemoryBudget();
  const { isDemo } = useDemoMode();
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'sms' | 'whatsapp' | 'telegram'>('all');

  const filteredConversations = selectedChannel === 'all' ? farmerConversations : farmerConversations.filter(c => {
    const ch = (c as unknown as { channel?: string; lastChannel?: string }).channel || (c as unknown as { lastChannel?: string }).lastChannel || '';
    return !ch || ch.toLowerCase() === selectedChannel;
  });

  const activeConv = farmerConversations.find(c => c.id === activeFarmerConvId);
  const activeFarmer = activeConv as unknown as { ndvi?: number; ph?: number; temperature?: number; outbreakRisk?: number } | undefined;

  const [plotTelemetry, setPlotTelemetry] = useState<{ ph: number | null; soc: number | null; moisture: number | null; temp: number | null; loading: boolean }>({ ph: null, soc: null, moisture: null, temp: null, loading: false });
  const [liveOutbreakRisk, setLiveOutbreakRisk] = useState<number | null>(null);

  useEffect(() => {
    if (!activeFarmerConvId || !activeConv) return;
    const farmerId = (activeConv as unknown as { farmerId?: string }).farmerId;
    if (!farmerId) return;
    setPlotTelemetry(prev => ({ ...prev, loading: true }));
    import('@/api/soilService').then(async mod => {
      try {
        const res = await mod.fetchFarmerSoilProfile(farmerId);
        const baseline = res.data?.baseline as unknown as { ph?: number; organicCarbonGPerKg?: number } | null;
        const moisture = res.data?.moisture as unknown as { soilMoisture?: { avgTop9cm?: number }; soilTemperature?: { avgTop6cm?: number } } | null;
        setPlotTelemetry({
          ph: baseline?.ph ?? null,
          soc: baseline?.organicCarbonGPerKg ?? null,
          moisture: moisture?.soilMoisture?.avgTop9cm != null ? Number((moisture.soilMoisture.avgTop9cm * 100).toFixed(1)) : null,
          temp: moisture?.soilTemperature?.avgTop6cm ?? null,
          loading: false,
        });
      } catch { setPlotTelemetry(prev => ({ ...prev, loading: false })); }
    }).catch(() => setPlotTelemetry(prev => ({ ...prev, loading: false })));
  }, [activeFarmerConvId, activeConv]);

  const { temp: plotTemp, moisture: plotMoisture } = plotTelemetry;
  useEffect(() => {
    if (!activeFarmerConvId || !activeConv) { setLiveOutbreakRisk(null); return; }
    const farmerId = (activeConv as unknown as { farmerId?: string }).farmerId;
    if (!farmerId || typeof navigator !== 'undefined' && !navigator.onLine) return;
    let cancelled = false;
    fetchOutbreakRisk({ temp: plotTemp, moisture: plotMoisture }, activeFarmer?.temperature)
      .then(risk => { if (!cancelled) setLiveOutbreakRisk(risk); })
      .catch(() => { if (!cancelled) setLiveOutbreakRisk(null); });
    return () => { cancelled = true; };
  }, [activeFarmerConvId, activeConv, plotTemp, plotMoisture, activeFarmer?.temperature]);

  // AI Copilot suggestions — fetched live when conversation has context, otherwise fallback to
  // curated defaults. Re-fires when the last officer/user message changes.
  const [liveSuggestions, setLiveSuggestions] = useState<string[] | null>(null);
  const lastUserMessage = useMemo(
    () => [...farmerChatMessages].reverse().find(m => m.role === 'user' || m.role === 'officer')?.content ?? null,
    [farmerChatMessages]
  );
  const copilotSuggestions = liveSuggestions || [
    '🌾 Inspect maize leaf whorls today at sunset for early instar caterpillars.',
    '🥔 Damp overcast forecast. Apply preventive copper spray before Thursday.',
    '🌧️ 45mm rainfall recorded. Apply second split CAN top-dressing once topsoil drains.',
  ];
  useEffect(() => {
    if (!activeFarmerConvId) { setLiveSuggestions(null); return; }
    if (!lastUserMessage) return;
    import('@/api/aiService').then(async mod => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (mod as any).getChatCompletion?.([{ role: 'user', content: `Given farmer said: "${lastUserMessage.slice(0,300)}", suggest 3 short advisory follow-ups (<=15 words each), one per line, no numbering.` }], { model: 'gpt-4o-mini', maxTokens: 120 });
        const text = (res as unknown as { text?: string })?.text || (res as unknown as string) || '';
        // eslint-disable-next-line no-useless-escape
        const lines = String(text).split('\n').map(s => s.replace(/^[\d\-*\.\s]+/, '').trim()).filter(Boolean).slice(0,3);
        if (lines.length >= 2) setLiveSuggestions(lines);
      } catch { /* fallback to static */ }
    }).catch(()=>{});
  }, [activeFarmerConvId, lastUserMessage]);

  // Realtime: join the active conversation room and reload messages on new_message events.
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isDemo) return;
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: cb => cb({ token: localStorage.getItem('token') || undefined }),
    });
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('user_typing', (uid: string) => setTypingUser(uid));
    socket.on('user_stop_typing', () => setTypingUser(null));

    return () => {
      socket.removeAllListeners();
      if (socket.connected) socket.close();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [isDemo]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (activeFarmerConvId) {
      socket.emit('join_conversation', activeFarmerConvId);
    }
    const onNewMessage = (msg: unknown) => {
      const convId = (msg as { conversationId?: string } | null)?.conversationId;
      if (!convId || convId === activeFarmerConvId) {
        loadFarmerMessages(convId || activeFarmerConvId!);
      }
    };
    socket.on('new_message', onNewMessage);
    return () => {
      socket.off('new_message', onNewMessage);
    };
  }, [activeFarmerConvId, loadFarmerMessages]);

  const handleTyping = (value: string) => {
    setFarmerChatInput(value);
    const socket = socketRef.current;
    if (!socket || !activeFarmerConvId || isDemo) return;
    const userId = (JSON.parse(localStorage.getItem('user') || '{}') as { id?: string })?.id || 'me';
    socket.emit('typing', { conversationId: activeFarmerConvId, userId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId: activeFarmerConvId, userId });
    }, 900);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-150px)] md:h-[calc(100vh-140px)] gap-4 md:gap-6">
      {/* Header & Status Ribbon */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
              Multi-Channel Advisory Bridge
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold text-white tracking-tight ${headingClass}`}>
            Farmer Chat
          </h1>
          <p className="text-white/60 text-xs sm:text-sm mt-1 font-medium">
            {t('chat_subtitle') || 'Bi-directional advisory across SMS, WhatsApp, Telegram, and USSD.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md backdrop-blur-md border text-xs font-mono ${
              socketConnected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
            title={socketConnected ? 'Realtime updates connected' : 'Realtime updates unavailable — messages refresh on open'}
          >
            <Radio className={`w-3.5 h-3.5 ${socketConnected ? '' : 'opacity-60'}`} />
            <span>{socketConnected ? 'REALTIME CONNECTED' : 'REALTIME OFFLINE'}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 md:gap-6 overflow-hidden relative">
        {/* Left Column: Farmer Conversations Roster */}
        <div
          className={`w-full md:w-80 flex flex-col backdrop-blur-xl bg-slate-900/70 border border-white/[0.08] rounded-xl shadow-xl shadow-emerald-950/20 overflow-hidden ${
            activeFarmerConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-white/[0.08] flex justify-between items-center bg-slate-950/40">
            <div>
              <h3 className="font-bold text-sm text-white">{t('chat_farmer_chats') || 'Conversations'}</h3>
              <div className="text-[10px] font-mono text-white/40">{farmerConversations.length} Active Smallholders</div>
            </div>

            {isDemo ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-lg text-xxs font-bold uppercase tracking-wider"
                title={t('demo_not_available') ?? 'Not available in demo version'}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Demo</span>
              </span>
            ) : (
              <button
                onClick={() => {
                  loadFarmers();
                  setShowFarmerModal(true);
                }}
                className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md"
                title={t('common_new_conversation') || 'New Conversation'}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Channel Filter Strip */}
          <div className="p-2 border-b border-white/[0.04] flex gap-1 bg-slate-950/20">
            {(['all', 'sms', 'whatsapp', 'telegram'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
                  selectedChannel === ch
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {ch}
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
              <div className="p-8 text-center text-white/40 text-xs space-y-2">
                <Users className="w-8 h-8 text-white/20 mx-auto" />
                <div>{t('chat_no_conversations') || 'No conversations yet'}</div>
                <div className="text-[10px] text-white/30">{t('chat_start_new_chat') || 'Click + to start'}</div>
              </div>
            }
            renderItem={conv => {
              const isSelected = activeFarmerConvId === conv.id;
              const displayName = conv.farmerName || conv.title || (conv.farmerId ? `Farmer #${conv.farmerId.slice(0, 8)}` : 'Smallholder Client');
              const initial = displayName.trim().charAt(0).toUpperCase() || 'F';
              const regionText = (conv as unknown as { farmerRegion?: string }).farmerRegion;
              return (
                <div
                  key={conv.id}
                  className={`group relative flex items-center w-full rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-lg'
                      : 'bg-slate-950/40 border-white/[0.04] hover:border-white/[0.1] hover:bg-slate-950/80 text-white/70'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveFarmerConvId(conv.id);
                      loadFarmerMessages(conv.id);
                    }}
                    className="flex-1 p-3 text-left flex items-center gap-3 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-white truncate">
                          {displayName}
                        </span>
                        <span className="text-[9px] font-mono text-white/40">
                          {new Date(conv.startedAt || conv.updatedAt || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                      {regionText && (
                        <div className="text-[9px] text-emerald-400/80 font-mono truncate">
                          {regionText}
                        </div>
                      )}
                      <p className="text-[11px] text-white/50 truncate mt-0.5 font-sans">
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
                      className="opacity-0 group-hover:opacity-100 p-2 mr-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all border border-rose-500/20"
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
          className={`flex-1 flex flex-col backdrop-blur-xl bg-slate-900/70 border border-white/[0.08] rounded-xl shadow-xl shadow-emerald-950/20 overflow-hidden ${
            activeFarmerConvId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeFarmerConvId && activeConv ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-3 sm:p-4 border-b border-white/[0.08] flex justify-between items-center bg-slate-950/40">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setActiveFarmerConvId(null)}
                    className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all mr-1"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold shadow-md shadow-emerald-950/30 shrink-0">
                    {(activeConv.farmerName || activeConv.title || 'F').trim().charAt(0).toUpperCase() || 'F'}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2 truncate">
                      <span className="truncate">{activeConv.farmerName || activeConv.title || 'Smallholder Client'}</span>
                      <span className="hidden sm:inline text-[9px] font-mono uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                        SMS & WhatsApp Synced
                      </span>
                    </h4>
                    <div className="flex items-center gap-2 text-xxs text-white/40 font-mono">
                      <span>1-TO-1 ADVISORY</span>
                      <span>•</span>
                      <span className="truncate">{(activeConv as unknown as { farmerRegion?: string }).farmerRegion || 'ACTIVE REGION'}</span>
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
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all border border-rose-500/20 flex items-center gap-1.5 text-xs font-mono"
                      title="Delete Conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  )}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xxs font-mono text-emerald-400 font-bold uppercase hidden sm:inline">
                    Live Channel
                  </span>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {typingUser && (
                  <div className="flex justify-start">
                    <div className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-white/[0.06] text-[10px] font-mono text-white/60 animate-pulse">
                      Typing…
                    </div>
                  </div>
                )}
                {farmerChatMessages.map((msg, i) => {
                  const isOfficer = msg.role === 'officer';
                  return (
                    <div
                      key={i}
                      className={`flex ${isOfficer ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] p-4 rounded-xl shadow-md space-y-1.5 ${
                          isOfficer
                            ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-tr-none border border-emerald-500/40'
                            : 'backdrop-blur-md bg-slate-950/80 text-white/90 rounded-tl-none border border-white/[0.08]'
                        }`}
                      >
                        <p className="text-xs sm:text-sm leading-relaxed">{msg.content}</p>
                        <div className="flex items-center justify-between gap-3 text-[9px] font-mono text-white/50 pt-1 border-t border-white/[0.08]">
                          <span>{isOfficer ? 'OFFICER DISPATCH' : 'FARMER INCOMING'}</span>
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Copilot Suggestion Bar */}
              <div className="px-4 py-2 bg-slate-950/60 border-t border-white/[0.04] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Copilot Verified Advisory Suggestions:</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {copilotSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFarmerChatInput(sug)}
                      className="px-2.5 py-1 rounded-lg text-xxs font-sans bg-slate-900 border border-white/[0.08] hover:border-emerald-500/40 text-white/70 hover:text-white shrink-0 transition-all text-left max-w-xs truncate"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Form */}
              <form
                onSubmit={handleFarmerChatSend}
                className="p-4 bg-slate-950/80 border-t border-white/[0.08]"
              >
                <div className="relative flex items-center gap-3">
                  <input
                    type="text"
                    value={farmerChatInput}
                    onChange={e => handleTyping(e.target.value)}
                    placeholder={t('farmer_chat_placeholder') || 'Type agronomic guidance or broadcast prompt...'}
                    className="flex-1 bg-slate-900 border border-white/[0.1] rounded-xl px-4 py-3 text-xs text-white placeholder-white/40 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!farmerChatInput.trim()}
                    className={`p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-40 ${btnClass}`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <div className="w-16 h-16 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">
                {t('chat_select_conversation') || 'Select a Farmer Conversation'}
              </h3>
              <p className="text-xs text-white/50 max-w-xs text-center">
                {t('chat_connect_farmers') || 'Connect with smallholders across SMS, WhatsApp, and Telegram in real time.'}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Farmer Mini Telemetry Drawer (Bento Style) */}
        {activeConv && (
          <div className="hidden xl:flex w-72 flex-col backdrop-blur-xl bg-slate-900/70 border border-white/[0.08] rounded-xl p-5 shadow-xl shadow-emerald-950/20 space-y-4 overflow-y-auto">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sprout className="w-4 h-4" />
              <span>Plot Telemetry</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-1">
              <div className="text-[10px] font-mono text-white/40">NDVI CANOPY VIGOR</div>
              <div className="text-base font-bold text-emerald-400">{activeFarmer?.ndvi ? `${activeFarmer.ndvi.toFixed(2)}` : '—'} {activeFarmer?.ndvi ? (activeFarmer.ndvi > 0.6 ? '(Optimal)' : activeFarmer.ndvi > 0.3 ? '(Moderate)' : '(Low)') : ''}</div>
              <div className="text-[9px] text-white/40">Sentinel-2 Multispectral — add field polygon for NDVI</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-1">
              <div className="text-[10px] font-mono text-white/40">SOIL pH & CARBON</div>
              <div className="text-base font-bold text-amber-400">{plotTelemetry.loading ? '…' : plotTelemetry.ph != null ? `${plotTelemetry.ph.toFixed(1)} pH / ${plotTelemetry.soc ?? '—'} g/kg SOC` : activeFarmer?.ph ? `${activeFarmer.ph.toFixed(1)} pH` : '—'}</div>
              <div className="text-[9px] text-white/40">ISRIC SoilGrids 250m {plotTelemetry.ph != null ? '• live' : activeFarmer?.ph ? '• cached' : '• no farmer geo'}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-1">
              <div className="text-[10px] font-mono text-white/40">NASA POWER WEATHER</div>
              <div className="text-base font-bold text-sky-400">{plotTelemetry.temp != null ? `${plotTelemetry.temp}°C` : plotTelemetry.moisture != null ? `${plotTelemetry.moisture}% VWC` : activeFarmer?.temperature ? `${activeFarmer.temperature}°C` : '—'}</div>
              <div className="text-[9px] text-white/40">Open-Meteo modeled {plotTelemetry.temp != null ? '• live' : '• no geo'}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/[0.06] space-y-1">
              <div className="text-[10px] font-mono text-white/40">OUTBREAK RISK</div>
              <div className="text-base font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{liveOutbreakRisk != null ? `${liveOutbreakRisk}%` : activeFarmer?.outbreakRisk !== undefined ? `${activeFarmer.outbreakRisk}%` : '—'}</span>
                {liveOutbreakRisk != null && <span className="text-[9px] font-mono text-emerald-300 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">LIVE</span>}
              </div>
              <div className="text-[9px] text-white/40">Pillar hazard model {liveOutbreakRisk != null ? '• live' : '• needs scouting'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmerChatPage;
