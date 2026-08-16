import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  Sparkles,
  Zap,
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
  Users
} from 'lucide-react';
import { useThemeClasses } from '@/hooks/useThemeClasses';

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
    description: 'Voice note transcription and automated speech generation for low-literacy farmers',
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

export const AccessAndCostMatrix: React.FC<AccessAndCostMatrixProps> = ({
  onSelectPlan,
  className = '',
}) => {
  const { headingClass, radiusClass } = useThemeClasses();

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
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500">
          <Check className="w-4 h-4" />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/10 text-rose-400">
          <X className="w-4 h-4" />
        </span>
      );
    }
    return <span className="font-semibold text-xs text-gray-800 dark:text-gray-200">{val}</span>;
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Zap className="w-4 h-4" />
            </span>
            <span className="text-xxs font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
              Platform Governance & Monetization
            </span>
          </div>
          <h2 className={`text-2xl md:text-3xl font-black ${headingClass}`}>
            Feature Access & Cost Matrix
          </h2>
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Detailed breakdown of tier allowances, paid service quotas, and transparent unit rates
            for SMS, LLM reasoning, WhatsApp, AI Vision, and Speech synthesis.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200 dark:border-gray-700 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold ${radiusClass} transition-all ${
              activeTab === 'matrix'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Tier Access Matrix
          </button>
          <button
            onClick={() => setActiveTab('costs')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold ${radiusClass} transition-all ${
              activeTab === 'costs'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Service Cost Matrix
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold ${radiusClass} transition-all ${
              activeTab === 'calculator'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Cost Estimator
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
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/50">
                  <th className="p-4 md:p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[40%]">
                    Platform Capability / Service
                  </th>
                  <th className="p-4 md:p-5 text-xs font-bold text-center uppercase tracking-wider w-[20%] text-gray-600 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-1">
                      <span>Free Starter</span>
                      <span className="text-xxs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-normal">
                        $0 / month
                      </span>
                    </div>
                  </th>
                  <th className="p-4 md:p-5 text-xs font-bold text-center uppercase tracking-wider w-[20%] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 border-x border-emerald-500/20">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Pro Officer</span>
                      </div>
                      <span className="text-xxs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                        $29 / month
                      </span>
                    </div>
                  </th>
                  <th className="p-4 md:p-5 text-xs font-bold text-center uppercase tracking-wider w-[20%] text-purple-600 dark:text-purple-400">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-purple-500" />
                        <span>Enterprise Org</span>
                      </div>
                      <span className="text-xxs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
                        Custom Tier
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                {MATRIX_FEATURES.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${
                        item.highlight ? 'bg-primary-500/[0.02]' : ''
                      }`}
                    >
                      <td className="p-4 md:p-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 mt-0.5 flex-shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-white text-xs md:text-sm">
                                {item.name}
                              </span>
                              <span className="text-xxs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">
                                {item.category}
                              </span>
                            </div>
                            <p className="text-xxs md:text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 md:p-5 text-center align-middle">
                        {renderValue(item.free)}
                      </td>
                      <td className="p-4 md:p-5 text-center align-middle bg-emerald-500/5 dark:bg-emerald-500/10 border-x border-emerald-500/20">
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

          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-primary-500 flex-shrink-0" />
              <p className="text-xs text-gray-600 dark:text-gray-300">
                <strong>Free tier restrictions:</strong> Paid consumable services (SMS, LLM,
                WhatsApp, AI Vision diagnostics) require an active Pro subscription to prevent API
                overuse. Knowledge Base is limited to 3 queries/day on Free.
              </p>
            </div>
            {onSelectPlan && (
              <button
                onClick={() => onSelectPlan('pro-monthly')}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade to Pro Plan
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
                  className={`p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-primary-500">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
                          ${svc.rate.toFixed(3)}
                        </span>
                        <span className="text-xxs text-gray-500 block">{svc.unit}</span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                      {svc.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                      {svc.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-stone-500">
                      <span>Free Tier Allowance:</span>
                      <span className="font-semibold text-rose-500 font-mono">0 (Locked)</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-500">
                      <span>Pro Plan Included:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {svc.proQuota} / mo
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-stone-500">
                      <span>Enterprise Quota:</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400 font-mono">
                        {svc.enterpriseQuota}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary-500/10 to-transparent border border-emerald-500/20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Pre-purchased Volume Packages Available
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                  Organizations managing over 10,000 farmers can activate dedicated Twilio / Africa’s
                  Talking carrier routes with wholesale SMS rates under $0.009/SMS.
                </p>
              </div>
              <a
                href="mailto:info@gpfed.com?subject=Enterprise%20Volume%20Inquiry"
                className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-opacity whitespace-nowrap"
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
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          {/* Sliders Area */}
          <div className="lg:col-span-7 p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-sm space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-200 dark:border-gray-800">
              <Sliders className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Monthly Usage Estimator
              </h3>
            </div>

            {/* Slider: Farmers */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-gray-700 dark:text-gray-300">
                  Target Registered Farmers
                </label>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Slider: SMS Broadcasts */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-gray-700 dark:text-gray-300">
                  Monthly SMS Broadcasts
                </label>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xxs text-gray-400 block">
                500 included with Pro. Additional: $0.018/SMS.
              </span>
            </div>

            {/* Slider: LLM Generative AI Assistant */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-gray-700 dark:text-gray-300">
                  AI Generative Assistant Reasoning Queries
                </label>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <span className="text-xxs text-gray-400 block">
                1,000 included with Pro. Additional: $0.005/chat.
              </span>
            </div>

            {/* Slider: AI Vision Scans */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-gray-700 dark:text-gray-300">
                  AI Crop & Soil Photo Diagnoses
                </label>
                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className="text-xxs text-gray-400 block">
                100 included with Pro. Additional: $0.05/scan.
              </span>
            </div>

            {/* Slider: WhatsApp Broadcasts */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-gray-700 dark:text-gray-300">
                  WhatsApp & Telegram Broadcasts
                </label>
                <span className="font-mono font-bold text-green-600 dark:text-green-400">
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <span className="text-xxs text-gray-400 block">
                500 included with Pro. Additional: $0.015/broadcast.
              </span>
            </div>
          </div>

          {/* Estimation Breakdown Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 md:p-8 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 via-white dark:via-gray-900 to-white dark:to-gray-900 shadow-xl space-y-6">
              <div>
                <span className="text-xxs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Estimated Monthly Total (Pro Tier)
                </span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
                    ${proCost.total.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">/ month</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Pro Plan Base Price:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    ${proCost.base.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Extra SMS Overage ({Math.max(0, calcSms - 500)} units):</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    ${(Math.max(0, calcSms - 500) * 0.018).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Extra AI Chats ({Math.max(0, calcAiChat - 1000)} units):</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    ${(Math.max(0, calcAiChat - 1000) * 0.005).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Extra Vision Scans ({Math.max(0, calcVision - 100)} units):</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    ${(Math.max(0, calcVision - 100) * 0.05).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span>Extra WhatsApp ({Math.max(0, calcWhatsapp - 500)} units):</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    ${(Math.max(0, calcWhatsapp - 500) * 0.015).toFixed(2)}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center font-bold text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400">Total Net Estimate:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    ${proCost.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {onSelectPlan && (
                <button
                  onClick={() => onSelectPlan('pro-monthly')}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Select Pro Plan
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
