import React, { useState, useRef } from 'react';
import { CheckCircle, Shield, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { triggerHaptic } from '@/lib/haptics';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
}

interface PlanCardProps {
  plan: Plan;
  index: number;
  isCurrentPlan: boolean;
  isAnnual?: boolean;
  onSelect: (planId: string) => void;
  actionLoading: string | null;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  index,
  isCurrentPlan,
  isAnnual = false,
  onSelect,
  actionLoading,
}) => {
  const { t } = useLanguage();
  const { radiusClass } = useThemeClasses();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setMousePos(prev => ({ ...prev, opacity: 0 }));
  };

  const isPro = plan.id.includes('pro');
  const baseMonthly = plan.price / 100;
  const displayPrice = isAnnual && baseMonthly > 0 ? (baseMonthly * 0.8).toFixed(2) : baseMonthly.toFixed(2);
  const annualTotal = (baseMonthly * 12 * 0.8).toFixed(2);

  return (
    <motion.article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      className={`relative card group p-8 lg:p-10 bg-slate-950/90 dark:bg-slate-950/95 backdrop-blur-2xl border flex flex-col justify-between overflow-hidden transition-all duration-500 shadow-2xl ${
        isCurrentPlan
          ? 'ring-2 ring-emerald-500/80 border-emerald-500/60 shadow-emerald-950/60'
          : isPro
          ? 'border-emerald-500/30 hover:border-emerald-400 hover:-translate-y-1.5 hover:shadow-emerald-950/50'
          : 'border-slate-800/80 hover:border-slate-700 hover:-translate-y-1 hover:shadow-slate-950/50'
      }`}
      style={{ borderRadius: 'var(--radius-card, 1.25rem)' }}
    >
      {/* CanvasUI Spotlight Cursor Tracking Glow */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: mousePos.opacity,
          background: `radial-gradient(450px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.12), transparent 80%)`,
        }}
      />

      {/* KnockKnock Ambient Glow Orbs */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <div className="absolute -top-1/4 -right-1/4 w-72 h-72 bg-emerald-500/15 rounded-full blur-[90px]" />
        <div className="absolute -bottom-1/4 -left-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-[90px]" />
      </div>

      {isPro && (
        <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1 bg-emerald-500/15 text-emerald-300 text-xxs font-black rounded-full uppercase tracking-[0.2em] border border-emerald-500/40 backdrop-blur-md relative z-10 w-fit shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          {t('plan_badge_officer') || 'Recommended for Extension Officers & Cooperatives'}
        </div>
      )}
      {plan.id === 'price_free' && (
        <div className="mb-6 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-slate-300 text-xxs font-black rounded-full uppercase tracking-[0.2em] border border-slate-700/80 backdrop-blur-md relative z-10 w-fit">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          {t('plan_badge_farmer') || 'Ideal for Individual Smallholder Farmers'}
        </div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1.5">
            <h3 className="text-3xl font-black text-white tracking-tighter leading-none group-hover:text-emerald-300 transition-colors">
              {plan.name}
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xxs font-black text-emerald-400 uppercase tracking-[0.2em]">
                {t('plan_tier_operational') || 'OPERATIONAL TIER'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white tracking-tight">
                ${displayPrice}
              </span>
              <span className="text-slate-400 font-bold uppercase text-xxs tracking-widest">
                /mo
              </span>
            </div>
            {isAnnual && baseMonthly > 0 && (
              <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                Billed ${annualTotal}/yr (20% saved)
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3.5 mb-10">
          {plan.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-3.5 group/feature">
              <div className="shrink-0 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 group-hover/feature:bg-emerald-500/25 group-hover/feature:scale-110 transition-all duration-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-slate-300 group-hover/feature:text-white transition-colors duration-200">
                {t(feature)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          triggerHaptic('medium');
          onSelect(plan.id);
        }}
        disabled={isCurrentPlan || actionLoading !== null}
        className={`relative z-10 w-full h-14 ${radiusClass} font-black uppercase tracking-[0.2em] text-xs transition-all duration-300 flex items-center justify-center gap-2.5 overflow-hidden shadow-xl ${
          isCurrentPlan
            ? 'bg-slate-900/90 border border-slate-800 text-slate-500 cursor-default'
            : isPro
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 ring-1 ring-emerald-400/40'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-slate-950/60'
        }`}
      >
        {actionLoading === plan.id ? (
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : isCurrentPlan ? (
          <span className="flex items-center gap-2 relative z-10 text-emerald-400">
            <Shield className="w-4 h-4" />
            {t('billing_status_active') || 'CURRENT PLAN'}
          </span>
        ) : (
          <>
            <span>{t('billing_select_plan') || 'UPGRADE TIER'}</span>
            <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1.5 transition-transform duration-300" />
          </>
        )}
      </motion.button>
    </motion.article>
  );
};
