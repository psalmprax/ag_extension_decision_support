import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    MapPin,
    Calendar,
    TrendingUp,
    MessageSquare,
    Phone,
    Video,
    Clock,
    ChevronRight,
    Sprout,
    Maximize2,
    Activity,
    Mail
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { useNavigate } from 'react-router-dom';

interface FarmerDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    farmer: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visits?: any[];
}

const yieldData = [
    { month: 'Jan', yield: 45 },
    { month: 'Feb', yield: 52 },
    { month: 'Mar', yield: 48 },
    { month: 'Apr', yield: 61 },
    { month: 'May', yield: 55 },
    { month: 'Jun', yield: 67 },
];

export const FarmerDetailPanel: React.FC<FarmerDetailPanelProps> = ({
    isOpen,
    onClose,
    farmer,
    visits = []
}) => {
    const { t } = useLanguage();
    const { setActiveTab, themeName, addNotification, setPendingSMS } = useAppStore();
    const navigate = useNavigate();

    if (!farmer) return null;

    const isCyber = themeName === 'cyber';

    const handleAction = (type: 'chat' | 'sms' | 'call' | 'video') => {
        switch (type) {
            case 'chat':
                setActiveTab('farmerchat');
                onClose();
                break;
            case 'sms':
                if (farmer) {
                    setPendingSMS({ phone: farmer.phone || '', name: `${farmer.firstName || ''} ${farmer.lastName || ''}` });
                    navigate('/sms');
                }
                break;
            case 'call':
            case 'video':
                addNotification({
                    type: 'info',
                    message: `${t('action_connecting') || 'Connecting to'} ${farmer.firstName}... (${type.toUpperCase()})`
                });
                break;
        }
    };

    const handleStartSynthesis = () => {
        addNotification({
            type: 'success',
            message: t('synthesis_started') || 'AI Synthesis started for ' + farmer.firstName
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />

                    {/* Panel */}
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={`fixed right-0 top-0 bottom-0 w-full max-w-xl z-[70] shadow-2xl overflow-hidden flex flex-col ${
                            isCyber 
                            ? 'glass-premium border-l border-primary-500/20 shadow-primary-500/10' 
                            : 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-l border-white/20 dark:border-gray-800/50'
                        }`}
                    >
                        {/* Header Section */}
                        <div className="relative h-64 flex-shrink-0">
                            <div className={`absolute inset-0 opacity-90 ${isCyber ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900' : 'bg-gradient-to-br from-primary-600 to-secondary-700'}`} />
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-overlay" />
                            
                            {isCyber && (
                                <div className="absolute inset-0 cyber-grid-premium opacity-20" />
                            )}

                            <button
                                onClick={onClose}
                                className={`absolute top-6 right-6 p-2 backdrop-blur-md rounded-full text-white transition-all z-20 ${
                                    isCyber ? 'bg-primary-500/20 hover:bg-primary-500/40 border border-primary-500/30' : 'bg-white/10 hover:bg-white/20'
                                }`}
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black/60 to-transparent">
                                <div className="flex items-end gap-6">
                                    <div className={`w-24 h-24 rounded-2xl p-1 shadow-2xl ${isCyber ? 'bg-primary-500/20 border border-primary-500/40' : 'bg-white'}`}>
                                        <div className={`w-full h-full rounded-xl flex items-center justify-center font-black text-4xl ${
                                            isCyber ? 'bg-black/40 text-primary-400' : 'bg-primary-100 text-primary-600'
                                        }`}>
                                            {farmer.firstName?.[0]}{farmer.lastName?.[0]}
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <h2 className={`text-3xl font-black leading-none mb-2 ${isCyber ? 'text-white text-glow' : 'text-white'}`}>
                                            {farmer.firstName} {farmer.lastName}
                                        </h2>
                                        <div className="flex items-center gap-4 text-white/80 text-sm font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-4 h-4" />
                                                <span>{farmer.region}, {farmer.village}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Maximize2 className="w-4 h-4" />
                                                <span>{farmer.farmSize} ha</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                            {/* Action Buttons */}
                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { id: 'chat', icon: MessageSquare, label: t('action_chat'), color: isCyber ? 'bg-primary-500/10 border border-primary-500/20 text-primary-400' : 'bg-primary-500 text-white' },
                                    { id: 'sms', icon: Mail, label: t('action_sms'), color: isCyber ? 'bg-secondary-500/10 border border-secondary-500/20 text-secondary-400' : 'bg-secondary-500 text-white' },
                                    { id: 'call', icon: Phone, label: t('action_call'), color: isCyber ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-green-500 text-white' },
                                    { id: 'video', icon: Video, label: t('action_video'), color: isCyber ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' : 'bg-purple-500 text-white' },
                                ].map((action) => (
                                    <button 
                                        key={action.id} 
                                        onClick={() => handleAction(action.id as any)}
                                        className="flex flex-col items-center gap-2 group"
                                    >
                                        <div className={`w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center shadow-lg transition-all group-hover:scale-110 group-hover:rotate-3 outline outline-4 outline-transparent hover:outline-white/20`}>
                                            <action.icon className="w-6 h-6" />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                                            isCyber ? 'text-primary-300/60 group-hover:text-primary-300' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200'
                                        }`}>
                                            {action.label}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Yield Performance */}
                            <section>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className={`text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isCyber ? 'text-primary-300/60' : 'text-gray-400'}`}>
                                        <TrendingUp className={`w-4 h-4 ${isCyber ? 'text-primary-400' : 'text-primary-500'}`} />
                                        {t('viz_yield_trends')}
                                    </h3>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                        isCyber ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-[0_0_10px_rgba(79,209,197,0.2)]' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                    }`}>
                                        {t('viz_growth_positive')}
                                    </span>
                                </div>
                                <div className={`h-48 w-full rounded-3xl p-4 border ${
                                    isCyber ? 'bg-black/40 border-primary-500/10' : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'
                                }`}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={yieldData}>
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
                                                    borderRadius: '16px',
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

                            <div className="grid grid-cols-2 gap-6">
                                {/* Crops Section */}
                                <section className={`p-6 rounded-3xl border shadow-sm ${
                                    isCyber ? 'bg-black/40 border-primary-500/10' : 'bg-theme-bg-card dark:bg-gray-800/80 border-gray-100 dark:border-gray-700'
                                }`}>
                                    <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isCyber ? 'text-primary-300/60' : 'text-gray-400'}`}>
                                        <Sprout className={`w-4 h-4 ${isCyber ? 'text-primary-400' : 'text-green-500'}`} />
                                        {t('table_crops')}
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {farmer.crops?.map((crop: string) => (
                                            <span key={crop} className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter ${
                                                isCyber ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                                            }`}>
                                                {crop}
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                {/* Vital Stats */}
                                <section className={`p-6 rounded-3xl border shadow-sm ${
                                    isCyber ? 'bg-black/40 border-primary-500/10' : 'bg-theme-bg-card dark:bg-gray-800/80 border-gray-100 dark:border-gray-700'
                                }`}>
                                    <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isCyber ? 'text-secondary-300/60' : 'text-gray-400'}`}>
                                        <Activity className={`w-4 h-4 ${isCyber ? 'text-secondary-400' : 'text-secondary-500'}`} />
                                        {t('farmer_vital_score')}
                                    </h3>
                                    <div className={`text-3xl font-black leading-none ${isCyber ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                        84<span className="text-sm text-gray-400">/100</span>
                                    </div>
                                    <div className={`w-full h-1.5 rounded-full mt-3 overflow-hidden ${isCyber ? 'bg-white/5' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        <div className={`h-full rounded-full ${isCyber ? 'bg-secondary-500 neon-glow-secondary' : 'bg-secondary-500'}`} style={{ width: '84%' }} />
                                    </div>
                                </section>
                            </div>

                            {/* Visit Timeline */}
                            <section>
                                <h3 className={`text-sm font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 ${isCyber ? 'text-primary-300/60' : 'text-gray-400'}`}>
                                    <Clock className="w-4 h-4 text-purple-500" />
                                    {t('nav_visits')}
                                </h3>
                                <div className="space-y-4">
                                    {visits.length > 0 ? visits.map((visit, i) => (
                                        <div key={i} className="relative pl-8 group">
                                            {/* Line */}
                                            {i !== visits.length - 1 && (
                                                <div className={`absolute left-3 top-6 bottom-[-16px] w-0.5 transition-colors ${
                                                    isCyber ? 'bg-primary-500/10 group-hover:bg-primary-500/30' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-500'
                                                }`} />
                                            )}
                                            {/* Dot */}
                                            <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 shadow-md ${
                                                isCyber ? 'border-black' : 'border-white dark:border-gray-900'
                                            } ${visit.status === 'completed' ? (isCyber ? 'bg-primary-500 neon-glow-primary' : 'bg-primary-500') : 'bg-accent-500'}`} />

                                            <div 
                                                onClick={() => addNotification({ type: 'info', message: t('visit_detail_coming') || 'Visit details coming soon' })}
                                                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                                    isCyber 
                                                    ? 'bg-black/20 border-primary-500/10 hover:bg-primary-500/5 hover:border-primary-500/30' 
                                                    : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-xs font-black uppercase tracking-tight ${isCyber ? 'text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                                                        {visit.visit_type}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-400">
                                                        {new Date(visit.scheduled_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
                                                    “{visit.reason || t('visit_routine_inspection')}”
                                                </p>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className={`p-8 text-center rounded-3xl border border-dashed ${
                                            isCyber ? 'bg-black/40 border-primary-500/20' : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700'
                                        }`}>
                                            <Calendar className={`w-8 h-8 mx-auto mb-2 ${isCyber ? 'text-primary-500/40' : 'text-gray-300'}`} />
                                            <p className={`text-xs font-bold uppercase tracking-widest ${isCyber ? 'text-primary-300/40' : 'text-gray-400'}`}>{t('visit_no_history')}</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {/* Footer Quick Action */}
                        <div className={`p-8 border-t flex items-center justify-between ${isCyber ? 'bg-black/60 border-primary-500/20' : 'bg-white border-gray-100 dark:border-gray-800'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    isCyber ? 'bg-secondary-500/10 text-secondary-400' : 'bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400'
                                }`}>
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isCyber ? 'text-primary-300/40' : 'text-gray-400'}`}>{t('visit_next_scheduled')}</p>
                                    <p className={`text-sm font-bold ${isCyber ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{t('visit_date_march')}</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleStartSynthesis}
                                className={`px-6 py-3 rounded-2xl font-black text-xs shadow-xl transition-all flex items-center gap-2 ${
                                    isCyber 
                                    ? 'bg-primary-500 text-black hover:bg-primary-400 shadow-primary-500/20' 
                                    : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20'
                                }`}
                            >
                                {t('action_start_synthesis')}
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
};

export default FarmerDetailPanel;
