import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Loader2, X } from 'lucide-react';
import { VisitModal } from '@/components/forms/VisitModal';
import { FarmerDetailPanel } from '@/components/FarmerDetailPanel';
import { NotificationPanel } from '@/components/NotificationPanel';
import { ContextMenu } from '@/components/ContextMenu';
import { ShareModal } from '@/components/ShareModal';
import { ProfileModal } from '@/components/ProfileModal';
import { SettingsPanel } from '@/components/SettingsPanel';
import { HelpCenterModal } from '@/components/HelpCenterModal';
import { BulkSmsModal } from '@/components/BulkSmsModal';
import { BulkUpdateModal } from '@/components/BulkUpdateModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Farmer, Visit } from '../types/dashboard';
import { Report, downloadReport } from '@/api/reportService';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';

interface AppModalsProps {
    // Visit Modal
    showVisitModal: boolean;
    setShowVisitModal: (show: boolean) => void;
    refetchVisits: () => void;

    // Farmer Detail Panel
    isDetailPanelOpen: boolean;
    setIsDetailPanelOpen: (open: boolean) => void;
    selectedFarmer: Farmer | null;
    visits: Visit[];

    // Notification Panel
    isNotificationPanelOpen: boolean;
    setIsNotificationPanelOpen: (open: boolean) => void;

    // Context Menu
    contextMenu: { x: number; y: number; entityType: 'farmer' | 'visit' | 'report' | 'knowledge' | 'user' | 'stat'; entityId?: string; isBulk?: boolean } | null;
    hideContextMenu: () => void;
    handleMenuAction: (action: string, entityId?: string) => void;

    // Share Modal
    shareModal: { entityType: string; entityId: string; entityName?: string } | null;
    hideShareModal: () => void;

    // Profile Modal
    showProfileModal: boolean;
    setShowProfileModal: (show: boolean) => void;

    // Settings Panel
    showSettingsPanel: boolean;
    setShowSettingsPanel: (show: boolean) => void;

    // Help Center
    showHelpCenter: boolean;
    setShowHelpCenter: (show: boolean) => void;

    // Bulk SMS
    showBulkSmsComposer: boolean;
    setShowBulkSmsComposer: (show: boolean) => void;
    onBulkSmsSend: (msg: string) => void;
    selectedFarmersCount: number;
    isSendingBulkSms: boolean;

    // Bulk Update
    isBulkUpdateModalOpen: boolean;
    setIsBulkUpdateModalOpen: (open: boolean) => void;
    onBulkUpdateFarmers: (updates: Record<string, unknown>) => void;
    isUpdatingBulk: boolean;

    // Confirm Modal
    confirmModal: { title: string; message: string; variant?: 'danger' | 'warning' | 'info' | 'success'; confirmText?: string; onConfirm: () => void } | null;
    setConfirmModal: (modal: null) => void;

    // Report Generation Overlay
    isGeneratingReport: boolean;

    // Report Viewer Modal
    viewingReport: Report | null;
    setViewingReport: (report: Report | null) => void;
    reportContent: string | null;
    setReportContent: (content: string | null) => void;
    isLoadingReport: boolean;

    // Farmer Selection Modal
    showFarmerModal: boolean;
    setShowFarmerModal: (show: boolean) => void;
    farmerList: Farmer[];
    isLoadingFarmers: boolean;
    farmerSearchQuery: string;
    setFarmerSearchQuery: (query: string) => void;
    handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => void;
    activeTab: string;

    addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string; actionLabel?: string; onAction?: () => void }) => void;
}

export const AppModals: React.FC<AppModalsProps> = (props) => {
    const { isModern, btnClass, radiusClass } = useThemeClasses();
    const { t } = useLanguage();

    return (
        <>
            {/* Report Generation Overlay */}
            <AnimatePresence>
                {props.isGeneratingReport && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6`}
                        >
                            <div className="relative w-24 h-24 mx-auto">
                                <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <FileText className="w-10 h-10 text-primary-500" />
                                </div>
                            </div>
                            <div>
                                <h3 className={`text-2xl font-black 'text-gray-900 dark:text-white'`}>
                                    {t('reports_generating_title') || 'Synthesizing Data'}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                                    {t('reports_generating_desc') || 'Our AI is analyzing visit records, yield trends, and farmer interactions to generate your comprehensive report.'}
                                </p>
                            </div>
                            <div className="flex gap-2 justify-center">
                                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></span>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Report Viewer Modal */}
            {props.viewingReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                    >
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{props.viewingReport.title}</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Generated: {new Date(props.viewingReport.generatedAt).toLocaleString()} · Status: {props.viewingReport.status}
                                </p>
                            </div>
                            <button
                                onClick={() => { props.setViewingReport(null); props.setReportContent(null); }}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {props.isLoadingReport ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                </div>
                            ) : props.reportContent ? (
                                <div className="prose dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{props.reportContent}</pre>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">No content available for this report.</p>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const blob = await downloadReport(props.viewingReport!.id);
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `${props.viewingReport!.title}.pdf`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            } catch {
                                                props.addNotification({ type: 'error', message: 'Download failed' });
                                            }
                                        }}
                                        className={`mt-4 px-4 py-2 ${props.isModern ? 'bg-primary-600 hover:bg-primary-700' : 'bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-200 text-slate-900 dark:text-white'} ${props.btnClass} text-sm font-bold`}
                                    >
                                        Download Report
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
                            <button
                                onClick={async () => {
                                    try {
                                        const blob = await downloadReport(props.viewingReport!.id);
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${props.viewingReport!.title}.pdf`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    } catch {
                                        props.addNotification({ type: 'error', message: 'Download failed' });
                                    }
                                }}
                                className={`px-4 py-2 ${props.isModern ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'} ${props.btnClass} text-sm font-bold transition-colors`}
                            >
                                Download
                            </button>
                            <button
                                onClick={() => { props.setViewingReport(null); props.setReportContent(null); }}
                                className={`px-4 py-2 ${props.isModern ? 'bg-primary-600 hover:bg-primary-700' : 'bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-200 text-slate-900 dark:text-white'} ${props.btnClass} text-sm font-bold transition-colors`}
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Farmer Selection Modal */}
            {(props.activeTab === 'aiassistant' || props.activeTab === 'farmerchat') && props.showFarmerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => props.setShowFarmerModal(false)} />
                    <div className={`relative bg-white dark:bg-gray-800 ${props.radiusClass} shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden`}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">{t('chat_start_new')}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('chat_select_farmer')}</p>
                            </div>
                            <button onClick={() => props.setShowFarmerModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={t('common_search_farmers')}
                                    value={props.farmerSearchQuery}
                                    onChange={(e) => props.setFarmerSearchQuery(e.target.value)}
                                    className={`w-full pl-4 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 ${props.radiusClass} focus:ring-2 focus:ring-primary-500 dark:text-white`}
                                />
                            </div>
                        </div>
                        <div className="p-2 overflow-y-auto max-h-96">
                            {props.isLoadingFarmers ? (
                                <div className="p-8 text-center text-gray-500">{t('chat_loading_farmers')}</div>
                            ) : props.farmerList.filter(f =>
                                !props.farmerSearchQuery ||
                                `${f.firstName} ${f.lastName}`.toLowerCase().includes(props.farmerSearchQuery.toLowerCase()) ||
                                (f.region || '').toLowerCase().includes(props.farmerSearchQuery.toLowerCase()) ||
                                (f.village || '').toLowerCase().includes(props.farmerSearchQuery.toLowerCase())
                            ).length === 0 ? (
                                <div className="p-8 text-center text-gray-500">{t('chat_no_farmers')}</div>
                            ) : (
                                props.farmerList.filter(f =>
                                    !props.farmerSearchQuery ||
                                    `${f.firstName} ${f.lastName}`.toLowerCase().includes(props.farmerSearchQuery.toLowerCase()) ||
                                    (f.region || '').toLowerCase().includes(props.farmerSearchQuery.toLowerCase()) ||
                                    (f.village || '').toLowerCase().includes(props.farmerSearchQuery.toLowerCase())
                                ).map((farmer) => (
                                    <button
                                        key={farmer.id}
                                        onClick={() => props.handleStartConversation(farmer, props.activeTab === 'farmerchat' ? 'farmer' : 'ai')}
                                        className="w-full p-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                                            {farmer.firstName?.[0]}{farmer.lastName?.[0]}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900 dark:text-white">
                                                {farmer.firstName} {farmer.lastName}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {farmer.region}{farmer.village ? `, ${farmer.village}` : ''}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Visit Modal */}
            <VisitModal
                isOpen={props.showVisitModal}
                onClose={() => props.setShowVisitModal(false)}
                onSuccess={() => props.refetchVisits()}
            />

            {/* Farmer Detail Panel */}
            <FarmerDetailPanel
                isOpen={props.isDetailPanelOpen}
                onClose={() => props.setIsDetailPanelOpen(false)}
                farmer={props.selectedFarmer}
                visits={props.visits}
            />
            <NotificationPanel
                isOpen={props.isNotificationPanelOpen}
                onClose={() => props.setIsNotificationPanelOpen(false)}
            />
            {/* Global UI Elements */}
            {props.contextMenu && (
                <ContextMenu
                    x={props.contextMenu.x}
                    y={props.contextMenu.y}
                    entityType={props.contextMenu.entityType}
                    entityId={props.contextMenu.entityId}
                    isBulk={props.contextMenu.isBulk}
                    onClose={props.hideContextMenu}
                    onAction={props.handleMenuAction}
                />
            )}
            {props.shareModal && (
                <ShareModal
                    isOpen={!!props.shareModal}
                    onClose={props.hideShareModal}
                    entityType={props.shareModal.entityType}
                    entityId={props.shareModal.entityId}
                    entityName={props.shareModal.entityName}
                />
            )}
            <ProfileModal isOpen={props.showProfileModal} onClose={() => props.setShowProfileModal(false)} />
            <SettingsPanel isOpen={props.showSettingsPanel} onClose={() => props.setShowSettingsPanel(false)} />
            <HelpCenterModal isOpen={props.showHelpCenter} onClose={() => props.setShowHelpCenter(false)} />
            <BulkSmsModal
                isOpen={props.showBulkSmsComposer}
                onClose={() => props.setShowBulkSmsComposer(false)}
                onSend={props.onBulkSmsSend}
                selectedCount={props.selectedFarmersCount}
                isLoading={props.isSendingBulkSms}
            />

            <BulkUpdateModal
                isOpen={props.isBulkUpdateModalOpen}
                onClose={() => props.setIsBulkUpdateModalOpen(false)}
                onUpdate={props.onBulkUpdateFarmers}
                selectedCount={props.selectedFarmersCount}
                isLoading={props.isUpdatingBulk}
            />
            {props.confirmModal && (
                <ConfirmModal
                    isOpen={!!props.confirmModal}
                    onClose={() => props.setConfirmModal(null)}
                    onConfirm={props.confirmModal.onConfirm}
                    title={props.confirmModal.title}
                    message={props.confirmModal.message}
                    variant={props.confirmModal.variant}
                    confirmText={props.confirmModal.confirmText}
                />
            )}
        </>
    );
};
