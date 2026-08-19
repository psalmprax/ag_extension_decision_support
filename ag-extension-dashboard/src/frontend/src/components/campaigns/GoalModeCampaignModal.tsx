import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Zap,
  Target,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  History,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  executeGoalCampaign,
  fetchCampaignHistory,
  fetchRegionalSkills,
  synthesizeSkillFromVisit,
  CampaignHistoryItem,
  RegionalSkillCard,
  type CampaignStepTrace,
} from '@/api/campaignService';

interface GoalModeCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'launcher' | 'skills' | 'history';

const GOAL_PRESETS = [
  {
    title: '🌽 Fall Armyworm Rapid Response',
    prompt: 'Alert maize farmers in Nakuru about early-stage Fall Armyworm infestation after recent humidity rise. Advise on pheromone traps and localized bio-pesticide timing.',
    region: 'Nakuru',
    crop: 'Maize',
  },
  {
    title: '🌧️ Heavy Rain Nitrogen Leaching',
    prompt: 'Advise maize and bean farmers in Uasin Gishu regarding top-dressing fertilizer re-application following 3 consecutive days of heavy downpours.',
    region: 'Uasin Gishu',
    crop: 'Maize',
  },
  {
    title: '🥔 Potato Late Blight Prevention',
    prompt: 'Notify Irish potato growers in Nyandarua about preventive copper-based fungicide spraying before the upcoming damp overcast week.',
    region: 'Nyandarua',
    crop: 'Potato',
  },
  {
    title: '☕ Coffee Berry Borer Scouting',
    prompt: 'Dispatch pruning and sanitation guidelines to coffee farmers in Kiambu to break the Berry Borer lifecycle during cherry development.',
    region: 'Kiambu',
    crop: 'Coffee',
  },
];

export const GoalModeCampaignModal: React.FC<GoalModeCampaignModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('launcher');
  const [goalPrompt, setGoalPrompt] = useState(GOAL_PRESETS[0].prompt);
  const [targetRegion, setTargetRegion] = useState('Nakuru');
  const [targetCrop, setTargetCrop] = useState('Maize');
  const [channel, setChannel] = useState<'all' | 'sms' | 'whatsapp' | 'telegram'>('all');
  const [autoScheduleVisits, setAutoScheduleVisits] = useState(true);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTrace, setExecutionTrace] = useState<CampaignStepTrace[]>([]);
  const [campaignResultSummary, setCampaignResultSummary] = useState<string | null>(null);

  // Skills State
  const [skills, setSkills] = useState<RegionalSkillCard[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthForm, setSynthForm] = useState({
    region: 'Nakuru',
    crop: 'Maize',
    topic: 'Fall Armyworm Bio-Control',
    findings: 'Observed 15% leaf whorl damage in Rongai sub-county. Farmers applying neem extract + Pyrethrum at dusk achieved 85% larva knockdown within 48h.',
    officerNotes: 'Recommend spraying at sunset to avoid pollinator disruption. Alternate with Bacillus thuringiensis.',
  });

  // History State
  const [history, setHistory] = useState<CampaignHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadSkills = async () => {
    setIsLoadingSkills(true);
    try {
      const res = await fetchRegionalSkills();
      if (res.success && res.data) {
        setSkills(res.data);
      }
    } catch {
      toast.error('Failed to load regional agronomy skills');
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetchCampaignHistory();
      if (res.success && res.data) {
        setHistory(res.data);
      }
    } catch {
      toast.error('Failed to load campaign history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSkills();
      loadHistory();
    }
  }, [isOpen]);

  const handleApplyPreset = (preset: typeof GOAL_PRESETS[0]) => {
    setGoalPrompt(preset.prompt);
    setTargetRegion(preset.region);
    setTargetCrop(preset.crop);
    toast.success(`Loaded preset: ${preset.title}`);
  };

  const handleExecuteCampaign = async () => {
    if (!goalPrompt.trim()) {
      toast.error('Please enter a goal objective');
      return;
    }

    setIsExecuting(true);
    setExecutionTrace([
      {
        step: 'Initializing Agent',
        status: 'in_progress',
        detail: 'Connecting to multi-channel broadcast engine and agronomy intelligence core...',
        timestamp: new Date().toISOString(),
      },
    ]);
    setCampaignResultSummary(null);

    try {
      const result = await executeGoalCampaign({
        goalPrompt,
        targetRegion: targetRegion === 'all' ? undefined : targetRegion,
        targetCrop: targetCrop === 'all' ? undefined : targetCrop,
        channel,
        autoScheduleVisits,
      });

      if (result.success) {
        setExecutionTrace(result.executionTrace);
        setCampaignResultSummary(result.summary);
        toast.success('Autonomous campaign completed successfully!');
        loadHistory();
      } else {
        toast.error(result.error || 'Campaign execution failed');
      }
    } catch {
      toast.error('An error occurred during campaign execution');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSynthesizeSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSynthesizing(true);
    try {
      const res = await synthesizeSkillFromVisit({
        region: synthForm.region,
        crop: synthForm.crop,
        topic: synthForm.topic,
        findings: synthForm.findings,
        officerNotes: synthForm.officerNotes,
      });

      if (res.success && res.data) {
        toast.success(`Synthesized skill card: ${res.data.title}`);
        loadSkills();
        setSynthForm({
          region: 'Nakuru',
          crop: 'Maize',
          topic: '',
          findings: '',
          officerNotes: '',
        });
      }
    } catch {
      toast.error('Failed to synthesize skill card');
    } finally {
      setIsSynthesizing(false);
    }
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
          className="bg-slate-900 border border-slate-700/60 shadow-2xl rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Autonomous Agronomy Campaigns (Goal Mode)
                  <span className="text-xxs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Agent OS
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Closed-loop autonomous orchestration: Cohort identification, weather risk analysis, local skill injection & multi-channel dispatch
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
              onClick={() => setActiveTab('launcher')}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'launcher'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Goal Campaign Launcher</span>
            </button>

            <button
              onClick={() => setActiveTab('skills')}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'skills'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Regional Agronomy Skills ({skills.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`py-3.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Campaign Run History</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* TAB 1: LAUNCHER */}
            {activeTab === 'launcher' && (
              <div className="space-y-6">
                {/* 1-Click Goal Presets */}
                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Goal Presets</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {GOAL_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleApplyPreset(preset)}
                        className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800 hover:border-amber-500/40 text-left transition-all group"
                      >
                        <div className="font-bold text-xs text-white group-hover:text-amber-400 flex items-center justify-between">
                          <span>{preset.title}</span>
                          <span className="text-xxs px-2 py-0.5 rounded-full bg-slate-900 text-slate-400">
                            {preset.region}
                          </span>
                        </div>
                        <p className="text-xxs text-slate-400 line-clamp-2 mt-1">{preset.prompt}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Objective Input Form */}
                <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Autonomous Campaign Objective (Goal Prompt)
                    </label>
                    <textarea
                      rows={3}
                      value={goalPrompt}
                      onChange={e => setGoalPrompt(e.target.value)}
                      placeholder="Describe the high-level agricultural objective (e.g. alert maize farmers in Nakuru regarding fall armyworm after rainfall)..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Target Region</label>
                      <select
                        value={targetRegion}
                        onChange={e => setTargetRegion(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="all">All Regions</option>
                        <option value="Nakuru">Nakuru County</option>
                        <option value="Kiambu">Kiambu County</option>
                        <option value="Uasin Gishu">Uasin Gishu (Eldoret)</option>
                        <option value="Machakos">Machakos County</option>
                        <option value="Meru">Meru County</option>
                        <option value="Kilifi">Kilifi County</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Target Crop</label>
                      <select
                        value={targetCrop}
                        onChange={e => setTargetCrop(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="all">All Crops</option>
                        <option value="Maize">Maize (Corn)</option>
                        <option value="Potato">Irish Potatoes</option>
                        <option value="Coffee">Coffee</option>
                        <option value="Cassava">Cassava</option>
                        <option value="Rice">Rice</option>
                        <option value="Tea">Tea</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Dispatch Channels</label>
                      <select
                        value={channel}
                        onChange={e => setChannel(e.target.value as 'all' | 'sms' | 'whatsapp' | 'telegram')}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="all">All Channels (SMS, WhatsApp, Telegram)</option>
                        <option value="sms">SMS Only</option>
                        <option value="whatsapp">WhatsApp Only</option>
                        <option value="telegram">Telegram Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={autoScheduleVisits}
                        onChange={e => setAutoScheduleVisits(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-500"
                      />
                      <span>Auto-schedule physical field inspections for vulnerable farmers (Vital Score &lt; 65)</span>
                    </label>

                    <button
                      onClick={handleExecuteCampaign}
                      disabled={isExecuting}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-900/30 disabled:opacity-50"
                    >
                      {isExecuting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      <span>{isExecuting ? 'Agent Executing...' : 'Launch Autonomous Campaign'}</span>
                    </button>
                  </div>
                </div>

                {/* Execution Trace Live Box */}
                {(isExecuting || executionTrace.length > 0) && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${isExecuting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                        <span className="text-xs font-bold text-slate-200">Autonomous Agent Execution Trace</span>
                      </div>
                      {campaignResultSummary && (
                        <span className="text-xxs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Complete
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      {executionTrace.map((t, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="font-bold text-slate-200 flex items-center justify-between">
                              <span>{t.step}</span>
                              <span className="text-xxs text-slate-500">{new Date(t.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-slate-400 text-xxs mt-0.5">{t.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {campaignResultSummary && (
                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
                        <strong>Result:</strong> {campaignResultSummary}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: REGIONAL AGRONOMY SKILLS */}
            {activeTab === 'skills' && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Closed-Loop Agronomy Skill Cards</div>
                      <div className="text-xs text-slate-400">
                        These localized intelligence cards are continuously synthesized from verified field visits and injected into future campaign advisories
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    {skills.length} Active Skills
                  </span>
                </div>

                {/* Synthesis Form */}
                <form onSubmit={handleSynthesizeSkill} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Synthesize New Regional Skill Card</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xxs font-semibold text-slate-400 mb-1">Region / County</label>
                      <input
                        type="text"
                        value={synthForm.region}
                        onChange={e => setSynthForm({ ...synthForm, region: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xxs font-semibold text-slate-400 mb-1">Crop</label>
                      <input
                        type="text"
                        value={synthForm.crop}
                        onChange={e => setSynthForm({ ...synthForm, crop: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xxs font-semibold text-slate-400 mb-1">Topic / Pest / Disease</label>
                      <input
                        type="text"
                        value={synthForm.topic}
                        onChange={e => setSynthForm({ ...synthForm, topic: e.target.value })}
                        placeholder="e.g. Fall Armyworm Bio-Control"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xxs font-semibold text-slate-400 mb-1">Field Observations & Findings</label>
                    <textarea
                      rows={2}
                      value={synthForm.findings}
                      onChange={e => setSynthForm({ ...synthForm, findings: e.target.value })}
                      placeholder="Observed symptom progression, local weather correlations, laboratory confirmations..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xxs font-semibold text-slate-400 mb-1">Officer Recommendations & Verified Treatments</label>
                    <textarea
                      rows={2}
                      value={synthForm.officerNotes}
                      onChange={e => setSynthForm({ ...synthForm, officerNotes: e.target.value })}
                      placeholder="Validated dosage, timing, cultural control, precautions..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSynthesizing}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-amber-900/20 disabled:opacity-50"
                    >
                      {isSynthesizing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Synthesize & Store Skill</span>
                    </button>
                  </div>
                </form>

                {/* Skills Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isLoadingSkills ? (
                    <div className="col-span-full flex items-center justify-center py-10 gap-3 text-slate-400 text-sm">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                      <span>Loading regional agronomy skills...</span>
                    </div>
                  ) : (
                    skills.map(skill => (
                      <div key={skill.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-white">{skill.title}</span>
                          <span className="text-xxs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                            {Math.round(skill.confidence_score * 100)}% Conf
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xxs text-slate-400">
                          <span>📍 {skill.region}</span>
                          <span>•</span>
                          <span>🌱 {skill.crop}</span>
                          <span>•</span>
                          <span>Source: {skill.source_type}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xxs text-slate-300 whitespace-pre-line font-mono max-h-36 overflow-y-auto">
                          {skill.skill_markdown}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CAMPAIGN HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                    <span>Loading campaign audit logs...</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs">
                    No autonomous campaigns executed yet. Launch your first goal campaign from the launcher tab!
                  </div>
                ) : (
                  history.map(item => (
                    <div key={item.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          <Target className="w-4 h-4 text-amber-400" />
                          <span>{item.goal_prompt}</span>
                        </div>
                        <span className="text-xxs font-mono text-slate-400">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-amber-400 font-bold">{item.affected_farmers_count}</div>
                          <div className="text-xxs text-slate-400">Farmers Targeted</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-emerald-400 font-bold">{item.dispatched_messages_count}</div>
                          <div className="text-xxs text-slate-400">Alerts Sent</div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <div className="text-sky-400 font-bold">{item.scheduled_visits_count}</div>
                          <div className="text-xxs text-slate-400">Visits Queued</div>
                        </div>
                      </div>

                      {item.advisory_summary && (
                        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xxs text-slate-300">
                          <strong>Advisory:</strong> {item.advisory_summary}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
