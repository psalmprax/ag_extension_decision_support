import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  Sparkles,
  Shield,
  MessageSquare,
  Bot,
  Eye,
  Mic,
  FileText,
  Key,
  Layers,
  Calculator,
  Sliders,
  DollarSign,
  Info,
  TrendingUp,
  Radio,
  Send,
  Database,
  Building2,
  Users,
} from 'lucide-react';

interface AccessAndCostMatrixProps {
  onSelectPlan?: (planId: string) => void;
  className?: string;
}

interface FeatureRow {
  category: string;
  name: string;
  description: string;
  icon: React.ElementType;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
  unitCost?: string;
  highlight?: boolean;
}

const MATRIX_FEATURES: FeatureRow[] = [
  // AI & Reasoning
  {
    category: 'AI & Intelligence',
    name: 'Knowledge Base Retrieval',
    description: 'Agronomic RAG search backed by FAO & CIMMYT indices',
    icon: Database,
    free: '3 queries / day',
    pro: 'Unlimited',
    enterprise: 'Unlimited + Custom RAG',
    unitCost: 'Free: 3/day; Pro: Included; Extra: $0.002/query',
    highlight: true,
  },
  {
    category: 'AI & Intelligence',
    name: 'AI Conversational Assistant',
    description: 'Multilingual generative agronomy assistant (Swahili, Chichewa, English)',
    icon: Bot,
    free: false,
    pro: '1,000 chats / mo',
    enterprise: 'Unlimited Dedicated Model',
    unitCost: '$0.005 per conversation',
    highlight: true,
  },
  {
    category: 'AI & Intelligence',
    name: 'Pathological AI Vision (Plant & Soil)',
    description: 'Leaf disease recognition, NPK deficit detection via computer vision',
    icon: Eye,
    free: false,
    pro: '100 scans / mo',
    enterprise: 'Unlimited + Drone Orthomosaic AI',
    unitCost: '$0.05 per high-res diagnosis scan',
    highlight: true,
  },
  {
    category: 'AI & Intelligence',
    name: 'Speech & Audio Synthesis (TTS / STT)',
    description:
      'Voice note transcription and automated speech generation for low-literacy farmers',
    icon: Mic,
    free: false,
    pro: '200 mins / mo',
    enterprise: 'Unlimited + Regional Dialect Voice AI',
    unitCost: '$0.04 per audio minute',
  },
  {
    category: 'AI & Intelligence',
    name: 'Automated Analytical Reports',
    description: 'AI-generated agronomic health, yield risk, and extension summary PDFs',
    icon: FileText,
    free: false,
    pro: '50 reports / mo',
    enterprise: 'Unlimited Scheduled Briefings',
    unitCost: '$0.25 per synthesized report',
  },

  // Communications & Broadcasting
  {
    category: 'Omnichannel Communications',
    name: 'SMS Campaigns & Field Alerts',
    description: 'Direct SMS advisory broadcast via Twilio / Africa’s Talking gateways',
    icon: MessageSquare,
    free: false,
    pro: '500 SMS / mo',
    enterprise: 'Bulk Volume (<$0.010/SMS)',
    unitCost: '$0.018 per standard SMS message',
    highlight: true,
  },
  {
    category: 'Omnichannel Communications',
    name: 'WhatsApp & Telegram Broadcast Engine',
    description: 'Interactive chat menus, rich media advisories, automated broadcast pipelines',
    icon: Send,
    free: false,
    pro: '500 broadcasts / mo',
    enterprise: 'Unlimited Interactive Menus',
    unitCost: '$0.015 per delivered broadcast',
  },

  // Core Platform & Infrastructure
  {
    category: 'Platform & Infrastructure',
    name: 'Farmer & Field Topology Registry',
    description: 'Farmer profiles, GPS boundary mapping, crop season tracking',
    icon: Users,
    free: 'Up to 25 Farmers',
    pro: 'Unlimited',
    enterprise: 'Multi-Tenant Org Partitioning',
    unitCost: 'Included in base subscription',
  },
  {
    category: 'Platform & Infrastructure',
    name: 'Offline Field Sync (PWA)',
    description: 'IndexedDB offline caching, zero-connectivity field record capture',
    icon: Radio,
    free: 'Standard',
    pro: 'Prioritized Sync',
    enterprise: 'Low-Bandwidth Satellite Relay',
  },
  {
    category: 'Platform & Infrastructure',
    name: 'Developer REST API & Webhooks',
    description: 'Programmatic API tokens, real-time webhook events, ERP integrations',
    icon: Key,
    free: false,
    pro: '10k requests / mo',
    enterprise: 'Unlimited + 99.99% SLA Dedicated IP',
    unitCost: '$0.0005 per external API request',
  },
  {
    category: 'Platform & Infrastructure',
    name: 'Audit Trail & Telemetry Logs',
    description: 'Access auditing, compliance exports, and system trace logging',
    icon: Shield,
    free: '7 days retention',
    pro: '90 days retention',
    enterprise: 'Indefinite SIEM streaming',
  },
];

const COST_BREAKDOWN_UNITS = [
  {
    id: 'sms',
    name: 'SMS Messaging (Twilio / Africa’s Talking)',
    icon: MessageSquare,
    rate: 0.018,
    unit: 'per SMS',
    freeQuota: 0,
    proQuota: 500,
    enterpriseQuota: 'Custom Bulk',
    color: 'emerald',
    description: 'Direct cellular dispatch to basic feature phones across Africa & Global.',
  },
  {
    id: 'ai_chat',
    name: 'LLM Generative Assistant Tokens',
    icon: Bot,
    rate: 0.005,
    unit: 'per reasoning query',
    freeQuota: 0,
    proQuota: 1000,
    enterpriseQuota: 'Unlimited Dedicated',
    color: 'purple',
    description: 'State-of-the-art agronomic reasoning powered by fine-tuned multi-modal LLMs.',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp / Telegram Broadcasting',
    icon: Send,
    rate: 0.015,
    unit: 'per broadcast',
    freeQuota: 0,
    proQuota: 500,
    enterpriseQuota: 'Unlimited Custom',
    color: 'green',
    description: 'Rich conversational broadcast with media attachments and interactive buttons.',
  },
  {
    id: 'ai_vision',
    name: 'AI Pathological & Soil Diagnosis',
    icon: Eye,
    rate: 0.05,
    unit: 'per photo analysis',
    freeQuota: 0,
    proQuota: 100,
    enterpriseQuota: 'Unlimited Volume',
    color: 'cyan',
    description: 'Computer vision neural classification of foliar diseases and NPK soil health.',
  },
  {
    id: 'speech',
    name: 'Speech TTS & Audio Synthesis',
    icon: Mic,
    rate: 0.04,
    unit: 'per audio minute',
    freeQuota: 0,
    proQuota: 200,
    enterpriseQuota: 'Unlimited Neural Voices',
    color: 'amber',
    description: 'Text-to-speech audio notes generated in indigenous African languages.',
  },
  {
    id: 'reports',
    name: 'Automated AI Synthesized Reports',
    icon: FileText,
    rate: 0.25,
    unit: 'per compiled PDF/Excel',
    freeQuota: 0,
    proQuota: 50,
    enterpriseQuota: 'Unlimited Enterprise',
    color: 'blue',
    description: 'Multi-source agronomic portfolio intelligence reports for NGOs and governments.',
  },
];

import { triggerHaptic } from '@/lib/haptics';

export const AccessAndCostMatrix: React.FC<AccessAndCostMatrixProps> = ({
  onSelectPlan,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'costs' | 'calculator'>('matrix');

  // Calculator State
  const [calcFarmers, setCalcFarmers] = useState(250);
  const [calcSms, setCalcSms] = useState(1000);
  const [calcAiChat, setCalcAiChat] = useState(300);
  const [calcVision, setCalcVision] = useState(50);
  const [calcWhatsapp, setCalcWhatsapp] = useState(400);

  // Calculate costs
  const calculateProTotal = () => {
    const baseProPrice = 29.0;
    const extraSms = Math.max(0, calcSms - 500) * 0.018;
    const extraAiChat = Math.max(0, calcAiChat - 1000) * 0.005;
    const extraVision = Math.max(0, calcVision - 100) * 0.05;
    const extraWhatsapp = Math.max(0, calcWhatsapp - 500) * 0.015;

    const overage = extraSms + extraAiChat + extraVision + extraWhatsapp;
    return {
      base: baseProPrice,
      overage,
      total: baseProPrice + overage,
    };
  };

  const proCost = calculateProTotal();

  const renderValue = (val: string | boolean) => {
    if (typeof val === 'boolean') {
      return val ? (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 shadow-inner">
          <Check className="w-3.5 h-3.5" />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/15 text-rose-400">
          <X className="w-3.5 h-3.5" />
        </span>
      );
    }
    return <span className="font-semibold text-xs text-slate-200">{val}</span>;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header & Mode Switcher */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
              Transparent Unit Rates
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Feature Access & Cost Matrix
          </h2>
          <p className="text-xs text-white/60 mt-0.5 max-w-2xl leading-relaxed">
            Transparent breakdown of tier quotas, unit rates, and interactive cooperative budget simulator for SMS, LLM reasoning, WhatsApp, AI Vision, and Speech synthesis.
          </p>
        </div>

        {/* Tab switcher matching VisitsPage status filter */}
        <div className="flex items-center gap-2 overflow-x-auto self-start md:self-auto relative z-10">
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('matrix');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              activeTab === 'matrix'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                : 'bg-white/[0.02] text-white/50 border-white/5 hover:border-white/15 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tier Access</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('costs');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              activeTab === 'costs'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                : 'bg-white/[0.02] text-white/50 border-white/5 hover:border-white/15 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Unit Rates</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('calculator');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              activeTab === 'calculator'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                : 'bg-white/[0.02] text-white/50 border-white/5 hover:border-white/15 hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Cost Estimator</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Tier Access Matrix */}
      {activeTab === 'matrix' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="p-4 md:p-5 text-xxs font-bold text-white/60 uppercase tracking-wider w-[40%]">
                    Platform Capability / Service
                  </th>
                  <th className="p-4 md:p-5 text-xxs font-bold text-center uppercase tracking-wider w-[20%] text-white/60">
                    <div className="flex flex-col items-center gap-1">
                      <span>Free Starter</span>
                      <span className="text-xxs px-2.5 py-0.5 rounded-full bg-white/[0.05] text-white/80 font-mono">
                        $0 / month
                      </span>
                    </div>
                  </th>
                  <th className="p-4 md:p-5 text-xxs font-bold text-center uppercase tracking-wider w-[20%] text-emerald-300 bg-emerald-500/10 border-x border-emerald-500/20">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Pro Officer</span>
                      </div>
                      <span className="text-xxs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                        $29 / month
                      </span>
                    </div>
                  </th>
                  <th className="p-4 md:p-5 text-xxs font-bold text-center uppercase tracking-wider w-[20%] text-purple-300">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>Enterprise Org</span>
                      </div>
                      <span className="text-xxs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                        Custom Tier
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {MATRIX_FEATURES.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        item.highlight ? 'bg-emerald-500/[0.02]' : ''
                      }`}
                    >
                      <td className="p-4 md:p-5">
                        <div className="flex items-start gap-3.5">
                          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-emerald-400 mt-0.5 shrink-0 shadow-inner">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs md:text-sm">
                                {item.name}
                              </span>
                              <span className="text-xxs px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/10 text-white/60 font-mono">
                                {item.category}
                              </span>
                            </div>
                            <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 md:p-5 text-center align-middle">
                        {renderValue(item.free)}
                      </td>
                      <td className="p-4 md:p-5 text-center align-middle bg-emerald-500/5 border-x border-emerald-500/20">
                        {renderValue(item.pro)}
                      </td>
                      <td className="p-4 md:p-5 text-center align-middle">
                        {renderValue(item.enterprise)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs text-white/70">
                <strong className="text-white">Free tier restrictions:</strong> Paid consumable services (SMS, LLM,
                WhatsApp, AI Vision diagnostics) require an active Pro subscription to prevent API
                overuse. Knowledge Base is limited to 3 queries/day on Free.
              </p>
            </div>
            {onSelectPlan && (
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  onSelectPlan('pro-monthly');
                }}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upgrade to Pro Plan</span>
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab 2: Service Cost Matrix */}
      {activeTab === 'costs' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COST_BREAKDOWN_UNITS.map(svc => {
              const Icon = svc.icon;
              return (
                <div
                  key={svc.id}
                  className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-xl hover:border-emerald-500/30 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-white font-mono">
                          ${svc.rate.toFixed(3)}
                        </span>
                        <span className="text-xxs text-white/50 block font-mono">{svc.unit}</span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                      {svc.name}
                    </h3>
                    <p className="text-xs text-white/60 mb-4 leading-relaxed">
                      {svc.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-white/60">
                      <span>Free Tier Allowance:</span>
                      <span className="font-semibold text-rose-400 font-mono">0 (Locked)</span>
                    </div>
                    <div className="flex justify-between items-center text-white/60">
                      <span>Pro Plan Included:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        {svc.proQuota} / mo
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-white/60">
                      <span>Enterprise Quota:</span>
                      <span className="font-semibold text-purple-400 font-mono">
                        {svc.enterpriseQuota}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Pre-purchased Volume Packages Available
                </h4>
                <p className="text-xs text-white/60 mt-1 max-w-xl leading-relaxed">
                  Organizations managing over 10,000 farmers can activate dedicated Twilio /
                  Africa’s Talking carrier routes with wholesale SMS rates under $0.009/SMS.
                </p>
              </div>
              <a
                href="mailto:info@gpfed.com?subject=Enterprise%20Volume%20Inquiry"
                onClick={() => triggerHaptic('light')}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white transition-all whitespace-nowrap shadow-lg shadow-emerald-950/40"
              >
                Inquire for Enterprise Rates
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 3: Interactive Cost Estimator */}
      {activeTab === 'calculator' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Sliders Area */}
          <div className="lg:col-span-7 p-6 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-xl space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-white/10">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                Monthly Usage Estimator & Cost Simulator
              </h3>
            </div>

            {/* Slider: Farmers */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-white/80">
                  Target Registered Farmers
                </label>
                <span className="font-mono font-bold text-emerald-400">
                  {calcFarmers.toLocaleString()} Farmers
                </span>
              </div>
              <input
                type="range"
                min={25}
                max={5000}
                step={25}
                value={calcFarmers}
                onChange={e => setCalcFarmers(Number(e.target.value))}
                className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            {/* Slider: SMS Broadcasts */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-white/80">
                  Monthly SMS Broadcasts
                </label>
                <span className="font-mono font-bold text-emerald-400">
                  {calcSms.toLocaleString()} SMS
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={10000}
                step={100}
                value={calcSms}
                onChange={e => setCalcSms(Number(e.target.value))}
                className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <span className="text-xxs text-white/40 block font-mono">
                500 included with Pro. Additional: $0.018/SMS.
              </span>
            </div>

            {/* Slider: LLM Generative AI Assistant */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-white/80">
                  AI Generative Assistant Reasoning Queries
                </label>
                <span className="font-mono font-bold text-purple-400">
                  {calcAiChat.toLocaleString()} Chats
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={calcAiChat}
                onChange={e => setCalcAiChat(Number(e.target.value))}
                className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
              <span className="text-xxs text-white/40 block font-mono">
                1,000 included with Pro. Additional: $0.005/chat.
              </span>
            </div>

            {/* Slider: AI Vision Scans */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-white/80">
                  AI Crop & Soil Photo Diagnoses
                </label>
                <span className="font-mono font-bold text-cyan-400">
                  {calcVision.toLocaleString()} Scans
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={10}
                value={calcVision}
                onChange={e => setCalcVision(Number(e.target.value))}
                className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-xxs text-white/40 block font-mono">
                100 included with Pro. Additional: $0.05/scan.
              </span>
            </div>

            {/* Slider: WhatsApp Broadcasts */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-white/80">
                  WhatsApp & Telegram Broadcasts
                </label>
                <span className="font-mono font-bold text-teal-400">
                  {calcWhatsapp.toLocaleString()} Broadcasts
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={calcWhatsapp}
                onChange={e => setCalcWhatsapp(Number(e.target.value))}
                className="w-full h-2 bg-white/[0.05] rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
              <span className="text-xxs text-white/40 block font-mono">
                500 included with Pro. Additional: $0.015/broadcast.
              </span>
            </div>
          </div>

          {/* Estimation Breakdown Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl border border-emerald-500/30 bg-slate-900/60 backdrop-blur-xl shadow-xl space-y-6 relative overflow-hidden">
              <div className="relative z-10">
                <span className="text-xxs font-bold uppercase tracking-widest text-emerald-400">
                  Estimated Monthly Total (Pro Tier)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-bold text-white font-mono tracking-tight">
                    ${proCost.total.toFixed(2)}
                  </span>
                  <span className="text-xs text-white/60 font-semibold">/ month</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs relative z-10">
                <div className="flex justify-between items-center text-white/80">
                  <span>Pro Plan Base Price:</span>
                  <span className="font-mono font-bold text-white">
                    ${proCost.base.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-white/80">
                  <span>Extra SMS ({Math.max(0, calcSms - 500)} units):</span>
                  <span className="font-mono font-bold text-white">
                    ${(Math.max(0, calcSms - 500) * 0.018).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-white/80">
                  <span>Extra AI Chats ({Math.max(0, calcAiChat - 1000)} units):</span>
                  <span className="font-mono font-bold text-white">
                    ${(Math.max(0, calcAiChat - 1000) * 0.005).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-white/80">
                  <span>Extra Vision Scans ({Math.max(0, calcVision - 100)} units):</span>
                  <span className="font-mono font-bold text-white">
                    ${(Math.max(0, calcVision - 100) * 0.05).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-white/80">
                  <span>Extra WhatsApp ({Math.max(0, calcWhatsapp - 500)} units):</span>
                  <span className="font-mono font-bold text-white">
                    ${(Math.max(0, calcWhatsapp - 500) * 0.015).toFixed(2)}
                  </span>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between items-center font-bold text-xs">
                  <span className="text-emerald-400 uppercase tracking-wider text-xxs">
                    Total Net Estimate:
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    ${proCost.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {onSelectPlan && (
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    onSelectPlan('pro-monthly');
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 relative z-10 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Select Pro Plan</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AccessAndCostMatrix;
