import React, { useState, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Lightbulb, Compass, HelpCircle, X, Zap, Crown, ArrowRight, Check } from 'lucide-react';
import { useAppStore, User } from '@/store/useAppStore';
import { AudioReaderButton } from '@/components/audio/AudioReaderButton';

export type PromptVariant = 'info' | 'tip' | 'guidance' | 'neutral';
export type PromptPlacement = 'top' | 'bottom' | 'left' | 'right';
export type PromptTrigger = 'hover' | 'click' | 'both';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface SubscriptionState {
  tier: SubscriptionTier;
  planName: string;
  isProOrHigher: boolean;
  isEnterprise: boolean;
  isActive: boolean;
}

/**
 * Resolves current user subscription tier and entitlement.
 */
export function resolveSubscriptionState(
  user: User | null,
  subscription: { plan?: { name?: string; status?: string } } | null,
  isDemo: boolean
): SubscriptionState {
  if (isDemo || user?.role === 'admin') {
    return {
      tier: 'enterprise',
      planName: user?.role === 'admin' ? 'Admin Access' : 'Demo Mode (Pro)',
      isProOrHigher: true,
      isEnterprise: true,
      isActive: true,
    };
  }

  const planStr = (subscription?.plan?.name || user?.planName || '').toLowerCase();
  const isFree = user?.isFree || planStr === 'free' || !planStr;

  let tier: SubscriptionTier = 'free';
  if (planStr.includes('enterprise') || planStr.includes('coop')) {
    tier = 'enterprise';
  } else if (planStr.includes('pro') || (!isFree && planStr)) {
    tier = 'pro';
  }

  return {
    tier,
    planName: subscription?.plan?.name || user?.planName || (tier === 'free' ? 'Free Starter' : 'Pro Plan'),
    isProOrHigher: tier === 'pro' || tier === 'enterprise',
    isEnterprise: tier === 'enterprise',
    isActive: subscription?.plan?.status === 'active' || subscription?.plan?.status === 'trialing' || !isFree,
  };
}

export interface InfoPromptProps {
  /** Text or rich content displayed inside the prompt */
  content: React.ReactNode;
  /** Optional bold title at the top of the prompt */
  title?: string;
  /** Visual theme variant */
  variant?: PromptVariant;
  /** Positioning relative to trigger */
  placement?: PromptPlacement;
  /** Trigger interaction mode */
  trigger?: PromptTrigger;
  /** Max width class (default: max-w-xs) */
  maxWidthClass?: string;
  /** Whether to show a 'Got it' dismiss button */
  showDismiss?: boolean;
  /** Optional custom icon override */
  icon?: React.ReactNode;
  /** Trigger child element */
  children: React.ReactNode;
  /** Optional className for the wrapper */
  className?: string;
  /** Optional callback when dismissed */
  onDismiss?: () => void;

  /** Minimum subscription tier required for this feature ('pro' | 'enterprise') */
  requiredPlan?: 'pro' | 'enterprise';
  /** Whether to show the subscription tier badge in the prompt */
  showSubscriptionBadge?: boolean;
  /** Custom callback when user clicks upgrade (defaults to navigating to billing tab) */
  onUpgrade?: () => void;
  /** Custom label for upgrade button */
  upgradeLabel?: string;
  /** Whether to show audio narration reader for low-literacy users */
  enableAudio?: boolean;
  /** Target language for audio narration */
  audioLanguage?: string;
}

const VARIANT_CONFIG: Record<
  PromptVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    borderClass: string;
    bgClass: string;
    textClass: string;
  }
> = {
  info: {
    icon: Info,
    iconClass: 'text-sky-500 dark:text-sky-400',
    borderClass: 'border-sky-500/20 dark:border-sky-400/25',
    bgClass: 'bg-white/95 dark:bg-slate-900/95 shadow-sky-500/5',
    textClass: 'text-slate-700 dark:text-slate-200',
  },
  tip: {
    icon: Lightbulb,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/20 dark:border-emerald-400/25',
    bgClass: 'bg-white/95 dark:bg-slate-900/95 shadow-emerald-500/5',
    textClass: 'text-slate-700 dark:text-slate-200',
  },
  guidance: {
    icon: Compass,
    iconClass: 'text-indigo-600 dark:text-indigo-400',
    borderClass: 'border-indigo-500/20 dark:border-indigo-400/25',
    bgClass: 'bg-white/95 dark:bg-slate-900/95 shadow-indigo-500/5',
    textClass: 'text-slate-700 dark:text-slate-200',
  },
  neutral: {
    icon: HelpCircle,
    iconClass: 'text-slate-500 dark:text-slate-400',
    borderClass: 'border-slate-200 dark:border-slate-800',
    bgClass: 'bg-white/95 dark:bg-slate-900/95 shadow-black/5',
    textClass: 'text-slate-700 dark:text-slate-300',
  },
};

const PLACEMENT_CLASSES: Record<PromptPlacement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * InfoPrompt — A calm, contextual prompt popover that takes subscription tier
 * into account and provides actionable guidance rather than aggressive warnings or toasts.
 */
export const InfoPrompt: React.FC<InfoPromptProps> = ({
  content,
  title,
  variant = 'info',
  placement = 'top',
  trigger = 'both',
  maxWidthClass = 'max-w-xs',
  showDismiss = false,
  icon: customIcon,
  children,
  className = '',
  onDismiss,
  requiredPlan,
  showSubscriptionBadge,
  onUpgrade,
  upgradeLabel,
  enableAudio = false,
  audioLanguage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const promptId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read subscription state from global store
  const user = useAppStore(s => s.user);
  const subscription = useAppStore(s => s.subscription);
  const isDemo = useAppStore(s => s.isDemo);
  const setActiveTab = useAppStore(s => s.setActiveTab);

  const subState = resolveSubscriptionState(user, subscription, isDemo);

  // Check if requiredPlan is satisfied
  const isTierMet = !requiredPlan
    ? true
    : requiredPlan === 'pro'
    ? subState.isProOrHigher
    : subState.isEnterprise;

  const resolvedVariant: PromptVariant = !isTierMet ? 'guidance' : variant;
  const config = VARIANT_CONFIG[resolvedVariant];
  const IconComponent = !isTierMet ? (requiredPlan === 'enterprise' ? Crown : Zap) : config.icon;
  const placementClass = PLACEMENT_CLASSES[placement];

  const handleMouseEnter = () => {
    if (trigger === 'click') return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(true), 120);
  };

  const handleMouseLeave = () => {
    if (trigger === 'click') return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(false), 180);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (trigger === 'hover') return;
    e.stopPropagation();
    setIsOpen(prev => !prev);
  };

  const handleClose = () => {
    setIsOpen(false);
    onDismiss?.();
  };

  const handleUpgradeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (onUpgrade) {
      onUpgrade();
    } else {
      setActiveTab('billing');
    }
  };

  // Close on outside click & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      aria-describedby={isOpen ? promptId : undefined}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={promptId}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95, y: placement === 'top' ? 4 : placement === 'bottom' ? -4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-50 pointer-events-auto select-text ${placementClass} ${maxWidthClass} w-max`}
            onClick={e => e.stopPropagation()}
          >
            <div
              className={`p-3 rounded-xl border shadow-xl backdrop-blur-md ${config.bgClass} ${config.borderClass} ${config.textClass} text-xs leading-relaxed`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {customIcon ? customIcon : <IconComponent className={`w-4 h-4 ${config.iconClass}`} />}
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    {title && (
                      <h5 className="font-semibold text-slate-900 dark:text-white text-xs tracking-tight">
                        {title}
                      </h5>
                    )}

                    {/* Subscription tier indicator */}
                    {requiredPlan && !isTierMet && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        <Zap className="w-2.5 h-2.5" />
                        {requiredPlan.toUpperCase()} Tier
                      </span>
                    )}

                    {(showSubscriptionBadge || (requiredPlan && isTierMet)) && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-2.5 h-2.5" />
                        {subState.planName}
                      </span>
                    )}
                  </div>

                  <div className="text-slate-600 dark:text-slate-300 font-normal">{content}</div>

                  {/* Subscription upgrade prompt if plan not met */}
                  {!isTierMet && requiredPlan && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-xxs text-slate-400">
                        Current: <strong className="text-slate-600 dark:text-slate-300">{subState.planName}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleUpgradeClick}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xxs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {upgradeLabel || `Upgrade to ${requiredPlan.toUpperCase()}`}
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}

                  {showDismiss && isTierMet && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex justify-end">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-2.5 py-1 text-xxs font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        Got it
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-1">
                  {enableAudio && (
                    <AudioReaderButton
                      text={typeof content === 'string' ? `${title ? title + '. ' : ''}${content}` : title || ''}
                      language={audioLanguage}
                      size="xs"
                      variant="ghost"
                    />
                  )}
                  {!showDismiss && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      aria-label="Close hint"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface InfoPromptIconProps {
  /** The content of the prompt */
  content: React.ReactNode;
  /** Optional title */
  title?: string;
  /** Theme variant */
  variant?: PromptVariant;
  /** Placement direction */
  placement?: PromptPlacement;
  /** Icon size class (default: w-3.5 h-3.5) */
  sizeClass?: string;
  /** Accessible label */
  ariaLabel?: string;
  className?: string;
  /** Minimum subscription tier required */
  requiredPlan?: 'pro' | 'enterprise';
  /** Whether to show subscription badge */
  showSubscriptionBadge?: boolean;
}

/**
 * InfoPromptIcon — A subtle icon badge that triggers an InfoPrompt on hover or tap.
 * Can reflect subscription requirements next to premium telemetry and metrics.
 */
export const InfoPromptIcon: React.FC<InfoPromptIconProps> = ({
  content,
  title,
  variant = 'info',
  placement = 'top',
  sizeClass = 'w-3.5 h-3.5',
  ariaLabel = 'More information',
  className = '',
  requiredPlan,
  showSubscriptionBadge,
}) => {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <InfoPrompt
      content={content}
      title={title}
      variant={variant}
      placement={placement}
      trigger="both"
      className={className}
      requiredPlan={requiredPlan}
      showSubscriptionBadge={showSubscriptionBadge}
    >
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors p-0.5"
        aria-label={ariaLabel}
      >
        <Icon className={sizeClass} />
      </button>
    </InfoPrompt>
  );
};

export interface InlinePromptProps {
  /** Main message content */
  children: React.ReactNode;
  /** Optional title */
  title?: string;
  /** Theme variant */
  variant?: PromptVariant;
  /** Whether the prompt can be dismissed */
  dismissible?: boolean;
  /** Optional callback on dismiss */
  onDismiss?: () => void;
  className?: string;

  /** Minimum subscription tier required */
  requiredPlan?: 'pro' | 'enterprise';
  /** Custom upgrade handler */
  onUpgrade?: () => void;
  /** Custom upgrade label */
  upgradeLabel?: string;
  /** Whether to show audio narration reader for low-literacy users */
  enableAudio?: boolean;
  /** Target language for audio narration */
  audioLanguage?: string;
}

/**
 * InlinePrompt — A peaceful, inline card component for contextual guidance on pages.
 * Supports subscription tier awareness with an inline upgrade button when needed.
 */
export const InlinePrompt: React.FC<InlinePromptProps> = ({
  children,
  title,
  variant = 'tip',
  dismissible = true,
  onDismiss,
  className = '',
  requiredPlan,
  onUpgrade,
  upgradeLabel,
  enableAudio = false,
  audioLanguage,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const user = useAppStore(s => s.user);
  const subscription = useAppStore(s => s.subscription);
  const isDemo = useAppStore(s => s.isDemo);
  const setActiveTab = useAppStore(s => s.setActiveTab);

  const subState = resolveSubscriptionState(user, subscription, isDemo);
  const isTierMet = !requiredPlan
    ? true
    : requiredPlan === 'pro'
    ? subState.isProOrHigher
    : subState.isEnterprise;

  const resolvedVariant: PromptVariant = !isTierMet ? 'guidance' : variant;
  const config = VARIANT_CONFIG[resolvedVariant];
  const IconComponent = !isTierMet ? (requiredPlan === 'enterprise' ? Crown : Zap) : config.icon;

  if (isDismissed) return null;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      setActiveTab('billing');
    }
  };

  return (
    <div
      role="region"
      aria-label={title || 'Platform prompt'}
      className={`flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-sm ${config.bgClass} ${config.borderClass} ${config.textClass} text-xs transition-all ${className}`}
    >
      <div className="mt-0.5 shrink-0">
        <IconComponent className={`w-4 h-4 ${config.iconClass}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {title && (
            <h5 className="font-semibold text-slate-900 dark:text-white text-xs tracking-tight">
              {title}
            </h5>
          )}
          {enableAudio && (
            <AudioReaderButton
              text={typeof children === 'string' ? `${title ? title + '. ' : ''}${children}` : title || ''}
              language={audioLanguage}
              size="xs"
              variant="ghost"
            />
          )}
          {requiredPlan && !isTierMet && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Zap className="w-2.5 h-2.5" />
              {requiredPlan.toUpperCase()} Tier
            </span>
          )}
        </div>
        <div className="text-slate-600 dark:text-slate-300 font-normal leading-relaxed">{children}</div>

        {!isTierMet && requiredPlan && (
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleUpgrade}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xxs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95"
            >
              <Zap className="w-2.5 h-2.5" />
              {upgradeLabel || `Upgrade to ${requiredPlan.toUpperCase()} to unlock`}
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
            <span className="text-xxs text-slate-400">
              Current plan: <strong>{subState.planName}</strong>
            </span>
          </div>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={() => {
            setIsDismissed(true);
            onDismiss?.();
          }}
          className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Dismiss prompt"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default InfoPrompt;
