import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  MessageSquare,
  UserCheck,
  Radio,
  Send,
  ExternalLink,
  Smartphone,
  Flame,
  Video,
  X,
  Calendar,
  Loader2,
  Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { JourneyBreadcrumbs, JourneyStep } from './JourneyBreadcrumbs';
import { InlineVisitBookingCard } from './InlineVisitBookingCard';
import { VideoCall } from './VideoCall';
import { useAppStore } from '@/store/useAppStore';
import apiClient from '@/api/client';
import { useDemoMode, DEMO_ACTIVITIES } from '@/demo';

export interface ActivityItem {
  id: string;
  farmerName: string;
  phone: string;
  channel: 'USSD' | 'SMS' | 'App' | 'Voice';
  language: 'EN' | 'SW' | 'FR';
  severityScore: number;
  crop: string;
  region: string;
  issue: string;
  aiSummary: string;
  timestamp: string;
  isClaimed: boolean;
  claimedBy?: string;
  journeySteps: JourneyStep[];
}

interface LiveActivityStreamProps {
  cardClass?: string;
  onOpenUSSDSimulator?: () => void;
  onStartChat?: (farmerPhone: string, farmerName: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

function getScoreBadge(score: number) {
  if (score >= 70) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
        <Flame className="w-3 h-3 text-rose-400" />
        {score}/100
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
      <Flame className="w-3 h-3 text-amber-400" />
      {score}/100
    </span>
  );
}

function getChannelBadge(channel: string) {
  switch (channel) {
    case 'USSD':
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">USSD</span>
      );
    case 'SMS':
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">SMS</span>
      );
    case 'App':
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">APP</span>
      );
    default:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono">VOICE</span>
      );
  }
}

type FilterSeverity = 'all' | 'critical' | 'moderate';

// ── Sub-components ──────────────────────────────────────────────────

const TriageFilterBar: React.FC<{
  filterSeverity: FilterSeverity;
  setFilterSeverity: (f: FilterSeverity) => void;
  sortByUrgency: boolean;
  onToggleUrgency: () => void;
  onOpenUSSDSimulator?: () => void;
}> = ({ filterSeverity, setFilterSeverity, sortByUrgency, onToggleUrgency, onOpenUSSDSimulator }) => (
  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
    {onOpenUSSDSimulator && (
      <button
        onClick={onOpenUSSDSimulator}
        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>USSD Sandbox</span>
      </button>
    )}
    <button
      onClick={onToggleUrgency}
      title="Toggle Urgency Heat Ranking"
      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all active:scale-95 ${
        sortByUrgency ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-sm' : 'bg-slate-900 text-slate-400 border-slate-800'
      }`}
    >
      <Flame className="w-3.5 h-3.5" />
      <span>Urgency Heat</span>
    </button>
    <div className="flex rounded-lg bg-slate-900/60 p-0.5 border border-slate-800">
      {(['all', 'critical', 'moderate'] as const).map(f => (
        <button
          key={f}
          onClick={() => setFilterSeverity(f)}
          className={`px-2 py-1 rounded text-[11px] font-bold uppercase transition-all ${
            filterSeverity === f ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  </div>
);

interface ActivityCardProps {
  activity: ActivityItem;
  onClaim: (id: string) => void;
  onRelease: (id: string) => void;
  startCall: (a: { farmerName: string; phone: string; issue: string }) => void;
  startChat?: (phone: string, name: string) => void;
  replyId: string | null;
  replyText: string;
  setReplyText: (t: string) => void;
  sendingSms: boolean;
  sendSms: (phone: string, msg: string) => void;
  bookingId: string | null;
  toggleBooking: (id: string) => void;
}

const ActivityCard: React.FC<ActivityCardProps> = React.memo(({
  activity, onClaim, onRelease, startCall, startChat,
  replyId, replyText, setReplyText, sendingSms, sendSms,
  bookingId, toggleBooking,
}) => {
  const isCritical = activity.severityScore >= 70;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border transition-all relative overflow-hidden backdrop-blur-md ${
        activity.isClaimed
          ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
          : isCritical
          ? 'bg-slate-900/90 border-rose-500/30 hover:border-rose-500/50 shadow-md shadow-rose-950/20'
          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-gray-900 dark:text-white">{activity.farmerName}</span>
          <span className="text-xs text-slate-400 font-mono">{activity.phone}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">{activity.language}</span>
          {getChannelBadge(activity.channel)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{activity.timestamp}</span>
          {getScoreBadge(activity.severityScore)}
        </div>
      </div>

      <JourneyBreadcrumbs steps={activity.journeySteps} className="mb-2" />

      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-emerald-400">{activity.crop}</span>
          <span className="text-xs text-slate-500">•</span>
          <span className="text-xs text-slate-300">{activity.region}</span>
        </div>
        <p className="text-xs font-medium text-slate-200">
          <span className="text-rose-400 font-bold">{activity.issue}:</span> {activity.aiSummary}
        </p>
      </div>

      {activity.isClaimed && (
        <div className="my-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>{activity.claimedBy}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded uppercase tracking-wider">LIVE</span>
          </div>
          <button onClick={() => onRelease(activity.id)} className="text-[11px] text-slate-400 hover:text-rose-400 underline font-medium transition-colors">
            Release to AI Autopilot
          </button>
        </div>
      )}

      {bookingId === activity.id && (
        <div className="my-2.5">
          <InlineVisitBookingCard
            farmerName={activity.farmerName}
            farmerPhone={activity.phone}
            issue={activity.issue}
            region={activity.region}
            onBooked={() => setTimeout(() => toggleBooking(bookingId), 1800)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 mt-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {!activity.isClaimed ? (
            <button
              onClick={() => onClaim(activity.id)}
              className="px-2.5 sm:px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-950 shrink-0"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Claim &amp; Intervene
            </button>
          ) : (
            <button
              onClick={() => setReplyText(replyId === activity.id ? '' : (replyText || ''))}
              className="px-2.5 sm:px-3 py-1 bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {replyId === activity.id ? 'Close Composer' : 'Direct SMS Reply'}
            </button>
          )}

          <button
            onClick={() => startCall({ farmerName: activity.farmerName, phone: activity.phone, issue: activity.issue })}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
          >
            <Video className="w-3.5 h-3.5 text-emerald-400" />
            Tele-Call
          </button>

          {isCritical && (
            <button
              onClick={() => toggleBooking(activity.id)}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] border border-amber-500/30 text-amber-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Dispatch Visit
            </button>
          )}

          {startChat && (
            <button
              onClick={() => startChat(activity.phone, activity.farmerName)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
              Chat View
            </button>
          )}
        </div>
        <span className="text-[10px] text-slate-500 font-mono">ID: {activity.id}</span>
      </div>

      <AnimatePresence>
        {replyId === activity.id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-slate-800"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Direct message to ${activity.farmerName} (${activity.phone})...`}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                disabled={sendingSms}
                onClick={() => sendSms(activity.phone, replyText)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                {sendingSms ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {sendingSms ? 'Sending...' : 'Send SMS'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

const TeleCallModal: React.FC<{
  call: { farmerName: string; phone: string; issue: string };
  onClose: () => void;
}> = ({ call, onClose }) => {
  const storeUser = useAppStore(s => s.user);
  const roomId = `tele-${call.phone.replace(/\D/g, '')}`;

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/tele-call/${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied — share it with the farmer to join this call.');
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-950 border border-emerald-500/40 rounded-xl shadow-2xl"
      >
        <div className="flex justify-between items-center px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Tele-Agronomy Video Consultation</h4>
              <p className="text-xs text-slate-400">Live with {call.farmerName} ({call.phone})</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={copyInviteLink}
              aria-label="Copy invite link"
              title="Copy invite link to share with the farmer"
              className="p-1 rounded-lg hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Close tele-call"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[80vh]">
          <VideoCall
            roomId={roomId}
            userId={(storeUser as { userId?: string } | null | undefined)?.userId || 'unknown'}
            userName={`${storeUser?.firstName} ${storeUser?.lastName}` || 'Extension Officer'}
            isHost={true}
            onEnd={onClose}
          />
        </div>
      </motion.div>
    </div>
  );
};

async function sendActivitySms(phone: string, message: string): Promise<void> {
  const { data } = await apiClient.post<{ success: boolean; error?: string }>('/sms/send', {
    phoneNumbers: [phone],
    message,
  });
  if (!data.success) throw new Error(data.error || 'SMS provider rejected the message');
}

// ── Main Component ───────────────────────────────────────────────────

export const LiveActivityStream: React.FC<LiveActivityStreamProps> = ({
  cardClass = '',
  onOpenUSSDSimulator,
  onStartChat,
}) => {
  const { isDemo } = useDemoMode();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [showBookingId, setShowBookingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [activeVideoCall, setActiveVideoCall] = useState<{ farmerName: string; phone: string; issue: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    if (isDemo) {
      setActivities(DEMO_ACTIVITIES as ActivityItem[]);
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await apiClient.get<{ success: boolean; data: ActivityItem[] }>('/activities/triage');
      if (data.success) setActivities(data.data);
    } catch { /* keep existing data */ }
    finally { setIsLoading(false); }
  }, [isDemo]);

  useEffect(() => {
    fetchActivities();
    if (isDemo) return;
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities, isDemo]);

  const handleSendSms = useCallback(async (phone: string, message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sendingSms) return;
    setSendingSms(true);
    try {
      await sendActivitySms(phone, trimmedMessage);
      toast.success(`SMS sent to ${phone}`);
      setReplyText('');
      setActiveReplyId(null);
    } catch {
      toast.error('Failed to send SMS. Please try again.');
    } finally {
      setSendingSms(false);
    }
  }, [sendingSms]);

  const handleClaim = useCallback((id: string) => {
    setActivities(prev => prev.map(item => item.id === id ? { ...item, isClaimed: true, claimedBy: 'You' } : item));
  }, []);

  const handleRelease = useCallback((id: string) => {
    setActivities(prev => prev.map(item => item.id === id ? { ...item, isClaimed: false, claimedBy: undefined } : item));
    if (activeReplyId === id) setActiveReplyId(null);
  }, [activeReplyId]);

  const toggleBooking = useCallback((id: string) => {
    setShowBookingId(prev => prev === id ? null : id);
  }, []);

  const filtered = useMemo(() =>
    activities
      .filter(act => {
        if (filterSeverity === 'critical') return act.severityScore >= 70;
        if (filterSeverity === 'moderate') return act.severityScore < 70 && act.severityScore >= 30;
        return true;
      })
      .sort((a, b) => (sortByUrgency ? b.severityScore - a.severityScore : 0)),
    [activities, filterSeverity, sortByUrgency]
  );

  const hasData = activities.length > 0;

  return (
    <div className={`space-y-4 ${cardClass} p-4 sm:p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white tracking-wide">
                Live Intelligence Stream
              </h3>
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${hasData ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                <Radio className={`w-2.5 h-2.5 ${hasData ? 'animate-ping text-emerald-400' : 'text-amber-400'}`} />
                {hasData ? 'LIVE' : 'IDLE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live farmer triage, journey breadcrumbs, and 1-click tele-agronomy handoff
            </p>
          </div>
        </div>

        <TriageFilterBar
          filterSeverity={filterSeverity}
          setFilterSeverity={setFilterSeverity}
          sortByUrgency={sortByUrgency}
          onToggleUrgency={() => setSortByUrgency(v => !v)}
          onOpenUSSDSimulator={onOpenUSSDSimulator}
        />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="w-8 h-8 text-slate-500 mb-2" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Awaiting events</p>
            <p className="text-xs text-slate-500 mt-1">
              Real farmer SMS, USSD, and app activity will appear here automatically as it arrives.
            </p>
          </div>
        ) : (
          filtered.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClaim={handleClaim}
              onRelease={handleRelease}
              startCall={setActiveVideoCall}
              startChat={onStartChat}
              replyId={activeReplyId}
              replyText={replyText}
              setReplyText={setReplyText}
              sendingSms={sendingSms}
              sendSms={handleSendSms}
              bookingId={showBookingId}
              toggleBooking={toggleBooking}
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {activeVideoCall && (
          <TeleCallModal call={activeVideoCall} onClose={() => setActiveVideoCall(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

LiveActivityStream.displayName = 'LiveActivityStream';

export default LiveActivityStream;