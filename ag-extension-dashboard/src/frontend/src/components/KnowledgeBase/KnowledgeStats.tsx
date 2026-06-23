import React from 'react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, BarChart3, Info } from 'lucide-react';
import { CH_COLORS } from '@/lib/colors';

const COLORS = [CH_COLORS.blue, CH_COLORS.green, CH_COLORS.warning, CH_COLORS.error, CH_COLORS.purple];

interface KnowledgeStatsData {
    crops?: { name: string; count: number }[];
    categories?: { name: string; count: number }[];
    totalQueries?: number;
    cachedQueries?: number;
}

interface KnowledgeStatsProps {
    data: KnowledgeStatsData;
}

export const KnowledgeStats: React.FC<KnowledgeStatsProps> = ({ data }) => {

    if (!data) return (
        <div className="flex items-center justify-center p-20 text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mr-3"></div>
            <p className="font-black uppercase tracking-widest text-xs">Analyzing Knowledge Streams...</p>
        </div>
    );

    const cropsData = data.crops || [];
    const categoriesData = data.categories || [];
    const totalQueries = data.totalQueries ?? 0;
    const cachedQueries = data.cachedQueries ?? 0;
    const cacheHitRate = totalQueries > 0 ? `${((cachedQueries / totalQueries) * 100).toFixed(1)}%` : 'N/A';

    return (
        <div className="space-y-8 pb-20">
            {/* Top Stats Cards — Real Data */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Queries', value: totalQueries.toLocaleString(), icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Cache Hit Rate', value: cacheHitRate, icon: BarChart3, color: 'text-green-500', bg: 'bg-green-500/10' },
                    { label: 'Cached Answers', value: cachedQueries.toLocaleString(), icon: Info, color: 'text-purple-500', bg: 'bg-purple-500/10' }
                ].map((stat, i) => (
                    <div key={i} className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 flex items-center gap-4 group hover:border-primary-500/50 transition-colors">
                        <div className={`p-3 rounded-none ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xxs font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Top Crops Bar Chart */}
                <div className="card p-8 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/50 border flex flex-col">
                    <div className="flex items-center gap-2 mb-8">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Trending Crop Queries</h3>
                    </div>
                    <div className="h-64 mt-auto">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cropsData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-primary-500)20" />
                                <XAxis 
                                    dataKey="crop" 
                                    tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--color-primary-500)' }} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'var(--color-bg-secondary)', 
                                        border: 'none', 
                                        borderRadius: '0px',
                                        color: 'var(--color-primary-500)',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 10px 15px -3px var(--color-outline)'
                                    }}
                                />
                                <Bar dataKey="count" fill={CH_COLORS.blue} radius={[0, 0, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Categories Pie Chart */}
                <div className="card p-8 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/50 border">
                    <div className="flex items-center gap-2 mb-8">
                        <PieIcon className="w-5 h-5 text-blue-500" />
                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Category Distribution</h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="h-48 w-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoriesData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="count"
                                    >
                                        {categoriesData.map((_entry: unknown, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-2">
                            {categoriesData.map((cat: unknown, i: number) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400 truncate w-32 capitalize">{cat.category}</span>
                                    <span className="text-xs font-black text-gray-900 dark:text-white">{cat.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
