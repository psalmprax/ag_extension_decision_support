import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardPage } from '@/pages/DashboardPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { VisitsPage } from '@/pages/VisitsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { FarmerChatPage } from '@/pages/FarmerChatPage';
import { Farmer } from '@/types/dashboard';
import { Report } from '@/api/reportService';

const FarmerDashboard = React.lazy(() => import('@/components/FarmerDashboard').then(m => ({ default: m.FarmerDashboard })));
const BillingDashboard = React.lazy(() => import('@/components/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const VisitSynthesisForm = React.lazy(() => import('@/components/forms/VisitSynthesisForm').then(m => ({ default: m.VisitSynthesisForm })));
const FarmerRegistrationForm = React.lazy(() => import('@/components/forms/FarmerRegistrationForm').then(m => ({ default: m.FarmerRegistrationForm })));
const Telemetry = React.lazy(() => import('@/pages/Telemetry'));
const Agents = React.lazy(() => import('@/pages/Agents'));
const SystemHealth = React.lazy(() => import('@/pages/SystemHealth'));
const DiseaseDiagnosisPage = React.lazy(() => import('@/pages/DiseaseDiagnosis').then(m => ({ default: m.DiseaseDiagnosis })));
const Memory = React.lazy(() => import('@/pages/Memory'));
const EmailWorkflows = React.lazy(() => import('@/pages/EmailWorkflows'));
const MCPTools = React.lazy(() => import('@/pages/MCPTools'));
const SMSPage = React.lazy(() => import('@/pages/SMS').then(m => ({ default: m.SMSPage })));
const AlphaAI = React.lazy(() => import('@/components/Cyber/AlphaAI'));
const KnowledgeBase = React.lazy(() => import('@/components/KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const UserManagementPage = React.lazy(() => import('@/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const CropsFields = React.lazy(() => import('@/pages/CropsFields').then(m => ({ default: m.CropsFields })));

interface TabContentProps {
    activeTab: string;
    headingClass: string;
    isModern: boolean;
    isOfficer: boolean;
    user: any;
    addNotification: (n: any) => void;
    // Dashboard
    dashboardData: any;
    isLoading: boolean;
    performanceData: any;
    effectiveFarmers: Farmer[];
    isMapExpanded: boolean;
    setIsMapExpanded: (v: boolean) => void;
    handleStartConversation: (...args: any[]) => void;
    handleOpenFarmerDetail: (f: Farmer) => void;
    // Portfolio
    selectedFarmers: Set<string>;
    handleSelectFarmer: (id: string, checked: boolean) => void;
    showBulkSmsComposer: boolean;
    setShowBulkSmsComposer: (v: boolean) => void;
    bulkSmsMessage: string;
    setBulkSmsMessage: (v: string) => void;
    handleBulkSMS: (...args: any[]) => void;
    handleBulkExport: (...args: any[]) => void;
    handleBulkDelete: (...args: any[]) => void;
    setSelectedFarmers: (v: Set<string>) => void;
    // Visits
    visits: any[];
    setShowVisitModal: (v: boolean) => void;
    refetchVisits: () => void;
    // Reports
    reports: any[];
    handleGenerateReport: () => void;
    isGeneratingReport: boolean;
    viewingReport: Report | null;
    setViewingReport: (r: Report | null) => void;
    reportContent: string | null;
    setReportContent: (v: string | null) => void;
    isLoadingReport: boolean;
    setIsLoadingReport: (v: boolean) => void;
    // Chat
    farmerConversations: any[];
    activeFarmerConvId: string | null;
    setActiveFarmerConvId: (id: string | null) => void;
    loadFarmerMessages: (id: string) => void;
    farmerChatMessages: any[];
    farmerChatInput: string;
    setFarmerChatInput: (v: string) => void;
    handleFarmerChatSend: (...args: any[]) => void;
    loadFarmers: () => void;
    setShowFarmerModal: (v: boolean) => void;
}

const SimplePageWrapper = ({ title, isModern, headingClass, children }: { title: string; isModern: boolean; headingClass: string; children: React.ReactNode }) => (
    <div>
        <h1 className={`text-3xl font-bold ${headingClass} mb-8`}>{isModern ? title : title}</h1>
        {children}
    </div>
);

export function TabContent(props: TabContentProps) {
    const { activeTab, headingClass, isModern, isOfficer, user, addNotification } = props;

    switch (activeTab) {
        case 'dashboard':
            return (
                <DashboardPage
                    dashboardData={props.dashboardData} isLoading={props.isLoading} isOfficer={isOfficer}
                    performanceData={props.performanceData} effectiveFarmers={props.effectiveFarmers}
                    isMapExpanded={props.isMapExpanded} setIsMapExpanded={props.setIsMapExpanded}
                    handleStartConversation={props.handleStartConversation} handleOpenFarmerDetail={props.handleOpenFarmerDetail}
                    user={user} addNotification={addNotification}
                />
            );
        case 'portfolio':
            return (
                <PortfolioPage
                    effectiveFarmers={props.effectiveFarmers} selectedFarmers={props.selectedFarmers}
                    handleSelectFarmer={props.handleSelectFarmer} handleOpenFarmerDetail={props.handleOpenFarmerDetail}
                    showBulkSmsComposer={props.showBulkSmsComposer} setShowBulkSmsComposer={props.setShowBulkSmsComposer}
                    bulkSmsMessage={props.bulkSmsMessage} setBulkSmsMessage={props.setBulkSmsMessage}
                    handleBulkSMS={props.handleBulkSMS} handleBulkExport={props.handleBulkExport}
                    handleBulkDelete={props.handleBulkDelete} setSelectedFarmers={props.setSelectedFarmers}
                />
            );
        case 'visits':
            return (
                <VisitsPage
                    visits={props.visits} setShowVisitModal={props.setShowVisitModal} refetchVisits={props.refetchVisits}
                    handleOpenFarmerDetail={props.handleOpenFarmerDetail} farmers={props.effectiveFarmers}
                    addNotification={addNotification}
                />
            );
        case 'reports':
            return (
                <ReportsPage
                    reports={props.reports} handleGenerateReport={props.handleGenerateReport}
                    isGeneratingReport={props.isGeneratingReport}
                    viewingReport={props.viewingReport} setViewingReport={props.setViewingReport}
                    reportContent={props.reportContent} setReportContent={props.setReportContent}
                    isLoadingReport={props.isLoadingReport} setIsLoadingReport={props.setIsLoadingReport}
                    addNotification={addNotification} user={user}
                />
            );
        case 'analytics':
            return <AnalyticsPage performanceData={props.performanceData} />;
        case 'billing':
            return <BillingDashboard />;
        case 'knowledge':
            return <KnowledgeBase />;
        case 'aiassistant':
            return <AlphaAI />;
        case 'farmerchat':
            return (
                <FarmerChatPage
                    farmerConversations={props.farmerConversations} activeFarmerConvId={props.activeFarmerConvId}
                    setActiveFarmerConvId={props.setActiveFarmerConvId} loadFarmerMessages={props.loadFarmerMessages}
                    farmerChatMessages={props.farmerChatMessages} farmerChatInput={props.farmerChatInput}
                    setFarmerChatInput={props.setFarmerChatInput} handleFarmerChatSend={props.handleFarmerChatSend}
                    loadFarmers={props.loadFarmers} setShowFarmerModal={props.setShowFarmerModal}
                />
            );
        case 'farmer_dashboard':
            return <FarmerDashboard />;
        case 'register_farmer':
            return <div className="mt-6"><FarmerRegistrationForm /></div>;
        case 'visit_synthesis':
            return <div className="mt-6"><VisitSynthesisForm /></div>;
        case 'sms':
            return <SMSPage />;
        case 'telemetry':
            return <SimplePageWrapper title={isModern ? 'Neural Telemetry' : 'System Telemetry'} isModern={isModern} headingClass={headingClass}><Telemetry /></SimplePageWrapper>;
        case 'agents':
            return <SimplePageWrapper title={isModern ? 'Autonomous Orchestration' : 'Agent Manager'} isModern={isModern} headingClass={headingClass}><Agents /></SimplePageWrapper>;
        case 'system_health':
            return <SystemHealth />;
        case 'disease_diagnosis':
            return <DiseaseDiagnosisPage />;
        case 'fields':
            return <CropsFields />;
        case 'memory':
            return <Memory />;
        case 'email_workflows':
            return <EmailWorkflows />;
        case 'mcp_tools':
            return <MCPTools />;
        case 'user_management':
            return <UserManagementPage />;
        default:
            return null;
    }
}
