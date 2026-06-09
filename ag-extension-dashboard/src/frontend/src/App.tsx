import React from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { useState, useCallback, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { logout as apiLogout } from '@/api/authService';
import { fetchFarmers } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchReports, generateReport, Report } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { getMyTransactions } from '@/api/billingService';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getNavItems } from './config/navItems';
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppModals } from './components/AppModals';
import { DashboardPage } from './pages/DashboardPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { VisitsPage } from './pages/VisitsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { FarmerChatPage } from './pages/FarmerChatPage';
import { Farmer } from './types/dashboard';
import { useAppSync } from './hooks/useAppSync';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useBulkActions } from './hooks/useBulkActions';
import { useAppSearch } from './hooks/useAppSearch';
import { useAppChat } from './hooks/useAppChat';
import { useAppTheme } from './hooks/useAppTheme';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppAuth } from './hooks/useAppAuth';
import { fetchUnreadCount } from '@/api/notificationService';
import { ThemeName } from '@/theme';

// Lazy loaded components
const FarmerDashboard = lazy(() => import('@/components/FarmerDashboard').then(m => ({ default: m.FarmerDashboard })));
const BillingDashboard = lazy(() => import('@/components/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const VisitSynthesisForm = lazy(() => import('@/components/forms/VisitSynthesisForm').then(m => ({ default: m.VisitSynthesisForm })));
const FarmerRegistrationForm = lazy(() => import('@/components/forms/FarmerRegistrationForm').then(m => ({ default: m.FarmerRegistrationForm })));
const Telemetry = lazy(() => import('./pages/Telemetry'));
const Agents = lazy(() => import('./pages/Agents'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const DiseaseDiagnosisPage = lazy(() => import('./pages/DiseaseDiagnosis').then(m => ({ default: m.DiseaseDiagnosis })));
const Memory = lazy(() => import('./pages/Memory'));
const EmailWorkflows = lazy(() => import('./pages/EmailWorkflows'));
const MCPTools = lazy(() => import('./pages/MCPTools'));
const SMSPage = lazy(() => import('./pages/SMS').then(m => ({ default: m.SMSPage })));
const AlphaAI = lazy(() => import('./components/Cyber/AlphaAI'));
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const DemoPage = lazy(() => import('./pages/DemoPage').then(m => ({ default: m.DemoPage })));

function App() {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
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
        toggleDesignSystemMode
    } = useAppStore();

    const {
        isModern, headingClass
    } = useThemeClasses();

    // Theme, auth, and bootstrap hooks
    useAppTheme(themeName, darkMode);
    const { weatherLocation } = useAppBootstrap(storeUser, setActiveTab);
    const { user, isOfficer } = useAppAuth(storeUser, setUser as (user: unknown) => void);

    // Logout handler
    const handleLogout = async () => {
        await apiLogout();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    // UI modal state
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [showHelpCenter, setShowHelpCenter] = useState(false);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [showFarmerModal, setShowFarmerModal] = useState(false);
    const [viewingReport, setViewingReport] = useState<Report | null>(null);
    const [showBulkSmsComposer, setShowBulkSmsComposer] = useState(false);
    const [bulkSmsMessage, setBulkSmsMessage] = useState('');
    const [confirmModal, setConfirmModal] = useState<{
        title: string; message: string; onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info' | 'success'; confirmText?: string;
    } | null>(null);

    // Data state
    const [searchQuery, setSearchQuery] = useState('');
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedFarmers, setSelectedFarmers] = useState<Set<string>>(new Set());
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportContent, setReportContent] = useState<string | null>(null);
    const [apiUnreadCount, setApiUnreadCount] = useState(0);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
    const [farmerList, setFarmerList] = useState<Farmer[]>([]);
    const [isLoadingFarmers, setIsLoadingFarmers] = useState(false);
    const [farmerSearchQuery, setFarmerSearchQuery] = useState('');

    // Fetch unread notification count
    React.useEffect(() => {
        if (!storeUser || !localStorage.getItem('token')) return;
        const loadUnreadCount = async () => {
            try { setApiUnreadCount(await fetchUnreadCount()); } catch { /* fallback */ }
        };
        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 60000);
        return () => clearInterval(interval);
    }, [storeUser]);

    const handleOpenFarmerDetail = (farmer: Farmer) => {
        setSelectedFarmer(farmer);
        setIsDetailPanelOpen(true);
    };

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

    // Data queries
    const { data: dashboardResponse, isLoading, isError } = useQuery({
        queryKey: ['dashboard'], queryFn: fetchDashboardData,
        enabled: activeTab === 'dashboard' && !!user
    });
    const dashboardData = dashboardResponse?.data;

    const { data: farmersResponse } = useQuery({
        queryKey: ['farmers'], queryFn: fetchFarmers,
        enabled: (activeTab === 'portfolio' || activeTab === 'dashboard') && !!user
    });
    const queryFarmers = farmersResponse?.data?.farmers || [];
    const effectiveFarmers = queryFarmers.length > 0 ? queryFarmers : storeFarmers;

    const { data: visitsResponse, refetch: refetchVisits } = useQuery({
        queryKey: ['visits'], queryFn: fetchVisits,
        enabled: activeTab === 'visits' && !!user
    });
    const visits = visitsResponse?.data?.visits || [];

    const { data: reportsResponse, refetch: refetchReports } = useQuery({
        queryKey: ['reports'], queryFn: fetchReports,
        enabled: activeTab === 'reports' && !!user
    });
    const reports = reportsResponse?.data?.reports || [];

    const { data: performanceResponse } = useQuery({
        queryKey: ['performance'], queryFn: fetchPerformanceData,
        enabled: (activeTab === 'analytics' || activeTab === 'dashboard') && !!user
    });
    const performanceData = performanceResponse?.data;

    const { data: transactionsResponse } = useQuery({
        queryKey: ['transactions'], queryFn: getMyTransactions,
        enabled: (activeTab === 'billing' || searchQuery.trim().length > 0) && !!user
    });
    const transactions = transactionsResponse?.data || [];

    // Custom hooks
    const { isOnline, pendingSyncCount, isDragOver, handleDragOver, handleDragLeave, handleDrop } = useAppSync(addNotification);
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

    // Public routes
    if (!user) {
        return (
            <ErrorBoundary componentName="PublicAuth">
                <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>}>
                    <Routes>
                        <Route path="/login" element={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4"><Login /></div>} />
                        <Route path="/register" element={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4"><Register /></div>} />
                        <Route path="/forgot-password" element={<div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4"><ForgotPassword /></div>} />
                        <Route path="/demo" element={<DemoPage />} />
                        <Route path="*" element={<LandingPage />} />
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        );
    }

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

                <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : ''} relative`}>
                    <ErrorBoundary componentName="MainContent">
                        <Suspense fallback={<div className="p-6"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
                            <div className="p-6">
                                {/* Tab Content */}
                                {activeTab === 'dashboard' && (
                                    <DashboardPage
                                        dashboardData={dashboardData} isLoading={isLoading} isOfficer={isOfficer}
                                        performanceData={performanceData} effectiveFarmers={effectiveFarmers}
                                        isMapExpanded={isMapExpanded} setIsMapExpanded={setIsMapExpanded}
                                        handleStartConversation={handleStartConversation} handleOpenFarmerDetail={handleOpenFarmerDetail}
                                        user={user}
                                        addNotification={addNotification}
                                    />
                                )}
                                {activeTab === 'portfolio' && (
                                    <PortfolioPage
                                        effectiveFarmers={effectiveFarmers} selectedFarmers={selectedFarmers}
                                        handleSelectFarmer={handleSelectFarmer} handleOpenFarmerDetail={handleOpenFarmerDetail}
                                        showBulkSmsComposer={showBulkSmsComposer} setShowBulkSmsComposer={setShowBulkSmsComposer}
                                        bulkSmsMessage={bulkSmsMessage} setBulkSmsMessage={setBulkSmsMessage}
                                        handleBulkSMS={handleBulkSMS} handleBulkExport={handleBulkExport}
                                        handleBulkDelete={handleBulkDelete} setSelectedFarmers={setSelectedFarmers}
                                    />
                                )}
                                {activeTab === 'visits' && (
                                    <VisitsPage
                                        visits={visits} setShowVisitModal={setShowVisitModal} refetchVisits={refetchVisits}
                                        handleOpenFarmerDetail={handleOpenFarmerDetail} farmers={effectiveFarmers}
                                        addNotification={addNotification}
                                    />
                                )}
                                {activeTab === 'reports' && (
                                    <ReportsPage
                                        reports={reports} handleGenerateReport={handleGenerateReport}
                                        isGeneratingReport={isGeneratingReport}
                                        viewingReport={viewingReport} setViewingReport={setViewingReport}
                                        reportContent={reportContent} setReportContent={setReportContent}
                                        isLoadingReport={isLoadingReport} setIsLoadingReport={setIsLoadingReport}
                                        addNotification={addNotification} user={user}
                                    />
                                )}
                                {activeTab === 'analytics' && (
                                    <AnalyticsPage
                                        performanceData={performanceData}
                                    />
                                )}
                                {activeTab === 'billing' && <BillingDashboard />}
                                {activeTab === 'knowledge' && <KnowledgeBase />}
                                {activeTab === 'aiassistant' && <AlphaAI />}
                                {activeTab === 'farmerchat' && (
                                    <FarmerChatPage
                                        farmerConversations={farmerConversations} activeFarmerConvId={activeFarmerConvId}
                                        setActiveFarmerConvId={setActiveFarmerConvId} loadFarmerMessages={loadFarmerMessages}
                                        farmerChatMessages={farmerChatMessages} farmerChatInput={farmerChatInput}
                                        setFarmerChatInput={setFarmerChatInput} handleFarmerChatSend={handleFarmerChatSend}
                                        loadFarmers={loadFarmers} setShowFarmerModal={setShowFarmerModal}
                                    />
                                )}
                                {activeTab === 'farmer_dashboard' && <FarmerDashboard />}
                                {activeTab === 'register_farmer' && (
                                    <div className="mt-6"><FarmerRegistrationForm /></div>
                                )}
                                {activeTab === 'visit_synthesis' && (
                                    <div className="mt-6"><VisitSynthesisForm /></div>
                                )}
                                {activeTab === 'sms' && <SMSPage />}
                                {activeTab === 'telemetry' && (
                                    <div><h1 className={`text-3xl font-bold ${headingClass} mb-8`}>{isModern ? 'Neural Telemetry' : 'System Telemetry'}</h1><Telemetry /></div>
                                )}
                                {activeTab === 'agents' && (
                                    <div><h1 className={`text-3xl font-bold ${headingClass} mb-8`}>{isModern ? 'Autonomous Orchestration' : 'Agent Manager'}</h1><Agents /></div>
                                )}
                                {activeTab === 'system_health' && <SystemHealth />}
                                {activeTab === 'disease_diagnosis' && <DiseaseDiagnosisPage />}
                                {activeTab === 'memory' && <Memory />}
                                {activeTab === 'email_workflows' && <EmailWorkflows />}
                                {activeTab === 'mcp_tools' && <MCPTools />}
                                {activeTab === 'user_management' && <UserManagementPage />}
                            </div>
                        </Suspense>
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

export default App;
