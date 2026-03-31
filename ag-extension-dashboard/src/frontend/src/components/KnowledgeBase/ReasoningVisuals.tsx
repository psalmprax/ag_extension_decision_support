import React from 'react';
import { 
    BarChart, 
    Bar, 
    LineChart, 
    Line, 
    PieChart, 
    Pie, 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { 
    AlertCircle, 
    CheckCircle2, 
    AlertTriangle, 
    Info,
    TrendingUp,
    Zap
} from 'lucide-react';

interface KPI {
    label: string;
    value: string;
    status: 'good' | 'warning' | 'critical';
}

interface Chart {
    type: 'bar' | 'line' | 'pie' | 'area';
    title: string;
    data: Array<{ label: string; value: number }>;
}

interface ReasoningVisualsProps {
    visuals: {
        kpis?: KPI[];
        charts?: Chart[];
    };
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export const ReasoningVisuals: React.FC<ReasoningVisualsProps> = ({ visuals }) => {
    if (!visuals) return null;

    const renderChart = (chart: Chart) => {
        const { type, data, title } = chart;
        
        return (
            <div className="bg-white/50 dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50 backdrop-blur-xl h-[300px] flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="w-4 h-4 text-primary-500" />
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">{title}</h3>
                </div>
                
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {type === 'bar' ? (
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        ) : type === 'area' ? (
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="label" hide />
                                <YAxis hide />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                            </AreaChart>
                        ) : type === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        ) : (
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="label" hide />
                                <YAxis hide />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 mt-8">
            {/* KPI Metrics Grid */}
            {visuals.kpis && visuals.kpis.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visuals.kpis.map((kpi, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="p-5 bg-white shadow-lg shadow-gray-200/50 dark:bg-gray-800 dark:shadow-none border border-gray-100 dark:border-gray-700/50 rounded-3xl flex flex-col items-center text-center gap-2 group hover:border-primary-500/50 transition-all cursor-default"
                        >
                            <div className={`p-2 rounded-xl mb-1 ${
                                kpi.status === 'good' ? 'bg-green-100 text-green-600' :
                                kpi.status === 'warning' ? 'bg-amber-100 text-amber-600' : 
                                'bg-rose-100 text-rose-600'
                            }`}>
                                {kpi.status === 'good' ? <CheckCircle2 className="w-5 h-5" /> :
                                 kpi.status === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                                 <AlertCircle className="w-5 h-5" />}
                            </div>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{kpi.label}</span>
                            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{kpi.value}</span>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Charts Section */}
            {visuals.charts && visuals.charts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visuals.charts.map((chart, idx) => (
                        <motion.div 
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (visuals.kpis?.length || 0) * 0.1 + idx * 0.1 }}
                        >
                            {renderChart(chart)}
                        </motion.div>
                    ))}
                </div>
            )}
            
            {/* Insight Analysis Modeling (Icon Representation) */}
            <div className="p-8 bg-primary-600 rounded-3xl text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-110 transition-transform"></div>
                <div className="relative flex items-center gap-6">
                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
                        <Zap className="w-10 h-10 fill-current" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-[0.2em] opacity-70 mb-1">Expert Decision Insight</h4>
                        <p className="text-lg font-bold leading-tight">
                            {visuals.kpis && visuals.kpis.length > 0
                                ? `${visuals.kpis.filter(k => k.status === 'good').length} of ${visuals.kpis.length} indicators performing optimally. Review recommendations below.`
                                : 'AI-powered analysis complete. Review the data and recommendations above.'}
                        </p>
                    </div>
                    <div className="ml-auto hidden md:block">
                        <div className="px-6 py-2 bg-white text-primary-600 rounded-2xl font-black shadow-xl shadow-black/10">ALFA v2.1</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
