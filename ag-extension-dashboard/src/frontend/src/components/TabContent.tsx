import React from 'react';
import { Farmer, Visit, Conversation, ChatMessage, DashboardData } from '@/types/dashboard';
import { Report } from '@/api/reportService';
import { PlanUpgradeGuard } from '@/components/PlanUpgradeGuard';
interface AnalyticsDataShape {
  metrics?: {
    resolutionRate?: number;
    avgResponseTime?: string | number;
    satisfactionScore?: number;
    followUpRate?: number;
    firstContactResolution?: number;
  };
  timeline?: Record<string, string | number>[];
}

const DashboardPage = React.lazy(() =>
  import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage }))
);
const PortfolioPage = React.lazy(() =>
  import('@/pages/PortfolioPage').then(m => ({ default: m.PortfolioPage }))
);
const VisitsPage = React.lazy(() =>
  import('@/pages/VisitsPage').then(m => ({ default: m.VisitsPage }))
);
const ReportsPage = React.lazy(() =>
  import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage }))
);
const AnalyticsPage = React.lazy(() =>
  import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage }))
);
const FarmerChatPage = React.lazy(() =>
  import('@/pages/FarmerChatPage').then(m => ({ default: m.FarmerChatPage }))
);

const FarmerDashboard = React.lazy(() =>
  import('@/components/FarmerDashboard').then(m => ({ default: m.FarmerDashboard }))
);
const BillingDashboard = React.lazy(() =>
  import('@/components/BillingDashboard').then(m => ({ default: m.BillingDashboard }))
);
const VisitSynthesisForm = React.lazy(() =>
  import('@/components/forms/VisitSynthesisForm').then(m => ({ default: m.VisitSynthesisForm }))
);
const FarmerRegistrationForm = React.lazy(() =>
  import('@/components/forms/FarmerRegistrationForm').then(m => ({
    default: m.FarmerRegistrationForm,
  }))
);
const Telemetry = React.lazy(() => import('@/pages/Telemetry'));
const Agents = React.lazy(() => import('@/pages/Agents'));
const SystemHealth = React.lazy(() => import('@/pages/SystemHealth'));
const DiseaseDiagnosisPage = React.lazy(() =>
  import('@/pages/DiseaseDiagnosis').then(m => ({ default: m.DiseaseDiagnosis }))
);
const Memory = React.lazy(() => import('@/pages/Memory'));
const EmailWorkflows = React.lazy(() => import('@/pages/EmailWorkflows'));
const MCPTools = React.lazy(() => import('@/pages/MCPTools'));
const SMSPage = React.lazy(() => import('@/pages/SMS').then(m => ({ default: m.SMSPage })));
const AlphaAI = React.lazy(() => import('@/components/Cyber/AlphaAI'));
const KnowledgeBase = React.lazy(() =>
  import('@/components/KnowledgeBase').then(m => ({ default: m.KnowledgeBase }))
);
const UserManagementPage = React.lazy(() =>
  import('@/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage }))
);
const CropsFields = React.lazy(() =>
  import('@/pages/CropsFields').then(m => ({ default: m.CropsFields }))
);

interface TabContentProps {
  activeTab: string;
  headingClass: string;
  isModern: boolean;
  isOfficer: boolean;
  user: unknown;
  addNotification: (n: unknown) => void;
  // Dashboard
  dashboardData: unknown;
  isLoading: boolean;
  performanceData: unknown;
  effectiveFarmers: Farmer[];
  isMapExpanded: boolean;
  setIsMapExpanded: (v: boolean) => void;
  handleStartConversation: (...args: unknown[]) => void;
  handleOpenFarmerDetail: (f: Farmer) => void;
  // Portfolio
  selectedFarmers: Set<string>;
  handleSelectFarmer: (id: string, checked: boolean) => void;
  showBulkSmsComposer: boolean;
  setShowBulkSmsComposer: (v: boolean) => void;
  bulkSmsMessage: string;
  setBulkSmsMessage: (v: string) => void;
  handleBulkSMS: (...args: unknown[]) => void;
  handleBulkExport: (...args: unknown[]) => void;
  handleBulkDelete: (...args: unknown[]) => void;
  setSelectedFarmers: (v: Set<string>) => void;
  // Visits
  visits: unknown[];
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
  // Chat
  farmerConversations: unknown[];
  activeFarmerConvId: string | null;
  setActiveFarmerConvId: (id: string | null) => void;
  loadFarmerMessages: (id: string) => void;
  farmerChatMessages: unknown[];
  farmerChatInput: string;
  setFarmerChatInput: (v: string) => void;
  handleFarmerChatSend: (...args: unknown[]) => void;
  loadFarmers: () => void;
  setShowFarmerModal: (v: boolean) => void;
}

const SimplePageWrapper = ({
  title,
  isModern,
  headingClass,
  children,
}: {
  title: string;
  isModern: boolean;
  headingClass: string;
  children: React.ReactNode;
}) => (
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
          dashboardData={props.dashboardData as unknown as DashboardData | undefined}
          isLoading={props.isLoading}
          isOfficer={isOfficer}
          performanceData={props.performanceData as unknown as AnalyticsDataShape | undefined}
          effectiveFarmers={props.effectiveFarmers}
          isMapExpanded={props.isMapExpanded}
          setIsMapExpanded={props.setIsMapExpanded}
          handleStartConversation={props.handleStartConversation}
          handleOpenFarmerDetail={props.handleOpenFarmerDetail}
          user={
            user as
              | { role?: string; firstName?: string; lastName?: string; avatarUrl?: string }
              | undefined
          }
          addNotification={addNotification}
        />
      );
    case 'portfolio':
      return (
        <PortfolioPage
          effectiveFarmers={props.effectiveFarmers}
          selectedFarmers={props.selectedFarmers}
          handleSelectFarmer={props.handleSelectFarmer}
          handleOpenFarmerDetail={props.handleOpenFarmerDetail}
          showBulkSmsComposer={props.showBulkSmsComposer}
          setShowBulkSmsComposer={props.setShowBulkSmsComposer}
          bulkSmsMessage={props.bulkSmsMessage}
          setBulkSmsMessage={props.setBulkSmsMessage}
          handleBulkSMS={props.handleBulkSMS}
          handleBulkExport={props.handleBulkExport}
          handleBulkDelete={props.handleBulkDelete}
          setSelectedFarmers={props.setSelectedFarmers}
        />
      );
    case 'visits':
      return (
        <VisitsPage
          visits={props.visits as Visit[]}
          setShowVisitModal={props.setShowVisitModal}
          refetchVisits={props.refetchVisits}
          handleOpenFarmerDetail={props.handleOpenFarmerDetail}
          farmers={props.effectiveFarmers}
          addNotification={addNotification}
        />
      );
    case 'reports':
      return (
        <ReportsPage
          reports={props.reports as unknown as Report[]}
          handleGenerateReport={props.handleGenerateReport}
          isGeneratingReport={props.isGeneratingReport}
          viewingReport={props.viewingReport}
          setViewingReport={props.setViewingReport}
          reportContent={props.reportContent}
          setReportContent={props.setReportContent}
          isLoadingReport={props.isLoadingReport}
          setIsLoadingReport={props.setIsLoadingReport}
          addNotification={addNotification}
          user={user as { firstName?: string; lastName?: string; avatarUrl?: string } | undefined}
        />
      );
    case 'analytics':
      return (
        <AnalyticsPage
          performanceData={props.performanceData as unknown as AnalyticsDataShape | undefined}
        />
      );
    case 'billing':
      return <BillingDashboard />;
    case 'knowledge':
      return <KnowledgeBase />;
    case 'aiassistant':
      return (
        <PlanUpgradeGuard category="chat" featureName="AI Agronomic Assistant">
          <AlphaAI />
        </PlanUpgradeGuard>
      );
    case 'farmerchat':
      return (
        <PlanUpgradeGuard category="chat" featureName="Farmer Chat & Direct Communication">
          <FarmerChatPage
            farmerConversations={props.farmerConversations as Conversation[]}
            activeFarmerConvId={props.activeFarmerConvId}
            setActiveFarmerConvId={props.setActiveFarmerConvId}
            loadFarmerMessages={props.loadFarmerMessages}
            farmerChatMessages={props.farmerChatMessages as ChatMessage[]}
            farmerChatInput={props.farmerChatInput}
            setFarmerChatInput={props.setFarmerChatInput}
            handleFarmerChatSend={props.handleFarmerChatSend}
            loadFarmers={props.loadFarmers}
            setShowFarmerModal={props.setShowFarmerModal}
          />
        </PlanUpgradeGuard>
      );
    case 'farmer_dashboard':
      return <FarmerDashboard />;
    case 'register_farmer':
      return (
        <div className="mt-6">
          <FarmerRegistrationForm />
        </div>
      );
    case 'visit_synthesis':
      return (
        <div className="mt-6">
          <VisitSynthesisForm />
        </div>
      );
    case 'sms':
      return (
        <PlanUpgradeGuard category="sms" featureName="SMS Campaigns & Omnichannel Broadcasting">
          <SMSPage />
        </PlanUpgradeGuard>
      );
    case 'telemetry':
      return (
        <SimplePageWrapper
          title={isModern ? 'Neural Telemetry' : 'System Telemetry'}
          isModern={isModern}
          headingClass={headingClass}
        >
          <Telemetry />
        </SimplePageWrapper>
      );
    case 'agents':
      return (
        <SimplePageWrapper
          title={isModern ? 'Autonomous Orchestration' : 'Agent Manager'}
          isModern={isModern}
          headingClass={headingClass}
        >
          <Agents />
        </SimplePageWrapper>
      );
    case 'system_health':
      return <SystemHealth />;
    case 'disease_diagnosis':
      return (
        <PlanUpgradeGuard category="vision" featureName="Plant & Soil Disease Photo Diagnosis">
          <DiseaseDiagnosisPage />
        </PlanUpgradeGuard>
      );
    case 'fields':
      return <CropsFields />;
    case 'memory':
      return <Memory />;
    case 'email_workflows':
      return (
        <PlanUpgradeGuard category="workflows" featureName="Automated Email Workflows">
          <EmailWorkflows />
        </PlanUpgradeGuard>
      );
    case 'mcp_tools':
      return <MCPTools />;
    case 'user_management':
      return <UserManagementPage />;
    default:
      return null;
  }
}
