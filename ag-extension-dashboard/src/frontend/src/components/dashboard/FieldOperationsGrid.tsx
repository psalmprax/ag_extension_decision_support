import React from 'react';
import { EfficacyCard } from '@/components/efficacy/EfficacyCard';
import { AdvisoriesCard } from '@/components/advisories/AdvisoriesCard';
import { AlertsToReviewCard } from '@/components/alerts/AlertsToReviewCard';
import { FieldToolsCard } from '@/components/fieldtools/FieldToolsCard';
import { LeaderboardCard } from '@/components/fieldtools/FieldIntelCards';
import { OutreachDeliveryWidget } from '@/components/campaigns/OutreachDeliveryWidget';

interface FieldOperationsGridProps {
  /** Officers and administrators review crop-stress and outbreak alerts before farmers hear. */
  showReview: boolean;
  /** Cards for the last column that depend on the dashboard's own state (role, demo). */
  extra?: React.ReactNode;
}

/** The dashboard's field operations: tools and standings, alerts and advisories, outreach. */
export const FieldOperationsGrid: React.FC<FieldOperationsGridProps> = ({ showReview, extra }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
    <div className="space-y-4 sm:space-y-6">
      <FieldToolsCard />
      <LeaderboardCard />
    </div>
    <div className="space-y-4 sm:space-y-6">
      {showReview && <AlertsToReviewCard />}
      <AdvisoriesCard />
      <EfficacyCard />
    </div>
    <div className="space-y-4 sm:space-y-6">
      <OutreachDeliveryWidget />
      {extra}
    </div>
  </div>
);
