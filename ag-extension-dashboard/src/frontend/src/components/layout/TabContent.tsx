import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DashboardPage } from '@/pages/DashboardPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { VisitsPage } from '@/pages/VisitsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { FarmerChatPage } from '@/pages/FarmerChatPage';
import type { Farmer, Visit, Conversation, ChatMessage, DashboardData } from '@/types/dashboard';
import type { Report } from '@/api/reportService';

// Lazy loaded components
const FarmerDashboard = lazy(() => import('@/components/FarmerDashboard').then(m => ({ default: m.FarmerDashboard })));
const BillingDashboard = lazy(() => import('@/components/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const VisitSynthesisForm = lazy(() => import('@/components/forms/VisitSynthesisForm').then(m => ({ default: m.VisitSynthesisForm })));
const FarmerRegistrationForm = lazy(() => import('@/components/forms/FarmerRegistrationForm').then(m => ({ default: m.FarmerRegistrationForm })));
const Telemetry = lazy(() => import('@/pages/Telemetry'));
const Agents = lazy(() => import('@/pages/Agents'));
const SystemHealth = lazy(() => import('@/pages/SystemHealth'));
const DiseaseDiagnosisPage = lazy(() => import('@/pages/DiseaseDiagnosis').then(m => ({ default: m.DiseaseDiagnosis })));
const Memory = lazy(() => import('@/pages/Memory'));
const EmailWorkflows = lazy(() => import('@/pages/EmailWorkflows'));
const MCPTools = lazy(() => import('@/pages/MCPTools'));
const SMSPage = lazy(() => import('@/pages/SMS').then(m => ({ default: m.SMSPage })));
const AlphaAI = lazy(() => import('@/components/Cyber/AlphaAI'));
const KnowledgeBase = lazy(() => import('@/components/KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const UserManagementPage = lazy(() => import('@/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));

interface PerformanceData {
    metrics?: {
        resolutionRate?: number;
        avgResponseTime?: string | number;
        satisfactionScore?: number;
        followUpRate?: number;
        firstContactResolution?: number;
    };
    timeline?: Array<Record<string, string | number>>;
}

export interface TabContentProps {
    activeTab: string;
    isModern: boolean;
    headingClass: string;
    // Dashboard
    dashboardData: DashboardData | undefined;
    isLoading: boolean;
    isOfficer: boolean;
    performanceData: PerformanceData | undefined;
    effectiveFarmers: Farmer[];
    isMapExpanded: boolean;
    setIsMapExpanded: (v: boolean) => void;
    handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => void;
    handleOpenFarmerDetail: (farmer: Farmer) => void;
    user: { role?: string; firstName?: string; lastName?: string } | undefined;
    addNotification: (n: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
    // Portfolio
    selectedFarmers: Set<string>;
    handleSelectFarmer: (id: string, checked: boolean) => void;
    showBulkSmsComposer: boolean;
    setShowBulkSmsComposer: (v: boolean) => void;
    bulkSmsMessage: string;
    setBulkSmsMessage: (v: string) => void;
    handleBulkSMS: () => void;
    handleBulkExport: () => void;
    handleBulkDelete: () => void;
    setSelectedFarmers: (s: Set<string>) => void;
    // Visits
    visits: Visit[];
    setShowVisitModal: (v: boolean) => void;
    refetchVisits: () => void;
    // Reports
    reports: Report[];
    handleGenerateReport: () => void;
    isGeneratingReport: boolean;
    viewingReport: Report | null;
    setViewingReport: (r: Report | null) => void;
    reportContent: string | null;
    setReportContent: (v: string | null) => void;
    isLoadingReport: boolean;
    setIsLoadingReport: (v: boolean) => void;
    // Farmer Chat
    farmerConversations: Conversation[];
    activeFarmerConvId: string | null;
    setActiveFarmerConvId: (v: string | null) => void;
    loadFarmerMessages: (id: string) => void;
    farmerChatMessages: ChatMessage[];
    farmerChatInput: string;
    setFarmerChatInput: (v: string) => void;
    handleFarmerChatSend: (e?: React.FormEvent) => void;
    loadFarmers: () => void;
    setShowFarmerModal: (v: boolean) => void;
}

export function TabContent(props: TabContentProps) {
    const {
        activeTab,
        isModern,
        headingClass,
        dashboardData,
        isLoading,
        isOfficer,
        performanceData,
        effectiveFarmers,
        isMapExpanded,
        setIsMapExpanded,
        handleStartConversation,
        handleOpenFarmerDetail,
        user,
        addNotification,
        selectedFarmers,
        handleSelectFarmer,
        showBulkSmsComposer,
        setShowBulkSmsComposer,
        bulkSmsMessage,
        setBulkSmsMessage,
        handleBulkSMS,
        handleBulkExport,
        handleBulkDelete,
        setSelectedFarmers,
        visits,
        setShowVisitModal,
        refetchVisits,
        reports,
        handleGenerateReport,
        isGeneratingReport,
        viewingReport,
        setViewingReport,
        reportContent,
        setReportContent,
        isLoadingReport,
        setIsLoadingReport,
        farmerConversations,
        activeFarmerConvId,
        setActiveFarmerConvId,
        loadFarmerMessages,
        farmerChatMessages,
        farmerChatInput,
        setFarmerChatInput,
        handleFarmerChatSend,
        loadFarmers,
        setShowFarmerModal,
    } = props;

    return (
        <Suspense fallback={<div className="p-6"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
            <div className="p-6">
                {activeTab === 'dashboard' && (
                    <ErrorBoundary componentName="DashboardPage">
                        <DashboardPage
                            dashboardData={dashboardData} isLoading={isLoading} isOfficer={isOfficer}
                            performanceData={performanceData} effectiveFarmers={effectiveFarmers}
                            isMapExpanded={isMapExpanded} setIsMapExpanded={setIsMapExpanded}
                            handleStartConversation={handleStartConversation} handleOpenFarmerDetail={handleOpenFarmerDetail}
                            user={user}
                            addNotification={addNotification}
                        />
                    </ErrorBoundary>
                )}
                {activeTab === 'portfolio' && (
                    <ErrorBoundary componentName="PortfolioPage">
                        <PortfolioPage
                            effectiveFarmers={effectiveFarmers} selectedFarmers={selectedFarmers}
                            handleSelectFarmer={handleSelectFarmer} handleOpenFarmerDetail={handleOpenFarmerDetail}
                            showBulkSmsComposer={showBulkSmsComposer} setShowBulkSmsComposer={setShowBulkSmsComposer}
                            bulkSmsMessage={bulkSmsMessage} setBulkSmsMessage={setBulkSmsMessage}
                            handleBulkSMS={handleBulkSMS} handleBulkExport={handleBulkExport}
                            handleBulkDelete={handleBulkDelete} setSelectedFarmers={setSelectedFarmers}
                        />
                    </ErrorBoundary>
                )}
                {activeTab === 'visits' && (
                    <ErrorBoundary componentName="VisitsPage">
                        <VisitsPage
                            visits={visits} setShowVisitModal={setShowVisitModal} refetchVisits={refetchVisits}
                            handleOpenFarmerDetail={handleOpenFarmerDetail} farmers={effectiveFarmers}
                            addNotification={addNotification}
                        />
                    </ErrorBoundary>
                )}
                {activeTab === 'reports' && (
                    <ErrorBoundary componentName="ReportsPage">
                        <ReportsPage
                            reports={reports} handleGenerateReport={handleGenerateReport}
                            isGeneratingReport={isGeneratingReport}
                            viewingReport={viewingReport} setViewingReport={setViewingReport}
                            reportContent={reportContent} setReportContent={setReportContent}
                            isLoadingReport={isLoadingReport} setIsLoadingReport={setIsLoadingReport}
                            addNotification={addNotification} user={user}
                        />
                    </ErrorBoundary>
                )}
                {activeTab === 'analytics' && (
                    <ErrorBoundary componentName="AnalyticsPage">
                        <AnalyticsPage performanceData={performanceData} />
                    </ErrorBoundary>
                )}
                {activeTab === 'billing' && (
                    <ErrorBoundary componentName="BillingDashboard">
                        <BillingDashboard />
                    </ErrorBoundary>
                )}
                {activeTab === 'knowledge' && (
                    <ErrorBoundary componentName="KnowledgeBase">
                        <KnowledgeBase />
                    </ErrorBoundary>
                )}
                {activeTab === 'aiassistant' && (
                    <ErrorBoundary componentName="AlphaAI">
                        <AlphaAI />
                    </ErrorBoundary>
                )}
                {activeTab === 'farmerchat' && (
                    <ErrorBoundary componentName="FarmerChatPage">
                        <FarmerChatPage
                            farmerConversations={farmerConversations} activeFarmerConvId={activeFarmerConvId}
                            setActiveFarmerConvId={setActiveFarmerConvId} loadFarmerMessages={loadFarmerMessages}
                            farmerChatMessages={farmerChatMessages} farmerChatInput={farmerChatInput}
                            setFarmerChatInput={setFarmerChatInput} handleFarmerChatSend={handleFarmerChatSend}
                            loadFarmers={loadFarmers} setShowFarmerModal={setShowFarmerModal}
                        />
                    </ErrorBoundary>
                )}
                {activeTab === 'farmer_dashboard' && (
                    <ErrorBoundary componentName="FarmerDashboard">
                        <FarmerDashboard />
                    </ErrorBoundary>
                )}
                {activeTab === 'register_farmer' && (
                    <ErrorBoundary componentName="FarmerRegistrationForm">
                        <div className="mt-6"><FarmerRegistrationForm /></div>
                    </ErrorBoundary>
                )}
                {activeTab === 'visit_synthesis' && (
                    <ErrorBoundary componentName="VisitSynthesisForm">
                        <div className="mt-6"><VisitSynthesisForm /></div>
                    </ErrorBoundary>
                )}
                {activeTab === 'sms' && (
                    <ErrorBoundary componentName="SMSPage">
                        <SMSPage />
                    </ErrorBoundary>
                )}
                {activeTab === 'telemetry' && (
                    <ErrorBoundary componentName="Telemetry">
                        <div><h1 className={`text-3xl font-bold ${headingClass} mb-8`}>{isModern ? 'Neural Telemetry' : 'System Telemetry'}</h1><Telemetry /></div>
                    </ErrorBoundary>
                )}
                {activeTab === 'agents' && (
                    <ErrorBoundary componentName="Agents">
                        <div><h1 className={`text-3xl font-bold ${headingClass} mb-8`}>{isModern ? 'Autonomous Orchestration' : 'Agent Manager'}</h1><Agents /></div>
                    </ErrorBoundary>
                )}
                {activeTab === 'system_health' && (
                    <ErrorBoundary componentName="SystemHealth">
                        <SystemHealth />
                    </ErrorBoundary>
                )}
                {activeTab === 'disease_diagnosis' && (
                    <ErrorBoundary componentName="DiseaseDiagnosisPage">
                        <DiseaseDiagnosisPage />
                    </ErrorBoundary>
                )}
                {activeTab === 'memory' && (
                    <ErrorBoundary componentName="Memory">
                        <Memory />
                    </ErrorBoundary>
                )}
                {activeTab === 'email_workflows' && (
                    <ErrorBoundary componentName="EmailWorkflows">
                        <EmailWorkflows />
                    </ErrorBoundary>
                )}
                {activeTab === 'mcp_tools' && (
                    <ErrorBoundary componentName="MCPTools">
                        <MCPTools />
                    </ErrorBoundary>
                )}
                {activeTab === 'user_management' && (
                    <ErrorBoundary componentName="UserManagementPage">
                        <UserManagementPage />
                    </ErrorBoundary>
                )}
            </div>
        </Suspense>
    );
}
