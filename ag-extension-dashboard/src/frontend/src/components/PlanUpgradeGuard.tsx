import React from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  MessageSquare,
  Send,
  Bot,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface PlanUpgradeGuardProps {
  featureName: string;
  featureDescription?: string;
  category?: 'sms' | 'chat' | 'whatsapp' | 'vision' | 'reports' | 'workflows';
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
      icon: Sparkles,
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
  };

  const details = categoryDetails[category] || categoryDetails.sms;
  const CategoryIcon = details.icon;

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-2xl w-full rounded-3xl bg-white/70 dark:bg-slate-900/80 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center">
          {/* Lock & Feature Icon */}
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-primary-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg">
              <CategoryIcon className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow">
              <Lock className="w-3 h-3" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Pro Feature Locked
          </div>

          <h2 className={`text-2xl md:text-3xl font-black mb-3 tracking-tight ${headingClass}`}>
            {featureName || details.headline}
          </h2>

          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-8 leading-relaxed font-medium">
            {featureDescription || details.desc}
          </p>

          {/* Benefits Grid */}
          <div className="bg-gray-50/80 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/5 rounded-2xl p-5 mb-8 text-left">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Included in Pro & Enterprise Plans:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {details.benefits.map((benefit, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300"
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
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Upgrade to Pro Plan</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold text-sm transition-all"
            >
              View Full Cost & Access Matrix
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
