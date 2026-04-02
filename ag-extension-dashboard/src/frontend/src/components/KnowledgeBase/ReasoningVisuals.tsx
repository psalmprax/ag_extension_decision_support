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
    Zap,
    Play,
    Image as ImageIcon,
    ExternalLink
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

interface MediaAsset {
    url: string;
    caption?: string;
}

interface ReasoningVisualsProps {
    visuals: {
        kpis?: KPI[];
        charts?: Chart[];
        images?: MediaAsset[];
        videos?: MediaAsset[];
    };
    audio?: string; // Base64 or URL
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export const ReasoningVisuals: React.FC<ReasoningVisualsProps> = ({ visuals, audio }) => {
    if (!visuals && !audio) return null;

    const [isPlaying, setIsPlaying] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    const togglePlayback = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

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
            {/* Audio Abstraction Layer */}
            {audio && (
                <div className="p-8 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-[2.5rem] text-white overflow-hidden relative group shadow-2xl shadow-primary-500/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:scale-110 transition-transform"></div>
                    <div className="relative flex flex-col md:flex-row items-center gap-8">
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={togglePlayback}
                            className="p-6 bg-white/20 backdrop-blur-md rounded-3xl text-white hover:bg-white/30 transition-all shadow-xl"
                        >
                            <Zap className={`w-12 h-12 ${isPlaying ? 'animate-pulse fill-current' : 'fill-none'}`} />
                        </motion.button>
                        <div className="flex-1 text-center md:text-left">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-2">ALFA Voice Synthesis</h4>
                            <p className="text-xl font-bold leading-tight mb-4">
                                Listen to the AI's synthesized expert recommendation.
                            </p>
                            <div className="flex items-center gap-4 justify-center md:justify-start">
                                <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden max-w-[200px]">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: isPlaying ? '100%' : '0%' }}
                                        transition={{ duration: 15, ease: "linear" }}
                                        className="h-full bg-white"
                                    />
                                </div>
                                <span className="text-[10px] font-black uppercase">{isPlaying ? 'Playing...' : 'Click to Play'}</span>
                            </div>
                        </div>
                        <audio 
                            ref={audioRef} 
                            src={audio.startsWith('data:') ? audio : `data:audio/mp3;base64,${audio}`} 
                            onEnded={() => setIsPlaying(false)}
                            className="hidden" 
                        />
                    </div>
                </div>
            )}

            {/* KPI Metrics Grid */}
            {visuals?.kpis && visuals.kpis.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Media Assets (Images/Videos) */}
            {(visuals.images || visuals.videos) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visuals.images?.map((img, idx) => (
                        <motion.div 
                            key={`img-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/50 dark:bg-gray-900/40 p-4 rounded-3xl border border-gray-100 dark:border-gray-700/50 backdrop-blur-xl group overflow-hidden"
                        >
                            <div className="relative aspect-video rounded-2xl overflow-hidden mb-3">
                                <img src={img.url} alt={img.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute top-3 left-3 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full flex items-center gap-1.5 text-white text-[10px] font-black uppercase tracking-widest">
                                    <ImageIcon className="w-3 h-3" />
                                    Image
                                </div>
                            </div>
                            {img.caption && <p className="text-sm font-bold text-gray-600 dark:text-gray-400 px-2">{img.caption}</p>}
                        </motion.div>
                    ))}
                    {visuals.videos?.map((vid, idx) => (
                        <motion.div 
                            key={`vid-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/50 dark:bg-gray-900/40 p-4 rounded-3xl border border-gray-100 dark:border-gray-700/50 backdrop-blur-xl group overflow-hidden"
                        >
                            <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 bg-black/10 flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Play className="w-12 h-12 text-white/80 group-hover:scale-110 transition-transform" />
                                </div>
                                <div className="absolute top-3 left-3 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full flex items-center gap-1.5 text-white text-[10px] font-black uppercase tracking-widest">
                                    <Play className="w-3 h-3" />
                                    Video Analysis
                                </div>
                                <a href={vid.url} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-3 p-2 bg-primary-600 rounded-xl text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                            {vid.caption && <p className="text-sm font-bold text-gray-600 dark:text-gray-400 px-2">{vid.caption}</p>}
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
                            transition={{ delay: idx * 0.1 }}
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
                    <div className="flex-1">
                        <h4 className="text-sm font-black uppercase tracking-[0.2em] opacity-70 mb-1">Expert Decision Insight</h4>
                        <p className="text-lg font-bold leading-tight">
                            {visuals.kpis && visuals.kpis.length > 0
                                ? `${visuals.kpis.filter(k => k.status === 'good').length} of ${visuals.kpis.length} indicators performing optimally. Review recommendations below.`
                                : 'Multimodal analysis complete. Review the synthesized intelligence above.'}
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <div className="px-6 py-2 bg-white text-primary-600 rounded-2xl font-black shadow-xl shadow-black/10">ALFA v2.2</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
