import React from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { useState, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { logout as apiLogout } from '@/api/authService';
import { fetchFarmers } from '@/api/farmerService';
import { generateReport, Report } from '@/api/reportService';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '@/store/useAppStore';
import { useLanguage } from '@/lib/LanguageContext';
import ErrorBoundary from '@ag-extension/shared';
import { getNavItems } from './config/navItems';
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppModals } from './components/AppModals';
import { TabContent } from './components/TabContent';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { Farmer } from './types/dashboard';
import { useAppSync } from './hooks/useAppSync';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useBulkActions } from './hooks/useBulkActions';
import { useAppSearch } from './hooks/useAppSearch';
import { useAppChat } from './hooks/useAppChat';
import { useAppTheme } from './hooks/useAppTheme';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppAuth } from './hooks/useAppAuth';
import { useAppModalState } from './hooks/useAppModalState';
import { useAppQueries } from './hooks/useAppQueries';
import { useAppMenuActions } from './hooks/useAppMenuActions';
import { fetchUnreadCount } from '@/api/notificationService';

// Lazy loaded components
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then(m => ({ default: m.LandingPage }))
);
const DemoPage = lazy(() => import('./pages/DemoPage').then(m => ({ default: m.DemoPage })));
const KnowledgeBase = lazy(() =>
  import('./components/KnowledgeBase').then(m => ({ default: m.KnowledgeBase }))
);

const TAB_TO_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  portfolio: '/portfolio',
  visits: '/visits',
  reports: '/reports',
  analytics: '/analytics',
  billing: '/billing',
  knowledge: '/knowledge',
  aiassistant: '/ai-assistant',
  farmerchat: '/farmer-chat',
  sms: '/sms',
  telemetry: '/telemetry',
  agents: '/agents',
  system_health: '/system-health',
  disease_diagnosis: '/disease-diagnosis',
  fields: '/fields',
  memory: '/memory',
  email_workflows: '/email-workflows',
  mcp_tools: '/mcp-tools',
  user_management: '/user-management',
};

const PATH_TO_TAB: Record<string, string> = Object.entries(TAB_TO_PATH).reduce(
  (acc, [tab, path]) => ({ ...acc, [path]: tab }),
  {} as Record<string, string>
);

function App() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    themeName,
    darkMode,
    sidebarOpen,
    setSidebarOpen,
    activeTab,
    setActiveTab,
    user: storeUser,
    setUser,
    addNotification,
    contextMenu,
    hideContextMenu,
    shareModal,
    hideShareModal,
    removeFarmers,
  } = useAppStore();

  // Sync activeTab from URL pathname on mount or route changes
  React.useEffect(() => {
    const tab = PATH_TO_TAB[location.pathname];
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL pathname from activeTab change for authenticated users
  React.useEffect(() => {
    if (storeUser) {
      const targetPath = TAB_TO_PATH[activeTab];
      if (targetPath && location.pathname !== targetPath) {
        navigate(targetPath);
      }
    }
  }, [activeTab, storeUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const { isModern, headingClass } = useThemeClasses();

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

  // Consolidated modal/UI state
  const {
    isNotificationPanelOpen,
    setIsNotificationPanelOpen,
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    showProfileModal,
    setShowProfileModal,
    showSettingsPanel,
    setShowSettingsPanel,
    showHelpCenter,
    setShowHelpCenter,
    isDetailPanelOpen,
    setIsDetailPanelOpen,
    showVisitModal,
    setShowVisitModal,
    showFarmerModal,
    setShowFarmerModal,
    viewingReport,
    setViewingReport,
    showBulkSmsComposer,
    setShowBulkSmsComposer,
    bulkSmsMessage,
    setBulkSmsMessage,
    confirmModal,
    setConfirmModal,
  } = useAppModalState();

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
      try {
        setApiUnreadCount(await fetchUnreadCount());
      } catch {
        /* fallback */
      }
    };
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [storeUser]);

  const handleOpenFarmerDetail = (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    setIsDetailPanelOpen(true);
  };

  const { handleMenuAction } = useAppMenuActions();

  // Data queries
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
  } = useAppQueries(activeTab, searchQuery);

  // Custom hooks
  const { isDragOver, handleDragOver, handleDragLeave, handleDrop } = useAppSync(addNotification);
  const {
    showGlobalSearch,
    setShowGlobalSearch,
    isGlobalSearching,
    globalSearchResults,
    handleGlobalSearch,
  } = useAppSearch(effectiveFarmers, visits, reports, transactions);
  const {
    activeConvId,
    loadConversations,
    loadMessages,
    loadFarmerConversations,
    loadFarmerMessages,
    farmerConversations,
    activeFarmerConvId,
    setActiveFarmerConvId,
    farmerChatMessages,
    farmerChatInput,
    setFarmerChatInput,
    handleFarmerChatSend,
    handleStartConversation,
  } = useAppChat(language);
  const {
    isSendingBulkSms,
    handleSelectFarmer,
    handleBulkSMS,
    onBulkSmsSend,
    handleBulkDelete,
    onBulkUpdateFarmers,
    handleBulkExport,
  } = useBulkActions({
    effectiveFarmers,
    selectedFarmers,
    setSelectedFarmers,
    addNotification,
    setActiveTab,
    setShowBulkSmsComposer,
    setConfirmModal,
    setIsUpdatingBulk,
    setIsBulkUpdateModalOpen,
    removeFarmers,
    setFarmerList,
  });
  useAppShortcuts({
    sidebarOpen,
    setSidebarOpen,
    isNotificationPanelOpen,
    setIsNotificationPanelOpen,
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    showProfileModal,
    setShowProfileModal,
    showSettingsPanel,
    setShowSettingsPanel,
    showHelpCenter,
    setShowHelpCenter,
    isDetailPanelOpen,
    setIsDetailPanelOpen,
    showVisitModal,
    setShowVisitModal,
    showFarmerModal,
    setShowFarmerModal,
    showGlobalSearch,
    setShowGlobalSearch,
    viewingReport,
    setViewingReport,
    showBulkSmsComposer,
    setShowBulkSmsComposer,
    confirmModal,
    setConfirmModal,
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

  const [localGeneratedReports, setLocalGeneratedReports] = useState<Report[]>([]);

  // Report generation handler
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const res = await generateReport('synthesis', 'AI Synthesis Report');
      if (!res?.data) {
        throw new Error('Report service returned no report data');
      }
      const newReport: Report = res.data;
      setLocalGeneratedReports(prev => [newReport, ...prev]);
      addNotification({
        type: 'success',
        message: t('reports_generated_success') || 'Report generated!',
      });
      refetchReports();
    } catch {
      addNotification({
        type: 'error',
        message: t('reports_generation_failed') || 'Report generation failed. No report was created.',
      });
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

  if (user && isError)
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500 bg-gray-50 dark:bg-gray-900">
        {t('error_loading')}
      </div>
    );

  const navItems = getNavItems(isModern).filter(item => {
    if (!user || !item.roles.includes(user.role)) return false;
    if (useAppStore.getState().isDemo && item.hiddenInDemo) return false;
    return true;
  });

  // Public routes
  if (!user) {
    return (
      <ErrorBoundary componentName="PublicAuth">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          }
        >
          <Routes>
            <Route
              path="/login"
              element={
                <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                  <Login />
                </div>
              }
            />
            <Route
              path="/register"
              element={
                <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                  <Register />
                </div>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                  <ForgotPassword />
                </div>
              }
            />
            <Route path="/demo" element={<DemoPage />} />
            <Route path="/demo/rag" element={<DemoPage initialTab="rag" />} />
            <Route path="/demo/synthesis" element={<DemoPage initialTab="synthesis" />} />
            <Route path="/demo/telemetry" element={<DemoPage initialTab="telemetry" />} />
            <Route
              path="/knowledge"
              element={
                <div className="min-h-screen bg-theme-bg-primary">
                  <KnowledgeBase />
                </div>
              }
            />
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <>
      <div
        className={`h-screen flex flex-col ${darkMode ? 'dark' : ''} bg-theme-bg-primary transition-colors duration-300 overflow-hidden relative z-0`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Ambient Aurora Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 hidden dark:block">
          <motion.div
            animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-[10%] -left-[10%] w-[800px] h-[800px] bg-blue-600/30 mix-blend-screen rounded-full blur-[150px]"
          />
          <motion.div
            animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-purple-600/30 mix-blend-screen rounded-full blur-[180px]"
          />
        </div>

        {/* Drag overlay */}
        {isDragOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl text-center">
              <Loader2 className="w-16 h-16 text-primary-500 mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t('upload_processing')}
              </h3>
            </div>
          </div>
        )}

        <AppHeader
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showGlobalSearch={showGlobalSearch}
          setShowGlobalSearch={setShowGlobalSearch}
          isGlobalSearching={isGlobalSearching}
          globalSearchResults={globalSearchResults}
          handleGlobalSearch={handleGlobalSearch}
          weatherLocation={weatherLocation}
          setWeatherLocation={() => {}}
          apiUnreadCount={apiUnreadCount}
          storeUser={storeUser}
          handleLogout={handleLogout}
          handleOpenFarmerDetail={handleOpenFarmerDetail}
          farmers={effectiveFarmers}
          addNotification={addNotification}
          setIsNotificationPanelOpen={setIsNotificationPanelOpen}
          isProfileMenuOpen={isProfileMenuOpen}
          setIsProfileMenuOpen={setIsProfileMenuOpen}
          setShowProfileModal={setShowProfileModal}
          setShowSettingsPanel={setShowSettingsPanel}
        />

        <div className="flex flex-1 overflow-hidden pt-16">
          <AppSidebar
            sidebarOpen={sidebarOpen}
            navItems={navItems}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setShowHelpCenter={setShowHelpCenter}
            onGenerateReport={handleGenerateReport}
          />

          <main
            className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'ml-72' : ''} relative pb-24 md:pb-6`}
          >
            <ErrorBoundary componentName="MainContent">
              <Suspense
                fallback={
                  <div className="p-6">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  </div>
                }
              >
                <div className="p-6">
                  <TabContent
                    activeTab={activeTab}
                    headingClass={headingClass}
                    isModern={isModern}
                    isOfficer={isOfficer}
                    user={user}
                    addNotification={addNotification as (n: unknown) => void}
                    dashboardData={dashboardData}
                    isLoading={isLoading}
                    performanceData={performanceData}
                    effectiveFarmers={effectiveFarmers}
                    isMapExpanded={isMapExpanded}
                    setIsMapExpanded={setIsMapExpanded}
                    handleStartConversation={
                      handleStartConversation as (...args: unknown[]) => void
                    }
                    handleOpenFarmerDetail={handleOpenFarmerDetail}
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
                    visits={visits}
                    setShowVisitModal={setShowVisitModal}
                    refetchVisits={refetchVisits}
                    reports={[...localGeneratedReports, ...(reports || [])]}
                    handleGenerateReport={handleGenerateReport}
                    isGeneratingReport={isGeneratingReport}
                    viewingReport={viewingReport}
                    setViewingReport={setViewingReport}
                    reportContent={reportContent}
                    setReportContent={setReportContent}
                    isLoadingReport={isLoadingReport}
                    setIsLoadingReport={setIsLoadingReport}
                    farmerConversations={farmerConversations}
                    activeFarmerConvId={activeFarmerConvId}
                    setActiveFarmerConvId={setActiveFarmerConvId}
                    loadFarmerMessages={loadFarmerMessages}
                    farmerChatMessages={farmerChatMessages}
                    farmerChatInput={farmerChatInput}
                    setFarmerChatInput={setFarmerChatInput}
                    handleFarmerChatSend={handleFarmerChatSend as (...args: unknown[]) => void}
                    loadFarmers={loadFarmers}
                    setShowFarmerModal={setShowFarmerModal}
                  />
                </div>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>

        <AppModals
          showVisitModal={showVisitModal}
          setShowVisitModal={setShowVisitModal}
          refetchVisits={refetchVisits}
          isDetailPanelOpen={isDetailPanelOpen}
          setIsDetailPanelOpen={setIsDetailPanelOpen}
          selectedFarmer={selectedFarmer}
          visits={visits}
          isNotificationPanelOpen={isNotificationPanelOpen}
          setIsNotificationPanelOpen={setIsNotificationPanelOpen}
          contextMenu={contextMenu}
          hideContextMenu={hideContextMenu}
          handleMenuAction={handleMenuAction}
          shareModal={shareModal}
          hideShareModal={hideShareModal}
          showProfileModal={showProfileModal}
          setShowProfileModal={setShowProfileModal}
          showSettingsPanel={showSettingsPanel}
          setShowSettingsPanel={setShowSettingsPanel}
          showHelpCenter={showHelpCenter}
          setShowHelpCenter={setShowHelpCenter}
          showBulkSmsComposer={showBulkSmsComposer}
          setShowBulkSmsComposer={setShowBulkSmsComposer}
          onBulkSmsSend={onBulkSmsSend}
          selectedFarmersCount={selectedFarmers.size}
          isSendingBulkSms={isSendingBulkSms}
          isBulkUpdateModalOpen={isBulkUpdateModalOpen}
          setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
          onBulkUpdateFarmers={onBulkUpdateFarmers}
          isUpdatingBulk={isUpdatingBulk}
          confirmModal={confirmModal}
          setConfirmModal={setConfirmModal}
          isGeneratingReport={isGeneratingReport}
          viewingReport={viewingReport}
          setViewingReport={setViewingReport}
          reportContent={reportContent}
          setReportContent={setReportContent}
          isLoadingReport={isLoadingReport}
          showFarmerModal={showFarmerModal}
          setShowFarmerModal={setShowFarmerModal}
          farmerList={farmerList}
          isLoadingFarmers={isLoadingFarmers}
          farmerSearchQuery={farmerSearchQuery}
          setFarmerSearchQuery={setFarmerSearchQuery}
          handleStartConversation={handleStartConversation}
          activeTab={activeTab}
          addNotification={addNotification}
        />
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <PwaInstallPrompt />
      </div>
    </>
  );
}

export default App;
