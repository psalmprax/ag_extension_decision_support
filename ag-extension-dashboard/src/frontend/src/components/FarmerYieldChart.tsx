import React from 'react';
import { Farmer } from '@/types/dashboard';
import { Badge } from './ui/Badge';
import { TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { chartGrid } from '@/components/charts/chartConfig';

interface FarmerYieldChartProps {
  farmer: Farmer;
  radiusClass: string;
}

export const FarmerYieldChart: React.FC<FarmerYieldChartProps> = ({ farmer, radiusClass }) => {
  const { t } = useLanguage();

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-gray-400">
          <TrendingUp className="w-4 h-4 text-primary-500" />
          {t('viz_yield_trends')}
        </h3>
        <Badge variant="success" size="sm">
          {t('viz_growth_positive')}
        </Badge>
      </div>
      <div
        className={`h-48 w-full ${radiusClass} p-4 border bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={farmer.yieldHistory || []}>
            <defs>
              <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="month" hide />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="yield"
              stroke="var(--color-primary-500)"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorYield)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
