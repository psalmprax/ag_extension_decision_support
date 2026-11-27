import React from 'react';
import { Farmer, Visit, DashboardData } from '@/types/dashboard';
import { Report } from '@/api/reportService';
import { PlanUpgradeGuard } from '@/components/PlanUpgradeGuard';
import type { PerformanceData } from '@/api/analyticsService';
import { DashboardLoadError } from '@/components/DashboardLoadError';
import { threadProps, type ThreadHistory } from './chat/threadProps';
import { useLanguage } from '@/lib/LanguageContext';
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
const FarmerOfficerChatPage = React.lazy(() => import('@/pages/FarmerOfficerChatPage'));

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
  // webpackChunkName guides Rollup's async-chunk naming (was generic "index")
  import(/* webpackChunkName: "knowledge-base" */ '@/components/KnowledgeBase').then(m => ({
    default: m.KnowledgeBase,
  }))
);
const UserManagementPage = React.lazy(() =>
  import('@/pages/UserManagementPage').then(m => ({ default: m.UserManagementPage }))
);
const CropsFields = React.lazy(() =>
  import('@/pages/CropsFields').then(m => ({ default: m.CropsFields }))
);
const WorldMonitor = React.lazy(() => import('@/pages/WorldMonitor'));
const AdvisoryStudioPage = React.lazy(() =>
  import('@/pages/AdvisoryStudioPage').then(m => ({ default: m.AdvisoryStudioPage }))
);

interface TabContentProps {
  activeTab: string;
  headingClass: string;
  isOfficer: boolean;
  user: unknown;
  addNotification: (n: unknown) => void;
  // Dashboard
  dashboardData: unknown;
  isLoading: boolean;
  dashboardError: boolean;
  onRetryDashboard: () => void;
  performanceData: PerformanceData | undefined;
  effectiveFarmers: Farmer[];
  isMapExpanded: boolean;
  setIsMapExpanded: (v: boolean) => void;
  handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => Promise<boolean>;
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
  farmerChatMessages: unknown[]; farmerHistory: ThreadHistory;
  farmerChatInput: string;
  setFarmerChatInput: (v: string) => void;
  handleFarmerChatSend: (...args: unknown[]) => void;
  loadFarmers: () => void;
  setShowFarmerModal: (v: boolean) => void;
  handleDeleteConversation?: (id: string) => void;
  onOpenUSSDSimulator?: () => void;
}

export function TabContent(props: TabContentProps) {
  const { activeTab, isOfficer, user, addNotification } = props;
  const { t } = useLanguage();

  switch (activeTab) {
    case 'dashboard':
      return (
        <>
          {props.dashboardError && <DashboardLoadError onRetry={props.onRetryDashboard} />}
          <DashboardPage
            dashboardData={props.dashboardData as unknown as DashboardData | undefined}
            isLoading={props.isLoading}
            isOfficer={isOfficer}
            performanceData={props.performanceData}
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
            onOpenUSSDSimulator={props.onOpenUSSDSimulator}
          />
        </>
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
        <PlanUpgradeGuard category="visits" featureName={t('plan_gate_name_visits', { defaultValue: 'Field visits' })}>
          <VisitsPage
            visits={props.visits as Visit[]}
            setShowVisitModal={props.setShowVisitModal}
            refetchVisits={props.refetchVisits}
            handleOpenFarmerDetail={props.handleOpenFarmerDetail}
            farmers={props.effectiveFarmers}
            addNotification={addNotification}
          />
        </PlanUpgradeGuard>
      );
    case 'reports':
      return (
        <PlanUpgradeGuard category="reports" featureName={t('plan_gate_name_reports', { defaultValue: 'Reports' })}>
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
        </PlanUpgradeGuard>
      );
    case 'analytics':
      return (
        <PlanUpgradeGuard category="analytics" featureName={t('plan_gate_name_analytics', { defaultValue: 'Analytics' })}>
          <AnalyticsPage performanceData={props.performanceData} />
        </PlanUpgradeGuard>
      );
    case 'billing': // while billing is off only admins have it in their menu (plan grants, payment keys)
      return <BillingDashboard />;
    case 'knowledge':
      return <KnowledgeBase />;
    case 'aiassistant':
      return (
        <PlanUpgradeGuard category="chat" featureName={t('plan_gate_name_ai', { defaultValue: 'AI agronomist' })}>
          <AlphaAI />
        </PlanUpgradeGuard>
      );
    case 'farmerchat':
      return (
        <PlanUpgradeGuard category="chat" featureName={t('plan_gate_name_farmer_chat', { defaultValue: 'Farmer chat' })}>
          <FarmerChatPage
            {...threadProps(props)}
            loadFarmers={props.loadFarmers}
            setShowFarmerModal={props.setShowFarmerModal}
            onDeleteConversation={props.handleDeleteConversation}
          />
        </PlanUpgradeGuard>
      );
    case 'officerchat':
      return (
        <PlanUpgradeGuard category="chat" featureName={t('plan_gate_name_my_officer', { defaultValue: 'Chat with your extension officer' })}>
          <FarmerOfficerChatPage {...threadProps(props)} />
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
        <PlanUpgradeGuard category="visits" featureName={t('plan_gate_name_visit_summaries', { defaultValue: 'Visit summaries' })}>
          <div className="mt-6">
            <VisitSynthesisForm />
          </div>
        </PlanUpgradeGuard>
      );
    case 'sms':
      return (
        <PlanUpgradeGuard category="sms" featureName={t('plan_gate_name_sms', { defaultValue: 'SMS campaigns' })}>
          <SMSPage />
        </PlanUpgradeGuard>
      );
    case 'telemetry':
      return <Telemetry />;
    case 'agents':
      return <Agents />;
    case 'system_health':
      return <SystemHealth />;
    case 'disease_diagnosis':
      return (
        <PlanUpgradeGuard category="vision" featureName={t('plan_gate_name_diagnosis', { defaultValue: 'Disease and soil checks' })}>
          <DiseaseDiagnosisPage />
        </PlanUpgradeGuard>
      );
    case 'fields':
      return <PlanUpgradeGuard category="fields" featureName={t('plan_gate_name_fields', { defaultValue: 'Crops & fields' })}><CropsFields /></PlanUpgradeGuard>;
    case 'memory':
      return <Memory />;
    case 'email_workflows':
      return (
        <PlanUpgradeGuard category="workflows" featureName={t('plan_gate_name_email', { defaultValue: 'Email automation' })}>
          <EmailWorkflows />
        </PlanUpgradeGuard>
      );
    case 'mcp_tools':
      return <MCPTools />;
    case 'user_management':
      return <UserManagementPage />;
    case 'worldmonitor':
      return (
        <PlanUpgradeGuard category="worldmonitor" featureName={t('plan_gate_name_map', { defaultValue: 'Farm map' })}>
          <WorldMonitor />
        </PlanUpgradeGuard>
      );
    case 'advisory_studio':
      return <AdvisoryStudioPage />;
    default:
      return null;
  }
}
