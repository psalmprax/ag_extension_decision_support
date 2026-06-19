import React from 'react';
import { Farmer } from '@/types/dashboard';
import { Badge } from './ui/Badge';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';

interface FarmerYieldChartProps {
    farmer: Farmer;
    radiusClass: string;
    isCyber: boolean;
    isModern: boolean;
}

export const FarmerYieldChart: React.FC<FarmerYieldChartProps> = ({ farmer, radiusClass, isCyber, isModern }) => {
    const { t } = useLanguage();

    return (
        <section>
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-gray-400">
                    <TrendingUp className="w-4 h-4 text-primary-500" />
                    {t('viz_yield_trends')}
                </h3>
                <Badge variant="success" size="sm">{t('viz_growth_positive')}</Badge>
            </div>
            <div className={`h-48 w-full ${radiusClass} p-4 border bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800`}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={farmer.yieldHistory || []}>
                        <defs>
                            <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isCyber ? "#4fd1c5" : "#22c55e"} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={isCyber ? "#4fd1c5" : "#22c55e"} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isCyber ? "rgba(79, 209, 197, 0.1)" : "#E5E7EB"} />
                        <XAxis dataKey="month" hide />
                        <YAxis hide />
                        <Tooltip
                            contentStyle={{
                                borderRadius: isModern ? '16px' : '0px',
                                border: 'none',
                                backgroundColor: isCyber ? 'rgba(0,0,0,0.8)' : undefined,
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                color: isCyber ? '#fff' : undefined
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="yield"
                            stroke={isCyber ? "#4fd1c5" : "#22c55e"}
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
