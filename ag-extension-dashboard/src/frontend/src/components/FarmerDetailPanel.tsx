import React from 'react';
import { Farmer, Visit } from '@/types/dashboard';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Badge } from './ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmerDetailHeader } from './FarmerDetailHeader';
import { FarmerYieldChart } from './FarmerYieldChart';
import { FarmerVisitTimeline } from './FarmerVisitTimeline';
import {
    X,
    TrendingUp,
    MessageSquare,
    Phone,
    Video,
    Clock,
    ChevronRight,
    Sprout,
    Activity,
    Mail,
    History,
    FileText,
    Loader2
} from 'lucide-react';
import { VideoCall } from './VideoCall';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { useNavigate } from 'react-router-dom';

import { fetchSMSHistory } from '@/api/smsService';
import { generateSynthesis } from '@/api/chatbotService';
import { fetchPriorityScore, updateVisit } from '@/api/visitService';
import { SatelliteInsights } from './SatelliteInsights';
import { ConfirmModal } from './ConfirmModal';

interface FarmerDetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    farmer: Farmer | null;
    visits?: Visit[];
}
const isModern = true;
const radiusClass = 'rounded-2xl';

const getLogTypeColor = (type: string) => {
    if (type === 'SMS') return 'bg-blue-100 text-blue-600';
    if (type === 'CHAT') return 'bg-purple-100 text-purple-600';
    return 'bg-green-100 text-green-600';
};

const getLogContent = (log: Record<string, unknown>) => {
    if (log.content) return log.content as string;
    if (log.type === 'CALL') return `Outbound call duration: ${log.duration}`;
    return '';
};

const HistoryTabContent = ({ interactions, isLoadingHistory, radiusClass }: { interactions: Array<Record<string, unknown>>, isLoadingHistory: boolean, radiusClass: string }) => (
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
                interactions.map((log, i: number) => (
                    <div
                        key={(log.id as string) || `${log.type}-${i}`}
                        className={`p-4 ${radiusClass} border bg-gray-50/50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getLogTypeColor(log.type as string)}`}>
                                    {log.type as string}
                                </span>
                                <span className="text-xxs text-gray-400">{log.date as string}</span>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">{log.status as string}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                            {getLogContent(log)}
                        </p>
                    </div>
                ))
            ) : (
                <div className="text-center py-10 text-gray-500 uppercase text-xxs font-bold tracking-widest">
                    No interaction history found
                </div>
            )}
        </div>
    </section>
);

const CropsSection = ({ farmer, isEditing, editData, setEditData, radiusClass, t }: { farmer: Farmer, isEditing: boolean, editData: Record<string, unknown>, setEditData: (d: Record<string, unknown>) => void, radiusClass: string, t: (key: string) => string }) => (
    <section className={`p-6 ${radiusClass} border shadow-sm bg-theme-bg-card dark:bg-gray-800/80 border-gray-100 dark:border-gray-700`}>
        <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-gray-400`}>
            <Sprout className={`w-4 h-4 text-green-500`} />
            {t('table_crops')}
        </h3>
        {isEditing ? (
            <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                    {((editData.crops as string[]) || []).map((crop: string, i: number) => (
                        <Badge key={i} variant="info" size="sm" className="flex items-center gap-1">
                            {crop}
                            <button
                                type="button"
                                onClick={() => setEditData({ ...editData, crops: (editData.crops as string[])?.filter((_: string, idx: number) => idx !== i) })}
                                className="ml-1 text-red-400 hover:text-red-600"
                            >
                                ×
                            </button>
                        </Badge>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Input
                        size="sm"
                        placeholder="Add crop..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.target as HTMLInputElement;
                                const val = input.value.trim();
                                if (val && !((editData.crops as string[]) || []).includes(val)) {
                                    setEditData({ ...editData, crops: [...((editData.crops as string[]) || []), val] });
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
                    <Badge key={`${crop}-${i}`} variant="info" size="sm">{crop}</Badge>
                ))}
            </div>
        )}
    </section>
);

const VitalStatsSection = ({ farmer, isEditing, editData, setEditData, radiusClass, t }: { farmer: Farmer, isEditing: boolean, editData: Record<string, unknown>, setEditData: (d: Record<string, unknown>) => void, radiusClass: string, t: (key: string) => string }) => (
    <section className={`p-6 ${radiusClass} border shadow-sm bg-theme-bg-card dark:bg-gray-800/80 border-gray-100 dark:border-gray-700`}>
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
                <label className="text-xxs font-black uppercase tracking-widest text-gray-400 block mb-1">Status</label>
                <Select
                    value={(editData.status as string) || 'Active'}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    options={[
                        { value: 'Active', label: 'Active' },
                        { value: 'Inactive', label: 'Inactive' },
                        { value: 'High Priority', label: 'High Priority' },
                        { value: 'Special Attention', label: 'Special Attention' },
                    ]}
                    size="sm"
                />
            </div>
        )}
    </section>
);

const OverviewTabContent = ({
    farmer, isCyber, radiusClass, isEditing, editData, setEditData,
    visits, handleUpdateVisitStatus, handleAction, showContextMenu, t
}: { farmer: Farmer; isCyber: boolean; radiusClass: string; isEditing: boolean; editData: Record<string, unknown>; setEditData: (d: Record<string, unknown>) => void; visits: Visit[] | undefined; handleUpdateVisitStatus: (id: string, st: string) => void; handleAction: (a: string) => void; showContextMenu: (e: React.MouseEvent) => void; t: (key: string) => string }) => (
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
                    onClick={() => handleAction(action.id as 'chat' | 'sms' | 'call' | 'video')}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        (showContextMenu as unknown as (data: { x: number; y: number; entityType: string; entityId?: string }) => void)({ x: e.clientX, y: e.clientY, entityType: 'farmer', entityId: farmer.id });
                    }}
                    className="flex flex-col items-center gap-2 group"
                >
                    <div className={`w-12 h-12 ${radiusClass} ${action.color} flex items-center justify-center shadow-lg transition-all group-hover:scale-110 group-hover:rotate-3 outline outline-4 outline-transparent hover:outline-white/20`}>
                        <action.icon className="w-6 h-6" />
                    </div>
                    <span className={`text-xxs font-black uppercase tracking-widest transition-colors ${isCyber ? 'text-primary-300' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200'}`}>
                        {action.label}
                    </span>
                </button>
            ))}
        </div>

        {/* Yield Performance */}
        <FarmerYieldChart
            farmer={farmer}
            radiusClass={radiusClass}
        />            <div className="grid grid-cols-2 gap-6">
            <CropsSection
                farmer={farmer}
                isEditing={isEditing}
                editData={editData as unknown as Record<string, unknown>}
                setEditData={setEditData as unknown as (d: Record<string, unknown>) => void}
                radiusClass={radiusClass}
                t={t}
            />
            <VitalStatsSection
                farmer={farmer}
                isEditing={isEditing}
                editData={editData as unknown as Record<string, unknown>}
                setEditData={setEditData as unknown as (d: Record<string, unknown>) => void}
                radiusClass={radiusClass}
                t={t}
            />
        </div>

        {/* Visit Timeline */}
        <FarmerVisitTimeline
            visits={visits}
            handleUpdateVisitStatus={handleUpdateVisitStatus as unknown as (id: string, st: string) => void}
            radiusClass={radiusClass}
            isCyber={isCyber}
        />
    </>
);
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
    
    const isCyber = themeName === 'cyber' && isModern;
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = React.useState<'overview' | 'history' | 'insights'>('overview');
    const [isEditing, setIsEditing] = React.useState(false);
    const [editData, setEditData] = React.useState<Farmer>(farmer!);
    const [interactions, setInteractions] = React.useState<{ id?: string; type: string; date: string; status: string; content: string; duration?: string }[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
    const [showVideoCall, setShowVideoCall] = React.useState(false);
    const [isSynthesizing, setIsSynthesizing] = React.useState(false);
    const [isRefreshingPriority, setIsRefreshingPriority] = React.useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [localVisits, setLocalVisits] = React.useState<Visit[]>((visits ?? []) as unknown as Visit[]);

    React.useEffect(() => {
        setLocalVisits((visits ?? []) as unknown as Visit[]);
    }, [visits]);

    const loadInteractions = React.useCallback(async () => {
        if (!farmer?.id) return;
        setIsLoadingHistory(true);
        try {
            const res = await fetchSMSHistory(farmer.id);
            if (res.success) {
                setInteractions(res.data.map((msg) => ({
                    id: msg.id,
                    type: 'SMS',
                    date: new Date(msg.created_at).toLocaleDateString(),
                    status: msg.status === 'sent' ? 'delivered' : msg.status,
                    content: msg.message
                })));
            }
        } catch (err) {
            console.error('Failed to load interactions:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [farmer?.id]);

    React.useEffect(() => {
        if (farmer) setEditData(farmer);
        if (activeTab === 'history') {
            loadInteractions();
        }
    }, [farmer, activeTab, loadInteractions]);

    const handleSave = () => {
        if (!farmer) return;
        (updateFarmer as (id: string, data: unknown) => void)(farmer.id, editData);
        setIsEditing(false);
        addNotification({
            type: 'success',
            message: `Updated profile for ${farmer.firstName}`
        });
    };

    const handleShare = () => {
        if (!farmer) return;
        (showShareModal as (data: { entityType: string; entityId: string; entityName?: string }) => void)({
            entityType: 'farmer',
            entityId: farmer.id,
            entityName: `${farmer.firstName} ${farmer.lastName}`
        });
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!farmer) return;
        e.preventDefault();
        (showContextMenu as (data: { x: number; y: number; entityType: string; entityId?: string }) => void)({
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
                        style={{ borderTopLeftRadius: 'var(--radius-card)', borderBottomLeftRadius: 'var(--radius-card)' }}
                    >
                        {/* Header Section */}
                        <FarmerDetailHeader
                            farmer={farmer}
                            editData={editData}
                            setEditData={setEditData}
                            isEditing={isEditing}
                            setIsEditing={setIsEditing}
                            handleSave={handleSave}
                            handleShare={handleShare}
                            handleContextMenu={handleContextMenu}
                            setIsDeleteModalOpen={setIsDeleteModalOpen}
                            onClose={onClose}
                            radiusClass={radiusClass}
                            isCyber={isCyber}
                        />

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
                                        onClick={() => setActiveTab(tab.id as 'overview' | 'history' | 'insights')}
                                        className={`pb-4 text-xxs font-black uppercase tracking-[0.2em] relative transition-all ${activeTab === tab.id
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
                                <OverviewTabContent
                                    farmer={farmer}
                                    isCyber={isCyber}
                                    radiusClass={radiusClass}
                                    isEditing={isEditing}
                                    editData={editData as unknown as Record<string, unknown>}
                                    setEditData={setEditData as unknown as (d: Record<string, unknown>) => void}
                                    visits={visits}
                                    handleUpdateVisitStatus={handleUpdateVisitStatus as unknown as (id: string, st: string) => void}
                                    handleAction={handleAction as unknown as (a: string) => void}
                                    showContextMenu={showContextMenu as unknown as (e: React.MouseEvent) => void}
                                    t={t}
                                />
                            ) : activeTab === 'history' ? (
                                <HistoryTabContent interactions={interactions} isLoadingHistory={isLoadingHistory} radiusClass={radiusClass} />
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
                                    <p className={`text-xxs font-black uppercase tracking-widest text-gray-400`}>{t('visit_next_scheduled')}</p>
                                    <p className={`text-sm font-bold text-gray-900 dark:text-white`}>
                                        {nextScheduledVisit
                                            ? new Date(nextScheduledVisit.scheduled_at).toLocaleDateString()
                                            : t('no_visit_scheduled') || 'None scheduled'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="secondary"
                                    loading={isRefreshingPriority}
                                    onClick={handleRefreshPriority}
                                    className="font-black text-xs"
                                >
                                    <Activity className="w-4 h-4" />
                                    REFRESH ANALYSIS
                                </Button>
                                <Button
                                    loading={isSynthesizing}
                                    onClick={handleStartSynthesis}
                                    className="font-black text-xs"
                                >
                                    {t('action_start_synthesis')}
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.aside>
                </>
            )}

            <ConfirmModal
                key="delete-profile-modal"
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
                <motion.div
                    key="video-call-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                >
                    <div className={`w-full max-w-4xl max-h-[90vh] overflow-hidden relative ${radiusClass} border border-white/20 shadow-2xl`}>
                        <button
                            onClick={() => setShowVideoCall(false)}
                            className="absolute top-4 right-4 z-[110] p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="overflow-y-auto max-h-[85vh]">
                            <VideoCall
                                roomId={`farmer-${farmer.id}`}
                                userId={((storeUser as { userId?: string } | null | undefined)?.userId) || 'unknown'}
                                userName={`${storeUser?.firstName} ${storeUser?.lastName}` || 'Extension Officer'}
                                isHost={true}
                                onEnd={() => setShowVideoCall(false)}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default FarmerDetailPanel;