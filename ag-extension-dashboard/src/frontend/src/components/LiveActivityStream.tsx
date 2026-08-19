import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  UserCheck,
  Radio,
  Send,
  ExternalLink,
  Smartphone,
  Flame,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export interface ActivityItem {
  id: string;
  farmerName: string;
  phone: string;
  channel: 'USSD' | 'SMS' | 'App' | 'Voice';
  language: 'EN' | 'SW' | 'FR';
  severityScore: number; // 0 - 100
  crop: string;
  region: string;
  issue: string;
  aiSummary: string;
  timestamp: string;
  isClaimed: boolean;
  claimedBy?: string;
}

const SAMPLE_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    farmerName: 'Ezekiel Kiprono',
    phone: '+254 712 998811',
    channel: 'USSD',
    language: 'SW',
    severityScore: 88,
    crop: 'Potatoes / Tomatoes',
    region: 'Nakuru, Kenya',
    issue: 'Late Blight (Phytophthora infestans)',
    aiSummary: 'Water-soaked leaf lesions spreading rapidly after heavy rain. High spore germination risk.',
    timestamp: '2m ago',
    isClaimed: false,
  },
  {
    id: 'act-2',
    farmerName: 'Grace Wambui',
    phone: '+254 722 334455',
    channel: 'SMS',
    language: 'EN',
    severityScore: 74,
    crop: 'Maize',
    region: 'Eldoret, Kenya',
    issue: 'Fall Armyworm Infestation',
    aiSummary: 'Windowpaning on whorl leaves. Larvae detected in upper canopy. Recommends Emamectin benzoate.',
    timestamp: '7m ago',
    isClaimed: false,
  },
  {
    id: 'act-3',
    farmerName: 'Jean-Luc Habimana',
    phone: '+250 788 123456',
    channel: 'App',
    language: 'FR',
    severityScore: 42,
    crop: 'Coffee / Bananas',
    region: 'Musanze, Rwanda',
    issue: 'Coffee Leaf Rust (Early Stage)',
    aiSummary: 'Isolated orange pustules under lower leaves. Recommended cultural pruning and copper fungicide.',
    timestamp: '15m ago',
    isClaimed: false,
  },
  {
    id: 'act-4',
    farmerName: 'Amina Mohamed',
    phone: '+254 733 778899',
    channel: 'USSD',
    language: 'SW',
    severityScore: 18,
    crop: 'Beans',
    region: 'Kisumu, Kenya',
    issue: 'Soil Fertilizer Routine Query',
    aiSummary: 'Inquired about top-dressing timing with CAN fertilizer 4 weeks post-germination.',
    timestamp: '28m ago',
    isClaimed: true,
    claimedBy: 'Officer Mwangi',
  },
];

interface LiveActivityStreamProps {
  cardClass?: string;
  onOpenUSSDSimulator?: () => void;
  onStartChat?: (farmerPhone: string, farmerName: string) => void;
}

export const LiveActivityStream: React.FC<LiveActivityStreamProps> = ({
  cardClass = '',
  onOpenUSSDSimulator,
  onStartChat,
}) => {
  useLanguage();
  const [activities, setActivities] = useState<ActivityItem[]>(SAMPLE_ACTIVITIES);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'moderate'>('all');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleClaim = (id: string) => {
    setActivities(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              isClaimed: true,
              claimedBy: 'You (Live Takeover)',
            }
          : item
      )
    );
    setActiveReplyId(id);
  };

  const handleRelease = (id: string) => {
    setActivities(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              isClaimed: false,
              claimedBy: undefined,
            }
          : item
      )
    );
    if (activeReplyId === id) setActiveReplyId(null);
  };

  const filtered = activities.filter(act => {
    if (filterSeverity === 'critical') return act.severityScore >= 70;
    if (filterSeverity === 'moderate') return act.severityScore < 70 && act.severityScore >= 30;
    return true;
  });

  const getScoreBadge = (score: number) => {
    if (score >= 70) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
          <Flame className="w-3 h-3 text-rose-400" />
          {score}/100
        </span>
      );
    }
    if (score >= 30) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          {score}/100
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        <Sparkles className="w-3 h-3 text-emerald-400" />
        {score}/100
      </span>
    );
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'USSD':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
            USSD
          </span>
        );
      case 'SMS':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
            SMS
          </span>
        );
      case 'App':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            APP
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono">
            VOICE
          </span>
        );
    }
  };

  return (
    <div className={`space-y-4 ${cardClass}`}>
      {/* Header with Live Status & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-gray-900 dark:text-white tracking-wide">
                Live Intelligence Stream
              </h3>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Radio className="w-2.5 h-2.5 animate-ping text-emerald-400" />
                REAL-TIME
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live farmer triage, severity scoring, and human-in-the-loop takeover
            </p>
          </div>
        </div>

        {/* Action Buttons & Filters */}
        <div className="flex items-center gap-2">
          {onOpenUSSDSimulator && (
            <button
              onClick={onOpenUSSDSimulator}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>USSD Sandbox</span>
            </button>
          )}

          <div className="flex rounded-lg bg-slate-900/60 p-0.5 border border-slate-800">
            {(['all', 'critical', 'moderate'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterSeverity(f)}
                className={`px-2 py-1 rounded text-[11px] font-bold uppercase transition-all ${
                  filterSeverity === f
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {filtered.map(activity => (
          <motion.div
            key={activity.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border transition-all relative overflow-hidden backdrop-blur-md ${
              activity.isClaimed
                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/30'
                : activity.severityScore >= 70
                ? 'bg-slate-900/90 border-rose-500/30 hover:border-rose-500/50'
                : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            {/* Top Bar: Farmer + Severity Score + Channels */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-gray-900 dark:text-white">
                  {activity.farmerName}
                </span>
                <span className="text-xs text-slate-400 font-mono">{activity.phone}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                  {activity.language}
                </span>
                {getChannelBadge(activity.channel)}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">{activity.timestamp}</span>
                {getScoreBadge(activity.severityScore)}
              </div>
            </div>

            {/* Middle Row: Crop & Issue Details */}
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

            {/* Claimed / Takeover State Banner */}
            {activity.isClaimed && (
              <div className="my-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>{activity.claimedBy}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded uppercase tracking-wider">
                    LIVE
                  </span>
                </div>
                <button
                  onClick={() => handleRelease(activity.id)}
                  className="text-[11px] text-slate-400 hover:text-rose-400 underline font-medium transition-colors"
                >
                  Release to AI Autopilot
                </button>
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-2">
              <div className="flex items-center gap-2">
                {!activity.isClaimed ? (
                  <button
                    onClick={() => handleClaim(activity.id)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-950"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Claim & Intervene
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveReplyId(activeReplyId === activity.id ? null : activity.id)}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {activeReplyId === activity.id ? 'Close Composer' : 'Direct SMS Reply'}
                  </button>
                )}

                {onStartChat && (
                  <button
                    onClick={() => onStartChat(activity.phone, activity.farmerName)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open Chat
                  </button>
                )}
              </div>

              <span className="text-[10px] text-slate-500 font-mono">ID: {activity.id}</span>
            </div>

            {/* Interactive Inline SMS Composer for Claimed Sessions */}
            <AnimatePresence>
              {activeReplyId === activity.id && (
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
                      onClick={() => {
                        if (replyText.trim()) {
                          setReplyText('');
                          setActiveReplyId(null);
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Send SMS
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
