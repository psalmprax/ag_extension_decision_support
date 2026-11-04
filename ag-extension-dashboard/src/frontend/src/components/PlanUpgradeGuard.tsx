import React from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Eye,
  ArrowRight,
  ShieldCheck,
  Zap,
  MessageSquare,
  Send,
  Bot,
  FileText,
  CheckCircle2,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface PlanUpgradeGuardProps {
  featureName: string;
  featureDescription?: string;
  category?:
    | 'sms'
    | 'chat'
    | 'whatsapp'
    | 'vision'
    | 'reports'
    | 'workflows'
    | 'visits'
    | 'analytics';
  children?: React.ReactNode;
}

export const PlanUpgradeGuard: React.FC<PlanUpgradeGuardProps> = ({
  featureName,
  featureDescription,
  category = 'sms',
  children,
}) => {
  const { user, setActiveTab } = useAppStore();
  const { headingClass } = useThemeClasses();

  // If user is not on free plan (e.g. Pro or Enterprise or Admin), render feature content
  const isFree =
    user?.role !== 'admin' &&
    (user?.isFree || user?.planName?.toLowerCase() === 'free' || !user?.planName);

  if (!isFree) {
    return <>{children}</>;
  }

  const categoryDetails = {
    sms: {
      icon: Send,
      headline: 'Omnichannel SMS & Broadcasting',
      desc: 'Bulk SMS campaigns, automated weather dispatch, and USSD broadcasting to hundreds of farmers require a Pro or Enterprise subscription.',
      benefits: [
        '500+ monthly SMS broadcast quota',
        'Direct multi-recipient campaigns',
        'Automated weather & pest alerts',
        'Localized language translation',
      ],
    },
    chat: {
      icon: MessageSquare,
      headline: 'Conversational AI Assistant & Farmer Chat',
      desc: 'Interactive AI advisory engine, multi-turn farmer chat, and voice notes synthesis require high-capacity neural models available on Pro plans.',
      benefits: [
        '1,000+ monthly AI reasoning credits',
        'Direct extension-to-farmer live chat',
        'Speech-to-text audio field notes',
        'Real-time agronomic recommendations',
      ],
    },
    whatsapp: {
      icon: Bot,
      headline: 'Telegram & WhatsApp Integration',
      desc: 'Automated 2-way bot conversations, WhatsApp dispatch, and omnichannel messaging are reserved for operational Pro & Enterprise teams.',
      benefits: [
        'Meta Cloud WhatsApp Business integration',
        'Telegram community bot broadcast',
        'Automated inbound inquiry triage',
        'Rich media diagnostic delivery',
      ],
    },
    vision: {
      icon: Eye,
      headline: 'Multimodal AI Vision & Leaf Diagnostics',
      desc: 'Sub-surface soil chemistry imaging and real-time plant pathological leaf diagnosis require advanced multimodal vision LLMs.',
      benefits: [
        'Instant plant disease photo identification',
        'Soil deficiency & NPK visual scoring',
        'Automated treatment recommendation log',
        'Downloadable field diagnosis PDF',
      ],
    },
    reports: {
      icon: FileText,
      headline: 'Automated Analytical Report Synthesis',
      desc: 'Comprehensive PDF export, crop cycle yield summaries, and executive intelligence reporting are powered by Pro analytic tools.',
      benefits: [
        'Custom executive PDF & Excel exports',
        'Seasonal yield & vital analytics',
        'Agronomic officer activity telemetry',
        'Multi-district comparative trends',
      ],
    },
    workflows: {
      icon: Zap,
      headline: 'Automated Email & Notification Workflows',
      desc: 'Trigger-based transactional alerts, scheduled email series, and automated client follow-ups are enabled on Pro tiers.',
      benefits: [
        'Custom workflow trigger sequences',
        'Automated follow-up reminders',
        'Stakeholder briefing summaries',
        'High-deliverability email relay',
      ],
    },
    visits: {
      icon: MapPin,
      headline: 'Field Visits & AI Synthesis Engine',
      desc: 'GPS-geotagged field visit routing, automated audio-to-text visit synthesis, and longitudinal farmer observation histories require a Pro subscription.',
      benefits: [
        'Unlimited GPS-logged field visits & scheduling',
        'Automated AI visit synthesis & diagnosis generator',
        'Historical visit comparison & severity tracking',
        'Officer route optimization & follow-up queues',
      ],
    },
    analytics: {
      icon: BarChart3,
      headline: 'Advanced Operational Analytics & Telemetry',
      desc: 'Comprehensive extension performance KPIs, resolution turnaround benchmarks, and predictive regional crop disease trends require a Pro subscription.',
      benefits: [
        'Officer speed-to-resolution benchmarking',
        'Regional crop outbreak predictive heatmaps',
        'Deep customer satisfaction & survey analytics',
        'Executive data export & real-time telemetry feeds',
      ],
    },
  };

  const details = categoryDetails[category] || categoryDetails.sms;
  const CategoryIcon = details.icon;

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-2xl w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-8 md:p-12 shadow-sm relative overflow-hidden"
      >
        <div className="relative z-10 text-center">
          {/* Lock & Feature Icon */}
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CategoryIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-emerald-500 flex items-center justify-center text-emerald-400 shadow">
              <Lock className="w-2.5 h-2.5" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Pro Feature Locked
          </div>

          <h2 className={`text-xl md:text-2xl font-semibold mb-3 tracking-tight ${headingClass}`}>
            {featureName || details.headline}
          </h2>

          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-8 leading-relaxed font-normal">
            {featureDescription || details.desc}
          </p>

          {/* Benefits Grid */}
          <div className="bg-gray-50 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/5 rounded-xl p-5 mb-8 text-left">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
              Included in Pro & Enterprise Plans:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {details.benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => setActiveTab('billing')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Upgrade to Pro Plan</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-medium text-xs transition-colors"
            >
              View Full Cost & Access Matrix
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
