import React from 'react';
import { appLocale } from '@/lib/appLocale';
import { AdvisoryPreferencesSection } from '@/components/advisories/AdvisoryPreferencesSection';
import { FarmerRecordingsSection } from '@/components/partners/FarmerRecordingsSection';
import { Farmer, Visit } from '@/types/dashboard';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { FarmerDetailHeader } from './FarmerDetailHeader';
import { X, TrendingUp, Clock, ChevronRight, Activity, History, FileText, Link2, ListChecks } from 'lucide-react';
import { FarmerProgressLog } from './progress/FarmerProgressLog';

type DetailTab = 'overview' | 'history' | 'progress' | 'insights';
import { VideoCall } from './VideoCall';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { useNavigate } from 'react-router-dom';

import { fetchSMSHistory } from '@/api/smsService';
import { generateSynthesis } from '@/api/chatbotService';
import { fetchPriorityScore, updateVisit } from '@/api/visitService';
import { SatelliteInsights } from './SatelliteInsights';
import { ConfirmModal } from './ConfirmModal';
import { copyWithToast } from '@/lib/copyText';
import { HistoryTabContent } from './farmerDetail/HistoryTabContent';
import { OverviewTabContent } from './farmerDetail/OverviewTabContent';

interface FarmerDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  farmer: Farmer | null;
  visits?: Visit[];
  onFarmerClick?: (farmer: Farmer | null) => void;
}
const radiusClass = 'rounded-xl';
export const FarmerDetailPanel: React.FC<FarmerDetailPanelProps> = ({
  isOpen,
  onClose,
  farmer,
  visits = [],
  onFarmerClick,
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
    showShareModal,
  } = useAppStore();

  const isCyber = themeName === 'cyber';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');
  const [isEditing, setIsEditing] = React.useState(false);
  const [editData, setEditData] = React.useState<Farmer>(farmer!);
  const [interactions, setInteractions] = React.useState<
    {
      id?: string;
      type: string;
      date: string;
      status: string;
      content: string;
      duration?: string;
    }[]
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [showVideoCall, setShowVideoCall] = React.useState(false);
  const [isSynthesizing, setIsSynthesizing] = React.useState(false);
  const [isRefreshingPriority, setIsRefreshingPriority] = React.useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [localVisits, setLocalVisits] = React.useState<Visit[]>(
    (visits ?? []) as unknown as Visit[]
  );

  React.useEffect(() => {
    setLocalVisits((visits ?? []) as unknown as Visit[]);
  }, [visits]);

  const loadInteractions = React.useCallback(async () => {
    if (!farmer?.id) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetchSMSHistory(farmer.id);
      if (res.success) {
        setInteractions(
          res.data.map(msg => ({
            id: msg.id,
            type: 'SMS',
            date: new Date(msg.created_at || Date.now()).toLocaleDateString(appLocale()),
            status:
              msg.status === 'sent' || msg.status === 'delivered'
                ? 'delivered'
                : msg.status || 'pending',
            content: msg.message,
          }))
        );
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
      message: `Updated profile for ${farmer.firstName}`,
    });
  };

  const handleShare = () => {
    if (!farmer) return;
    (
      showShareModal as (data: {
        entityType: string;
        entityId: string;
        entityName?: string;
      }) => void
    )({
      entityType: 'farmer',
      entityId: farmer.id,
      entityName: `${farmer.firstName} ${farmer.lastName}`,
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!farmer) return;
    e.preventDefault();
    (
      showContextMenu as (data: {
        x: number;
        y: number;
        entityType: string;
        entityId?: string;
      }) => void
    )({
      x: e.clientX,
      y: e.clientY,
      entityType: 'farmer',
      entityId: farmer.id,
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
          setPendingSMS({
            phone: farmer.phone || '',
            name: `${farmer.firstName || ''} ${farmer.lastName || ''}`,
          });
          navigate('/sms');
        }
        break;
      case 'call':
        if (farmer.phone) {
          window.location.href = `tel:${farmer.phone}`;
          addNotification({
            type: 'info',
            message: `${t('action_connecting') || 'Connecting to'} ${farmer.firstName}...`,
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
        visitDate: new Date().toLocaleDateString(appLocale()),
      });

      if (res.success) {
        addNotification({
          type: 'success',
          message: `AI Synthesis complete for ${farmer.firstName}`,
        });
      }
    } catch (err) {
      console.error('Synthesis failed:', err);
      addNotification({
        type: 'error',
        message: 'AI Synthesis failed to generate',
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
          message: `Priority: ${res.data.level.toUpperCase()} (score: ${res.data.score}/100) — ${res.data.recommendedAction}`,
        });
        // Switch to insights tab to show the updated data
        setActiveTab('insights');
      }
    } catch {
      addNotification({
        type: 'error',
        message: 'Failed to refresh priority analysis',
      });
    } finally {
      setIsRefreshingPriority(false);
    }
  };

  const handleUpdateVisitStatus = async (visitId: string, status: 'completed' | 'cancelled') => {
    try {
      const res = await updateVisit(visitId, { status });
      if (res.success) {
        setLocalVisits(prev => prev.map(v => (v.id === visitId ? { ...v, status } : v)));
        addNotification({
          type: 'success',
          message: `Visit marked as ${status}`,
        });
      }
    } catch (err) {
      console.error('Failed to update visit status:', err);
      addNotification({
        type: 'error',
        message: `Failed to mark visit as ${status}`,
      });
    }
  };

  const nextScheduledVisit = localVisits
    .filter(v => v.status === 'scheduled')
    .sort((a, b) => {
      const aDate = a.scheduledAt || a.scheduled_at || '9999-12-31';
      const bDate = b.scheduledAt || b.scheduled_at || '9999-12-31';
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    })[0];

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
            className="fixed inset-0 bg-slate-900/[0.04] dark:bg-black/40 backdrop-blur-sm z-[60]"
          />

          {/* Panel */}
          {/* Panel */}
          <motion.aside
            key="panel-content"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed end-0 top-0 bottom-0 w-full max-w-xl z-[70] shadow-2xl overflow-hidden flex flex-col bg-white dark:bg-theme-bg-primary backdrop-blur-2xl border-s border-slate-900/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-theme-text-primary"
            onClick={() => onFarmerClick?.(farmer)}
          >
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
            <div className="px-4 sm:px-6 py-2 border-b bg-slate-50 dark:bg-theme-bg-secondary border-slate-900/[0.08] dark:border-white/[0.08] flex items-center gap-2 text-xs overflow-x-auto scrollbar-hide">
              {[
                { id: 'overview', label: t('nav_dashboard') || 'Overview', icon: FileText },
                { id: 'history', label: t('nav_sms_history') || 'Communication', icon: History },
                { id: 'progress', label: t('farmer_tab_progress', 'Progress'), icon: ListChecks },
                { id: 'insights', label: t('nav_analytics') || 'Insights', icon: TrendingUp },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as DetailTab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar overflow-x-hidden">
              {activeTab === 'overview' ? (
                <OverviewTabContent
                  farmer={farmer}
                  isCyber={isCyber}
                  radiusClass={radiusClass}
                  isEditing={isEditing}
                  editData={editData as unknown as Record<string, unknown>}
                  setEditData={setEditData as unknown as (d: Record<string, unknown>) => void}
                  visits={visits}
                  handleUpdateVisitStatus={
                    handleUpdateVisitStatus as unknown as (id: string, st: string) => void
                  }
                  handleAction={handleAction as unknown as (a: string) => void}
                  showContextMenu={showContextMenu as unknown as (e: React.MouseEvent) => void}
                  t={t}
                />
              ) : activeTab === 'history' ? (
                <HistoryTabContent
                  interactions={interactions}
                  isLoadingHistory={isLoadingHistory}
                  radiusClass={radiusClass}
                />
              ) : activeTab === 'progress' ? (
                <FarmerProgressLog farmerId={farmer.id} crops={farmer.crops ?? []} />
              ) : (
                <SatelliteInsights farmerId={farmer.id} isCyber={isCyber} />
              )}
            </div>

            <div className="px-4 pb-2 space-y-4">
              <AdvisoryPreferencesSection farmerId={farmer.id} />
              <FarmerRecordingsSection farmerId={farmer.id} farmerName={`${farmer.firstName} ${farmer.lastName}`} />
            </div>

            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-theme-bg-secondary border-slate-900/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[4px] flex items-center justify-center bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-medium text-slate-600 dark:text-theme-text-muted">
                    {t('visit_next_scheduled') || 'Next scheduled'}
                  </p>
                  <p className="text-xs font-medium text-slate-900 dark:text-theme-text-primary truncate">
                    {(() => {
                      if (!nextScheduledVisit) return t('no_visit_scheduled') || 'None scheduled';
                      const raw = nextScheduledVisit.scheduledAt || nextScheduledVisit.scheduled_at;
                      return raw && !isNaN(new Date(raw).getTime())
                        ? new Date(raw).toLocaleDateString(appLocale())
                        : t('no_visit_scheduled') || 'None scheduled';
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  loading={isRefreshingPriority}
                  onClick={handleRefreshPriority}
                  className="font-medium text-xs !rounded-[4px] !bg-slate-800 !hover:bg-slate-700 !text-slate-200 !border-slate-700"
                >
                  <Activity className="w-3.5 h-3.5" />
                  {t('ui_farmer_detail_panel_refresh')}
                </Button>
                <Button
                  loading={isSynthesizing}
                  onClick={handleStartSynthesis}
                  className="font-medium text-xs !rounded-[4px] !bg-emerald-600 !hover:bg-emerald-500 !text-white border border-slate-900/[0.08] dark:border-white/[0.08] shadow-sm"
                >
                  {t('action_start_synthesis') || 'Start synthesis'}
                  <ChevronRight className="w-3.5 h-3.5" />
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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/[0.04] dark:bg-black/40 backdrop-blur-md"
        >
          <div
            className={`w-full max-w-4xl max-h-[90vh] overflow-hidden relative ${radiusClass} border border-slate-900/[0.08] dark:border-white/[0.08] shadow-2xl`}
          >
            <button
              onClick={() => {
                const inviteLink = `${window.location.origin}/tele-call/farmer-${farmer.id}`;
                void copyWithToast(inviteLink, 'Invite link copied — share it with the farmer to join this call.');
              }}
              className="absolute top-4 end-16 z-[110] px-3 py-2 bg-slate-900/[0.04] dark:bg-black/40 hover:bg-black/70 text-slate-900 dark:text-theme-text-primary text-xs font-medium rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5"
            >
              <Link2 className="w-4 h-4" />
              {t('ui_farmer_detail_panel_invite')}
            </button>
            <button
              onClick={() => setShowVideoCall(false)}
              aria-label="Close video call"
              className="absolute top-4 end-4 z-[110] p-2 bg-slate-900/[0.04] dark:bg-black/40 hover:bg-black/70 text-slate-900 dark:text-theme-text-primary rounded-xl backdrop-blur-md transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="overflow-y-auto max-h-[85vh]">
              <VideoCall
                roomId={`farmer-${farmer.id}`}
                userId={storeUser?.id || 'host-user'}
                userName={
                  `${storeUser?.firstName || ''} ${storeUser?.lastName || ''}`.trim() ||
                  'Extension Officer'
                }
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
