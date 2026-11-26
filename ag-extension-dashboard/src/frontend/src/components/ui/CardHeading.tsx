import React from 'react';
import { cn } from '@/lib/cn';
import { CARD_SUBTITLE, CARD_TITLE } from './typography';

interface CardHeadingProps {
  /** A few words naming what the card holds. */
  title: React.ReactNode;
  /** Anything longer than the name: one grey line under it. */
  subtitle?: React.ReactNode;
  /** A small line icon before the title. */
  icon?: React.ReactNode;
  /** Controls or a short status on the right. */
  actions?: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * A card's heading in the app (option A in docs/HEADINGS_AND_TYPE_PROPOSAL.md): a 20px
 * title, clearly larger than the 14–15px text in the card, with any explanation moved to a
 * grey subtitle instead of a long heading.
 */
export const CardHeading: React.FC<CardHeadingProps> = ({ title, subtitle, icon, actions, id, className }) => (
  <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
    <div className="min-w-0">
      <h3 id={id} className={`flex items-center gap-2 ${CARD_TITLE}`}>
        {icon}
        <span className="min-w-0">{title}</span>
      </h3>
      {subtitle && <p className={`mt-1 ${CARD_SUBTITLE}`}>{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
