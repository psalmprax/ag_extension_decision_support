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
    Mail,
    Edit2,
    Save,
    History,
    FileText,
    Loader2,
    Share2,
    Trash2,
    MoreVertical
} from 'lucide-react';
import { VideoCall } from './VideoCall';
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

import { fetchSMSHistory } from '@/api/smsService';
import { generateSynthesis } from '@/api/chatbotService';
import { fetchPriorityScore, updateVisit } from '@/api/visitService';
import { SatelliteInsights } from './SatelliteInsights';
import { ConfirmModal } from './ConfirmModal';
import toast from 'react-hot-toast';

interface FarmerDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    farmer: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visits?: any[];
}


export const FarmerDetailPanel: React.FC<FarmerDetailPanelProps> = ({
    isOpen,
    onClose,
    farmer,
    visits = []
}) => {
    const { t } = useLanguage();
    const { 
        setActiveTab: setGlobalTab, 
        themeName, 
        addNotification, 
        setPendingSMS, 
        updateFarmer,
        user: storeUser,
        showContextMenu,
        showShareModal
    } = useAppStore();
    
    const isCyber = themeName === 'cyber';
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = React.useState<'overview' | 'history' | 'insights'>('overview');
    const [isEditing, setIsEditing] = React.useState(false);
    const [editData, setEditData] = React.useState(farmer);
    const [interactions, setInteractions] = React.useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
    const [showVideoCall, setShowVideoCall] = React.useState(false);
    const [isSynthesizing, setIsSynthesizing] = React.useState(false);
    const [isRefreshingPriority, setIsRefreshingPriority] = React.useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [localVisits, setLocalVisits] = React.useState(visits);

    React.useEffect(() => {
        setLocalVisits(visits);
    }, [visits]);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

    const loadInteractions = async () => {
        if (!farmer?.id) return;
        setIsLoadingHistory(true);
        try {
            const res = await fetchSMSHistory(farmer.id);
            if (res.success) {
                setInteractions(res.data.map((msg: any) => ({
                    type: 'SMS',
                    date: new Date(msg.createdAt).toLocaleDateString(),
                    status: msg.status === 'sent' ? 'delivered' : msg.status,
                    content: msg.message
                })));
            }
        } catch (err) {
            console.error('Failed to load interactions:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    React.useEffect(() => {
        setEditData(farmer);
        if (activeTab === 'history') {
            loadInteractions();
        }
    }, [farmer, activeTab]);

    const handleSave = () => {
        updateFarmer(farmer.id, editData);
        setIsEditing(false);
        addNotification({
            type: 'success',
            message: `Updated profile for ${farmer.firstName}`
        });
    };

    const handleShare = () => {
        showShareModal({ 
            entityType: 'farmer', 
            entityId: farmer.id, 
            entityName: `${farmer.firstName} ${farmer.lastName}` 
        });
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        showContextMenu({ 
            x: e.clientX, 
            y: e.clientY, 
            entityType: 'farmer', 
            entityId: farmer.id 
        });
    };

    if (!farmer) return null;

    const handleAction = (type: 'chat' | 'sms' | 'call' | 'video') => {
        switch (type) {
            case 'chat':
                setGlobalTab('farmerchat');
                onClose();
                break;
            case 'sms':
                if (farmer) {
                    setPendingSMS({ phone: farmer.phone || '', name: `${farmer.firstName || ''} ${farmer.lastName || ''}` });
                    navigate('/sms');
                }
                break;
            case 'call':
                if (farmer.phone) {
                    window.location.href = `tel:${farmer.phone}`;
                    addNotification({
                        type: 'info',
                        message: `${t('action_connecting') || 'Connecting to'} ${farmer.firstName}...`
                    });
                } else {
                    addNotification({ type: 'error', message: 'No phone number available' });
                }
                break;
            case 'video':
                setShowVideoCall(true);
                break;
        }
    };

    const handleStartSynthesis = async () => {
        if (!farmer?.id) return;

        setIsSynthesizing(true);
        try {
            const res = await generateSynthesis({
                farmerId: farmer.id,
                notes: `Farmer: ${farmer.firstName} ${farmer.lastName}. Region: ${farmer.region}. Farm Size: ${farmer.farmSize}ha. Crops: ${farmer.crops?.join(', ')}.`,
                visitDate: new Date().toLocaleDateString()
            });

            if (res.success) {
                addNotification({
                    type: 'success',
                    message: `AI Synthesis complete for ${farmer.firstName}`
                });
            }
        } catch (err) {
            console.error('Synthesis failed:', err);
            addNotification({
                type: 'error',
                message: 'AI Synthesis failed to generate'
            });
        } finally {
            setIsSynthesizing(false);
        }
    };

    const handleRefreshPriority = async () => {
        if (!farmer?.id) return;
        setIsRefreshingPriority(true);
        try {
            const res = await fetchPriorityScore(farmer.id);
            if (res.success) {
                addNotification({
                    type: 'success',
                    message: `Priority: ${res.data.level.toUpperCase()} (score: ${res.data.score}/100) — ${res.data.recommendedAction}`
                });
                // Switch to insights tab to show the updated data
                setActiveTab('insights');
            }
        } catch {
            addNotification({
                type: 'error',
                message: 'Failed to refresh priority analysis'
            });
        } finally {
            setIsRefreshingPriority(false);
        }
    };

    const handleUpdateVisitStatus = async (visitId: string, status: 'completed' | 'cancelled') => {
        try {
            const res = await updateVisit(visitId, { status });
            if (res.success) {
                setLocalVisits(prev => prev.map(v => v.id === visitId ? { ...v, status } : v));
                addNotification({
                    type: 'success',
                    message: `Visit marked as ${status}`
                });
            }
        } catch (err) {
            console.error('Failed to update visit status:', err);
            addNotification({
                type: 'error',
                message: `Failed to mark visit as ${status}`
            });
        }
    };

    const nextScheduledVisit = localVisits
        .filter(v => v.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="panel-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                    />

                    {/* Panel */}
                    <motion.aside
                        key="panel-content"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className={`fixed right-0 top-0 bottom-0 w-full max-w-xl z-[70] shadow-2xl overflow-hidden flex flex-col ${isCyber ? 'bg-black/90 dark:bg-gray-900/90' : 'bg-white/90 dark:bg-gray-900/90'} backdrop-blur-xl border-l border-white/20 dark:border-gray-800/50`}
                    >
                        {/* Header Section */}
                        <div className="relative h-64 flex-shrink-0" onContextMenu={handleContextMenu}>
                            <div className={`absolute inset-0 opacity-90 bg-gradient-to-br from-primary-600 to-secondary-700`} />
                            <div className="absolute inset-0 bg-gradient-to-br from-primary-800/40 to-secondary-900/40" />

                            {isCyber && (
                                <div className="absolute inset-0 cyber-grid-premium opacity-20" />
                            )}

                            <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
                                <button
                                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                    className={`p-2 backdrop-blur-md rounded-full text-white transition-all ${isEditing ? 'bg-primary-500/40 border border-primary-500/30' : 'bg-white/10 hover:bg-white/20'}`}
                                    title={isEditing ? 'Save Changes' : 'Edit Farmer'}
                                >
                                    {isEditing ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-white/10 hover:bg-white/20"
                                    title="Share Farmer Information"
                                >
                                    <Share2 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleContextMenu}
                                    className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-white/10 hover:bg-white/20"
                                    title="More Actions"
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30"
                                    title="Delete Farmer"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-white/10 hover:bg-white/20"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black/60 to-transparent">
                                <div className="flex items-end gap-6">
                                    <div className={`w-24 h-24 rounded-2xl p-1 shadow-2xl bg-white`}>
                                        <div className={`w-full h-full rounded-xl flex items-center justify-center font-black text-4xl bg-primary-100 text-primary-600`}>
                                            {farmer.firstName?.[0]}{farmer.lastName?.[0]}
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <h2 className={`text-3xl font-black leading-none mb-2 text-white`}>
                                            {farmer.firstName} {farmer.lastName}
                                        </h2>
                                        <div className="flex items-center gap-4 text-white/80 text-sm font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-4 h-4" />
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editData.region || ''}
                                                        onChange={(e) => setEditData({ ...editData, region: e.target.value })}
                                                        className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                        placeholder="Region"
                                                    />
                                                ) : (
                                                    <span>{farmer.region}, {farmer.village}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Maximize2 className="w-4 h-4" />
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editData.farmSize || 0}
                                                        onChange={(e) => setEditData({ ...editData, farmSize: Number(e.target.value) })}
                                                        className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white w-16 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    />
                                                ) : (
                                                    <span>{farmer.farmSize} ha</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="w-4 h-4" />
                                                {isEditing ? (
                                                    <input
                                                        type="tel"
                                                        value={editData.phone || ''}
                                                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                                        className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white w-32 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                        placeholder="Phone"
                                                    />
                                                ) : (
                                                    <span>{farmer.phone || 'No phone'}</span>
                                                )}
                                            </div>
                                            {isEditing && (
                                                <div className="flex items-center gap-1.5">
                                                    <Activity className="w-4 h-4" />
                                                    <select
                                                        value={editData.status || 'active'}
                                                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                        className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    >
                                                        <option value="active" className="text-gray-900">Active</option>
                                                        <option value="inactive" className="text-gray-900">Inactive</option>
                                                        <option value="pending" className="text-gray-900">Pending</option>
                                                        <option value="suspended" className="text-gray-900">Suspended</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className={`px-8 pt-6 border-b bg-white border-gray-100 dark:border-gray-800`}>
                            <div className="flex items-center gap-8">
                                {[
                                    { id: 'overview', label: t('nav_dashboard') || 'Overview', icon: FileText },
                                    { id: 'history', label: t('nav_sms_history') || 'Communication', icon: History },
                                    { id: 'insights', label: t('nav_analytics') || 'Insights', icon: TrendingUp },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] relative transition-all ${activeTab === tab.id
                                            ? (isCyber ? 'text-primary-400' : 'text-primary-600')
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <tab.icon className="w-4 h-4" />
                                            {tab.label}
                                        </span>
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className={`absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary-500`}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar overflow-x-hidden">
                            {activeTab === 'overview' ? (
                                <>
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
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    showContextMenu({ x: e.clientX, y: e.clientY, entityType: 'farmer', entityId: farmer.id });
                                                }}
                                                className="flex flex-col items-center gap-2 group"
                                            >
                                                <div className={`w-12 h-12 rounded-2xl ${action.color} flex items-center justify-center shadow-lg transition-all group-hover:scale-110 group-hover:rotate-3 outline outline-4 outline-transparent hover:outline-white/20`}>
                                                    <action.icon className="w-6 h-6" />
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isCyber ? 'text-primary-300' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200'}`}>
                                                    {action.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Yield Performance */}
                                    <section>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className={`text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-gray-400`}>
                                                <TrendingUp className={`w-4 h-4 text-primary-500`} />
                                                {t('viz_yield_trends')}
                                            </h3>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400`}>
                                                {t('viz_growth_positive')}
                                            </span>
                                        </div>
                                        <div className={`h-48 w-full rounded-3xl p-4 border bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800`}>
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
                                        <section className={`p-6 rounded-3xl border shadow-sm bg-theme-bg-card dark:bg-gray-800/80 border-gray-100 dark:border-gray-700`}>
                                            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-gray-400`}>
                                                <Sprout className={`w-4 h-4 text-green-500`} />
                                                {t('table_crops')}
                                            </h3>
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {(editData.crops || []).map((crop: string, i: number) => (
                                                            <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                                                                {crop}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditData({ ...editData, crops: editData.crops?.filter((_: string, idx: number) => idx !== i) })}
                                                                    className="ml-1 text-red-400 hover:text-red-600"
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Add crop..."
                                                            className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const input = e.target as HTMLInputElement;
                                                                    const val = input.value.trim();
                                                                    if (val && !(editData.crops || []).includes(val)) {
                                                                        setEditData({ ...editData, crops: [...(editData.crops || []), val] });
                                                                        input.value = '';
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {(farmer.crops || []).map((crop: string, i: number) => (
                                                        <span key={`${crop}-${i}`} className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400`}>
                                                            {crop}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </section>

                                        {/* Vital Stats */}
                                        <section className={`p-6 rounded-3xl border shadow-sm bg-theme-bg-card dark:bg-gray-800/80 border-gray-100 dark:border-gray-700`}>
                                            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-gray-400`}>
                                                <Activity className={`w-4 h-4 text-secondary-500`} />
                                                {t('farmer_vital_score')}
                                            </h3>
                                            <div className={`text-3xl font-black leading-none text-gray-900 dark:text-white`}>
                                                {farmer.vitalScore || 0}<span className="text-sm text-gray-400">/100</span>
                                            </div>
                                            <div className={`w-full h-1.5 rounded-full mt-3 overflow-hidden bg-gray-100 dark:bg-gray-700`}>
                                                <div className={`h-full rounded-full bg-secondary-500`} style={{ width: `${farmer.vitalScore || 0}%` }} />
                                            </div>
                                            {isEditing && (
                                                <div className="mt-4">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">Status</label>
                                                    <select
                                                        value={editData.status || 'Active'}
                                                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                                                        className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                                                    >
                                                        <option value="Active">Active</option>
                                                        <option value="Inactive">Inactive</option>
                                                        <option value="High Priority">High Priority</option>
                                                        <option value="Special Attention">Special Attention</option>
                                                    </select>
                                                </div>
                                            )}
                                        </section>
                                    </div>

                                    {/* Visit Timeline */}
                                    <section>
                                        <h3 className={`text-sm font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2 text-gray-400`}>
                                            <Clock className="w-4 h-4 text-purple-500" />
                                            {t('nav_visits')}
                                        </h3>
                                        <div className="space-y-4">
                                            {visits.length > 0 ? visits.map((visit, i) => (
                                                <div key={visit.id || i} className="relative pl-8 group">
                                                    {/* Line */}
                                                    {i !== visits.length - 1 && (
                                                        <div className={`absolute left-3 top-6 bottom-[-16px] w-0.5 transition-colors ${isCyber ? 'bg-primary-500/30' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-500'}`} />
                                                    )}
                                                    {/* Dot */}
                                                    <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 shadow-md border-white dark:border-gray-900
                                                         ${visit.status === 'completed' ? (isCyber ? 'bg-primary-500 neon-glow-primary' : 'bg-primary-500') : 'bg-accent-500'}`} />

                                                    <div
                                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${isCyber ? 'bg-primary-500/5 hover:border-primary-500/30'
                                                                : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className={`text-xs font-black uppercase tracking-tight text-gray-900 dark:text-white`}>
                                                                {visit.visit_type}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-gray-400">
                                                                {new Date(visit.scheduled_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
                                                            “{visit.reason || t('visit_routine_inspection')}”
                                                        </p>
                                                        {visit.status === 'scheduled' && (
                                                            <div className="flex gap-2 mt-3">
                                                                <button
                                                                    onClick={() => handleUpdateVisitStatus(visit.id, 'completed')}
                                                                    className="px-3 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 text-[9px] font-black uppercase tracking-widest border border-green-500/20 transition-all"
                                                                >
                                                                    Complete
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateVisitStatus(visit.id, 'cancelled')}
                                                                    className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest border border-red-500/20 transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className={`p-8 text-center rounded-3xl border border-dashed bg-gray-50/50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700`}>
                                                    <Calendar className={`w-8 h-8 mx-auto mb-2 text-gray-300`} />
                                                    <p className={`text-xs font-bold uppercase tracking-widest text-gray-400`}>{t('visit_no_history')}</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </>
                            ) : activeTab === 'history' ? (
                                <section className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className={`text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2 text-gray-400`}>
                                            <History className={`w-4 h-4 text-primary-500`} />
                                            Recent Interactions
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        {isLoadingHistory ? (
                                            <div className="flex justify-center py-10">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                            </div>
                                        ) : interactions.length > 0 ? (
                                            interactions.map((log, i) => (
                                                <div
                                                    key={log.id || `${log.type}-${i}`}
                                                    className={`p-4 rounded-2xl border bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${log.type === 'SMS' ? 'bg-blue-100 text-blue-600' : log.type === 'CHAT' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
                                                                }`}>
                                                                {log.type}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">{log.date}</span>
                                                        </div>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">{log.status}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                        {log.content || (log.type === 'CALL' ? `Outbound call duration: ${log.duration}` : '')}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 text-gray-500 uppercase text-[10px] font-bold tracking-widest">
                                                No interaction history found
                                            </div>
                                        )}
                                    </div>
                                </section>
                            ) : (
                                <SatelliteInsights farmerId={farmer.id} isCyber={isCyber} />
                            )}
                        </div>

                        {/* Footer Quick Action */}
                        <div className={`p-8 border-t flex items-center justify-between bg-white border-gray-100 dark:border-gray-800`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-secondary-100 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400`}>
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase tracking-widest text-gray-400`}>{t('visit_next_scheduled')}</p>
                                    <p className={`text-sm font-bold text-gray-900 dark:text-white`}>
                                        {nextScheduledVisit
                                            ? new Date(nextScheduledVisit.scheduled_at).toLocaleDateString()
                                            : t('no_visit_scheduled') || 'None scheduled'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleRefreshPriority}
                                    disabled={isRefreshingPriority}
                                    className={`px-4 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 border ${isCyber ? 'border-primary-500/30 text-primary-400 hover:bg-primary-500/10' : 'border-primary-200 dark:border-primary-800 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                                        } ${isRefreshingPriority ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isRefreshingPriority ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Activity className="w-4 h-4" />
                                    )}
                                    {isRefreshingPriority ? 'ANALYZING...' : 'REFRESH ANALYSIS'}
                                </button>
                                <button
                                    onClick={handleStartSynthesis}
                                    disabled={isSynthesizing}
                                    className={`px-6 py-3 rounded-2xl font-black text-xs shadow-xl transition-all flex items-center gap-2 ${isCyber ? 'bg-primary-400 shadow-primary-500/20 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20'
                                        } ${isSynthesizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSynthesizing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            GENERATING...
                                        </>
                                    ) : (
                                        <>
                                            {t('action_start_synthesis')}
                                            <ChevronRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.aside>
                </>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={async () => {
                    const { removeFarmer } = useAppStore.getState();
                    await removeFarmer(farmer.id);
                    setIsDeleteModalOpen(false);
                    onClose();
                }}
                title="Delete Farmer Profile"
                message={`Are you sure you want to permanently delete ${farmer.firstName} ${farmer.lastName}? This action cannot be undone.`}
                confirmText="Delete Farmer"
                variant="danger"
            />
            {showVideoCall && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden relative rounded-3xl border border-white/20 shadow-2xl">
                        <button
                            onClick={() => setShowVideoCall(false)}
                            className="absolute top-4 right-4 z-[110] p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="overflow-y-auto max-h-[85vh]">
                            <VideoCall
                                roomId={`farmer-${farmer.id}`}
                                userId={(storeUser as any)?.userId || 'unknown'}
                                userName={`${storeUser?.firstName} ${storeUser?.lastName}` || 'Extension Officer'}
                                isHost={true}
                                onEnd={() => setShowVideoCall(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={async () => {
                    setShowDeleteConfirm(false);
                    const { removeFarmer } = useAppStore.getState();
                    await removeFarmer(farmer.id);
                    onClose();
                }}
                title="Delete Farmer"
                message={`Are you sure you want to delete ${farmer.firstName} ${farmer.lastName}? This action cannot be undone.`}
                variant="danger"
                confirmText="Delete"
            />
        </AnimatePresence>
    );
};

export default FarmerDetailPanel;
