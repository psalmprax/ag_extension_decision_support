import React, { useState, useRef } from 'react';
import { CheckCircle, Shield, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
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
      className={`relative group p-6 backdrop-blur-xl bg-slate-900/60 border rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden transition-all duration-300 ${
        isCurrentPlan
          ? 'ring-2 ring-emerald-500/80 border-emerald-500/60'
          : isPro
          ? 'border-emerald-500/30 hover:border-emerald-400/60'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Spotlight Cursor Tracking Glow */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: mousePos.opacity,
          background: `radial-gradient(450px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.08), transparent 80%)`,
        }}
      />

      {isPro && (
        <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 w-fit">
          <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span>{t('plan_badge_officer') || 'Recommended for Extension Officers & Cooperatives'}</span>
        </div>
      )}
      {plan.id === 'price_free' && (
        <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-white/[0.03] text-white/70 border border-white/10 w-fit">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>{t('plan_badge_farmer') || 'Ideal for Individual Smallholder Farmers'}</span>
        </div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
              {plan.name}
            </h3>
            <p className="text-xxs font-bold text-emerald-400 uppercase tracking-widest">
              {t('plan_tier_operational') || 'OPERATIONAL TIER'}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white font-mono tracking-tight">
                ${displayPrice}
              </span>
              <span className="text-white/60 font-medium text-xs">
                /mo
              </span>
            </div>
            {isAnnual && baseMonthly > 0 && (
              <span className="text-xxs text-emerald-400 font-mono mt-0.5">
                Billed ${annualTotal}/yr (20% saved)
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {plan.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="shrink-0 p-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-white/80 font-medium">
                {t(feature)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          triggerHaptic('medium');
          onSelect(plan.id);
        }}
        disabled={isCurrentPlan || actionLoading !== null}
        className={`relative z-10 w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
          isCurrentPlan
            ? 'bg-white/[0.03] border border-white/10 text-white/40 cursor-default'
            : isPro
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-950/40'
            : 'bg-white/[0.05] hover:bg-white/10 text-white border border-white/10'
        }`}
      >
        {actionLoading === plan.id ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : isCurrentPlan ? (
          <span className="flex items-center gap-2 text-emerald-400">
            <Shield className="w-4 h-4" />
            <span>{t('billing_status_active') || 'CURRENT PLAN'}</span>
          </span>
        ) : (
          <>
            <span>{t('billing_select_plan') || 'Upgrade Tier'}</span>
            <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </button>
    </motion.article>
  );
};
