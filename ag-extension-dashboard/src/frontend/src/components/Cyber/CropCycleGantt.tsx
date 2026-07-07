import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface GanttItem {
  id: string;
  label: string;
  value: string;
  percent: number;
}

interface CropCycleGanttProps {
  items?: GanttItem[];
  visits?: Array<{
    farmer_name?: string;
    visit_type?: string;
    status?: string;
    scheduled_at?: string;
  }>;
  farmers?: Array<{ firstName?: string; lastName?: string; crops?: string[] }>;
}

const CropCycleGantt: React.FC<CropCycleGanttProps> = ({ items, visits = [], farmers = [] }) => {
  const displayItems = useMemo(() => {
    if (items && items.length > 0) return items;

    // Derive crop cycle data from farmers and visits
    const cropMap = new Map<string, { active: number; total: number }>();

    farmers.forEach(f => {
      f.crops?.forEach(crop => {
        const existing = cropMap.get(crop) || { active: 0, total: 0 };
        cropMap.set(crop, { active: existing.active, total: existing.total + 1 });
      });
    });

    const completedVisits = visits.filter(v => v.status === 'completed').length;
    const totalVisits = visits.length;

    const derived: GanttItem[] = [];
    let idx = 0;

    cropMap.forEach((data, crop) => {
      const percent =
        totalVisits > 0
          ? Math.min(
              100,
              Math.round(
                (completedVisits / Math.max(totalVisits, 1)) *
                  100 *
                  (data.total / Math.max(farmers.length, 1))
              )
            )
          : Math.round((data.total / Math.max(farmers.length, 1)) * 60);
      derived.push({
        id: `crop-${idx++}`,
        label: crop,
        value: `${data.total} farmer${data.total !== 1 ? 's' : ''}`,
        percent: Math.max(5, percent),
      });
    });

    if (derived.length === 0 && totalVisits > 0) {
      derived.push({
        id: 'visits-cycle',
        label: 'Visit Completion',
        value: `${completedVisits}/${totalVisits}`,
        percent: Math.round((completedVisits / totalVisits) * 100),
      });
    }

    return derived;
  }, [items, visits, farmers]);

  return (
    <div className="glass-premium p-8 rounded-[2.5rem] border-white/5 h-full">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xs font-black text-primary-300/40 uppercase tracking-[0.3em]">
          CROP CYCLE TIMELINE
        </h3>
        <div className="flex gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-500/20" />
          ))}
        </div>
      </div>
      <div className="space-y-6">
        {displayItems.length > 0 ? (
          displayItems.map(item => (
            <div key={item.id} className="space-y-2">
              <div className="flex justify-between text-xxs font-bold text-primary-300/30">
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percent}%` }}
                  className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 shadow-[0_0_15px_var(--color-outline)]"
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-xxs font-bold text-primary-300/20 uppercase tracking-widest text-center py-10">
            No active cycles found
          </div>
        )}
      </div>
    </div>
  );
};

export default CropCycleGantt;
