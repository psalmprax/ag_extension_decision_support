import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { fetchFarmers } from '@/api/farmerService';
import { generateReport } from '@/api/reportService';
import { logout as apiLogout } from '@/api/authService';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useModalState } from '@/hooks/useModalState';
import { useDashboardQueries } from '@/hooks/useDashboardQueries';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getNavItems } from '@/config/navItems';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppModals } from '@/components/AppModals';
import { TabContent } from '@/components/layout/TabContent';
import { Farmer } from '@/types/dashboard';
import { useAppSync } from '@/hooks/useAppSync';
import { useAppShortcuts } from '@/hooks/useAppShortcuts';
import { useBulkActions } from '@/hooks/useBulkActions';
import { useAppSearch } from '@/hooks/useAppSearch';
import { useAppChat } from '@/hooks/useAppChat';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useAppAuth } from '@/hooks/useAppAuth';

export function AuthenticatedLayout() {
    const { t, language } = useLanguage();
    const {
        themeName, setThemeName,
        darkMode, setDarkMode,
        sidebarOpen, setSidebarOpen,
        activeTab, setActiveTab,
        farmers: storeFarmers,
        user: storeUser, setUser,
        addNotification,
        contextMenu, hideContextMenu,
        shareModal, hideShareModal, showShareModal,
        removeFarmer, removeFarmers,
    } = useAppStore();

    const { isModern, headingClass } = useThemeClasses();

    // Extracted hooks
    useAppTheme(themeName, darkMode);
    const { weatherLocation } = useAppBootstrap(storeUser, setActiveTab);
    const { user, isOfficer } = useAppAuth(storeUser, setUser as (user: unknown) => void);
    const {
        isNotificationPanelOpen, setIsNotificationPanelOpen,
        isProfileMenuOpen, setIsProfileMenuOpen,
        showProfileModal, setShowProfileModal,
        showSettingsPanel, setShowSettingsPanel,
        showHelpCenter, setShowHelpCenter,
        isDetailPanelOpen, setIsDetailPanelOpen,
        showVisitModal, setShowVisitModal,
        showFarmerModal, setShowFarmerModal,
        viewingReport, setViewingReport,
        showBulkSmsComposer, setShowBulkSmsComposer,
        bulkSmsMessage, setBulkSmsMessage,
        confirmModal, setConfirmModal,
        isBulkUpdateModalOpen, setIsBulkUpdateModalOpen,
        isUpdatingBulk, setIsUpdatingBulk,
        isLoadingReport, setIsLoadingReport,
        reportContent, setReportContent,
    } = useModalState();

    // Data state not in useModalState
    const [searchQuery, setSearchQuery] = useState('');
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedFarmers, setSelectedFarmers] = useState<Set<string>>(new Set());
    const [farmerList, setFarmerList] = useState<Farmer[]>([]);
    const [isLoadingFarmers, setIsLoadingFarmers] = useState(false);
    const [farmerSearchQuery, setFarmerSearchQuery] = useState('');

    const {
        dashboardData,
        isLoading,
        isError,
        effectiveFarmers,
        visits,
        refetchVisits,
        reports,
        refetchReports,
        performanceData,
        transactions,
        apiUnreadCount,
    } = useDashboardQueries(activeTab, searchQuery);

    // Logout handler
    const handleLogout = async () => {
        await apiLogout();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    // Context menu action handler
    const handleMenuAction = (action: string, entityId?: string) => {
        if (action.startsWith('share_')) {
            const type = action.split('_')[1];
            const entity = storeFarmers?.find(f => f.id === entityId);
            showShareModal({
                entityType: type, entityId: entityId || '',
                entityName: entity ? `${entity.firstName} ${entity.lastName}` : undefined
            });
        } else if (action === 'schedule_visit') {
            setShowVisitModal(true);
        } else if (action === 'export_farmer' || action.startsWith('export_')) {
            if (entityId) {
                const farmer = storeFarmers?.find(f => f.id === entityId);
                if (farmer) {
                    const csvContent = [
                        ['Name', 'Phone', 'Region', 'Village', 'Crops', 'Farm Size (ha)'],
                        [`"${farmer.firstName} ${farmer.lastName}"`, `"${farmer.phone || ''}"`, `"${farmer.region || ''}"`, `"${farmer.village || ''}"`, `"${farmer.crops?.join(', ') || ''}"`, `"${farmer.farmSize?.toString() || ''}"`]
                    ].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `farmer_${entityId}_export.csv`; a.click();
                    URL.revokeObjectURL(url);
                    addNotification({ type: 'success', message: 'Farmer data exported successfully' });
                }
            }
        } else if (action.includes('delete')) {
            setConfirmModal({
                title: 'Confirm Action', message: `Are you sure you want to perform this action: ${action}?`,
                variant: 'danger', confirmText: 'Delete',
                onConfirm: () => {
                    setConfirmModal(null);
                    if (action.startsWith('farmer') && entityId) {
                        removeFarmer(entityId);
                        addNotification({ type: 'success', message: 'Farmer record deleted successfully' });
                    } else {
                        addNotification({ type: 'info', message: 'Action executed successfully' });
                    }
                }
            });
        }
    };

    // Custom hooks
    const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useAppSync(addNotification);
    const { showGlobalSearch, setShowGlobalSearch, isGlobalSearching, globalSearchResults, handleGlobalSearch } = useAppSearch(effectiveFarmers, visits, reports, transactions);
    const {
        conversations, activeConvId, setActiveConvId, chatMessages, setChatMessages,
        chatInput, setChatInput, isTyping, setIsTyping,
        loadConversations, loadMessages, loadFarmerConversations, loadFarmerMessages,
        farmerConversations, activeFarmerConvId, setActiveFarmerConvId,
        farmerChatMessages, farmerChatInput, setFarmerChatInput,
        handleFarmerChatSend, handleStartConversation
    } = useAppChat(language);
    const {
        isSendingBulkSms, handleSelectFarmer, handleSelectAllFarmers,
        handleBulkSMS, onBulkSmsSend, handleBulkDelete, onBulkUpdateFarmers, handleBulkExport
    } = useBulkActions({
        effectiveFarmers, selectedFarmers, setSelectedFarmers, addNotification,
        setActiveTab, setShowBulkSmsComposer, setConfirmModal,
        setIsUpdatingBulk, setIsBulkUpdateModalOpen, removeFarmers, setFarmerList
    });
    useAppShortcuts({
        sidebarOpen, setSidebarOpen,
        isNotificationPanelOpen, setIsNotificationPanelOpen,
        isProfileMenuOpen, setIsProfileMenuOpen,
        showProfileModal, setShowProfileModal,
        showSettingsPanel, setShowSettingsPanel,
        showHelpCenter, setShowHelpCenter,
        isDetailPanelOpen, setIsDetailPanelOpen,
        showVisitModal, setShowVisitModal,
        showFarmerModal, setShowFarmerModal,
        showGlobalSearch, setShowGlobalSearch,
        viewingReport, setViewingReport,
        showBulkSmsComposer, setShowBulkSmsComposer,
        confirmModal, setConfirmModal
    });

    // Chat data loading effects
    React.useEffect(() => {
        if (!user) return;
        if (activeTab === 'aiassistant') loadConversations();
        if (activeTab === 'farmerchat') loadFarmerConversations();
    }, [activeTab, loadConversations, loadFarmerConversations, user]);

    React.useEffect(() => {
        if (!user || !activeConvId) return;
        loadMessages(activeConvId);
    }, [activeConvId, loadMessages, user]);

    // Report generation handler
    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            await generateReport('synthesis', 'AI Synthesis Report');
            addNotification({ type: 'success', message: t('reports_generated_success') || 'Report generated!' });
            refetchReports();
        } catch {
            addNotification({ type: 'error', message: 'Failed to generate report.' });
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // Open farmer detail panel
    const handleOpenFarmerDetail = (farmer: Farmer) => {
        setSelectedFarmer(farmer);
        setIsDetailPanelOpen(true);
    };

    // Load farmers into list
    const loadFarmers = async () => {
        try {
            setIsLoadingFarmers(true);
            const res = await fetchFarmers();
            setFarmerList(res.data?.farmers || []);
        } catch {
            setFarmerList([]);
        } finally {
            setIsLoadingFarmers(false);
        }
    };

    if (user && isError) return <div className="flex items-center justify-center min-h-screen text-red-500 bg-gray-50 dark:bg-gray-900">{t('error_loading')}</div>;

    const navItems = getNavItems(isModern).filter(item => !user || item.roles.includes(user.role));

    return (
        <div
            className={`h-screen flex flex-col ${darkMode ? 'dark' : ''} bg-theme-bg-primary transition-colors duration-300 overflow-hidden relative z-0`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        >
            {/* Ambient Aurora Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 hidden dark:block">
                <motion.div animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[10%] -left-[10%] w-[800px] h-[800px] bg-blue-600/30 mix-blend-screen rounded-full blur-[150px]" />
                <motion.div animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-purple-600/30 mix-blend-screen rounded-full blur-[180px]" />
            </div>

            {/* Drag overlay */}
            {isDragOver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl text-center">
                        <Loader2 className="w-16 h-16 text-primary-500 mx-auto mb-4 animate-spin" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('upload_processing')}</h3>
                    </div>
                </div>
            )}

            <AppHeader
                sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
                activeTab={activeTab} setActiveTab={setActiveTab}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                showGlobalSearch={showGlobalSearch} setShowGlobalSearch={setShowGlobalSearch}
                isGlobalSearching={isGlobalSearching} globalSearchResults={globalSearchResults}
                handleGlobalSearch={handleGlobalSearch}
                weatherLocation={weatherLocation} setWeatherLocation={() => {}}
                apiUnreadCount={apiUnreadCount}
                storeUser={storeUser} handleLogout={handleLogout}
                handleOpenFarmerDetail={handleOpenFarmerDetail} farmers={effectiveFarmers}
                addNotification={addNotification}
                setIsNotificationPanelOpen={setIsNotificationPanelOpen}
                isProfileMenuOpen={isProfileMenuOpen} setIsProfileMenuOpen={setIsProfileMenuOpen}
                setShowProfileModal={setShowProfileModal} setShowSettingsPanel={setShowSettingsPanel}
            />

            <div className="flex flex-1 overflow-hidden pt-16">
                <AppSidebar
                    sidebarOpen={sidebarOpen} navItems={navItems}
                    activeTab={activeTab} setActiveTab={setActiveTab}
                    setShowHelpCenter={setShowHelpCenter}
                    onGenerateReport={handleGenerateReport}
                />

                <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : ''} relative`}>
                    <ErrorBoundary componentName="MainContent">
                        <TabContent
                            activeTab={activeTab}
                            isModern={isModern}
                            headingClass={headingClass}
                            // Dashboard
                            dashboardData={dashboardData}
                            isLoading={isLoading}
                            isOfficer={isOfficer}
                            performanceData={performanceData}
                            effectiveFarmers={effectiveFarmers}
                            isMapExpanded={isMapExpanded}
                            setIsMapExpanded={setIsMapExpanded}
                            handleStartConversation={handleStartConversation}
                            handleOpenFarmerDetail={handleOpenFarmerDetail}
                            user={user}
                            addNotification={addNotification}
                            // Portfolio
                            selectedFarmers={selectedFarmers}
                            handleSelectFarmer={handleSelectFarmer}
                            showBulkSmsComposer={showBulkSmsComposer}
                            setShowBulkSmsComposer={setShowBulkSmsComposer}
                            bulkSmsMessage={bulkSmsMessage}
                            setBulkSmsMessage={setBulkSmsMessage}
                            handleBulkSMS={handleBulkSMS}
                            handleBulkExport={handleBulkExport}
                            handleBulkDelete={handleBulkDelete}
                            setSelectedFarmers={setSelectedFarmers}
                            // Visits
                            visits={visits}
                            setShowVisitModal={setShowVisitModal}
                            refetchVisits={refetchVisits}
                            // Reports
                            reports={reports}
                            handleGenerateReport={handleGenerateReport}
                            isGeneratingReport={isGeneratingReport}
                            viewingReport={viewingReport}
                            setViewingReport={setViewingReport}
                            reportContent={reportContent}
                            setReportContent={setReportContent}
                            isLoadingReport={isLoadingReport}
                            setIsLoadingReport={setIsLoadingReport}
                            // Farmer Chat
                            farmerConversations={farmerConversations}
                            activeFarmerConvId={activeFarmerConvId}
                            setActiveFarmerConvId={setActiveFarmerConvId}
                            loadFarmerMessages={loadFarmerMessages}
                            farmerChatMessages={farmerChatMessages}
                            farmerChatInput={farmerChatInput}
                            setFarmerChatInput={setFarmerChatInput}
                            handleFarmerChatSend={handleFarmerChatSend}
                            loadFarmers={loadFarmers}
                            setShowFarmerModal={setShowFarmerModal}
                        />
                    </ErrorBoundary>
                </main>
            </div>

            <AppModals
                showVisitModal={showVisitModal} setShowVisitModal={setShowVisitModal} refetchVisits={refetchVisits}
                isDetailPanelOpen={isDetailPanelOpen} setIsDetailPanelOpen={setIsDetailPanelOpen}
                selectedFarmer={selectedFarmer} visits={visits}
                isNotificationPanelOpen={isNotificationPanelOpen} setIsNotificationPanelOpen={setIsNotificationPanelOpen}
                contextMenu={contextMenu} hideContextMenu={hideContextMenu} handleMenuAction={handleMenuAction}
                shareModal={shareModal} hideShareModal={hideShareModal}
                showProfileModal={showProfileModal} setShowProfileModal={setShowProfileModal}
                showSettingsPanel={showSettingsPanel} setShowSettingsPanel={setShowSettingsPanel}
                showHelpCenter={showHelpCenter} setShowHelpCenter={setShowHelpCenter}
                showBulkSmsComposer={showBulkSmsComposer} setShowBulkSmsComposer={setShowBulkSmsComposer}
                onBulkSmsSend={onBulkSmsSend} selectedFarmersCount={selectedFarmers.size} isSendingBulkSms={isSendingBulkSms}
                isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
                onBulkUpdateFarmers={onBulkUpdateFarmers} isUpdatingBulk={isUpdatingBulk}
                confirmModal={confirmModal} setConfirmModal={setConfirmModal}
                isGeneratingReport={isGeneratingReport}
                viewingReport={viewingReport} setViewingReport={setViewingReport}
                reportContent={reportContent} setReportContent={setReportContent} isLoadingReport={isLoadingReport}
                showFarmerModal={showFarmerModal} setShowFarmerModal={setShowFarmerModal}
                farmerList={farmerList} isLoadingFarmers={isLoadingFarmers}
                farmerSearchQuery={farmerSearchQuery} setFarmerSearchQuery={setFarmerSearchQuery}
                handleStartConversation={handleStartConversation} activeTab={activeTab}
                addNotification={addNotification}
            />
        </div>
    );
}
