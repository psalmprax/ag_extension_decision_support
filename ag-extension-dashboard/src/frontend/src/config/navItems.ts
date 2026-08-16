import {
  LayoutDashboard,
  MessageSquare,
  Users,
  UserPlus,
  Sparkles,
  MapPin,
  FileText,
  Send,
  BarChart3,
  CreditCard,
  Activity,
  Settings,
  Shield,
  Leaf,
  Brain,
  Mail,
  Wrench,
  Search,
  UserCog,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  /** When true, this nav item is hidden for demo users */
  hiddenInDemo?: boolean;
  /** When true, this feature requires a Pro or Enterprise subscription tier */
  requiresPro?: boolean;
}

const getLabel = (isModern: boolean, modernLabel: string, defaultLabel: string) =>
  isModern ? modernLabel : defaultLabel;

export const getNavItems = (isModern: boolean): NavItem[] => [
  {
    id: 'dashboard',
    label: getLabel(isModern, 'Strategic Intelligence', 'Operations Dashboard'),
    icon: LayoutDashboard,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'farmer_dashboard',
    label: getLabel(isModern, 'Strategic Intelligence', 'Operations Dashboard'),
    icon: LayoutDashboard,
    roles: ['farmer'],
  },
  {
    id: 'aiassistant',
    label: getLabel(isModern, 'Cognitive Synthesizer', 'AI Assistant'),
    icon: MessageSquare,
    roles: ['extension_officer', 'admin', 'farmer'],
    hiddenInDemo: true,
    requiresPro: true,
  },
  {
    id: 'farmerchat',
    label: getLabel(isModern, 'Network Communications', 'Farmer Chat'),
    icon: Users,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'knowledge',
    label: getLabel(isModern, 'Ontological Repository', 'Knowledge Base'),
    icon: Search,
    roles: ['extension_officer', 'admin', 'farmer'],
  },
  {
    id: 'portfolio',
    label: getLabel(isModern, 'Human Capital Network', 'Client Portfolio'),
    icon: Users,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'register_farmer',
    label: getLabel(isModern, 'Node Provisioning', 'Register Client'),
    icon: UserPlus,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'visit_synthesis',
    label: getLabel(isModern, 'Encounter Analysis', 'Visit Synthesis'),
    icon: Sparkles,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'visits',
    label: getLabel(isModern, 'Field Telemetry', 'Field Visits'),
    icon: MapPin,
    roles: ['extension_officer', 'admin', 'farmer'],
  },
  {
    id: 'reports',
    label: getLabel(isModern, 'Executive Reporting', 'Data Reports'),
    icon: FileText,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'sms',
    label: getLabel(isModern, 'Omnichannel Broadcasting', 'SMS Campaigns'),
    icon: Send,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'analytics',
    label: getLabel(isModern, 'Growth Optimization', 'System Analytics'),
    icon: BarChart3,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'billing',
    label: getLabel(isModern, 'Capital Utilization', 'Billing & Subscriptions'),
    icon: CreditCard,
    roles: ['extension_officer', 'admin', 'farmer'],
  },
  {
    id: 'telemetry',
    label: getLabel(isModern, 'Neural Telemetry', 'System Telemetry'),
    icon: Activity,
    roles: ['admin'],
  },
  {
    id: 'agents',
    label: getLabel(isModern, 'Autonomous Orchestration', 'Agent Manager'),
    icon: Settings,
    roles: ['admin'],
  },
  {
    id: 'system_health',
    label: getLabel(isModern, 'Infrastructure Vitality', 'System Health'),
    icon: Shield,
    roles: ['admin'],
  },
  {
    id: 'fields',
    label: getLabel(isModern, 'Agronomic Topology', 'Fields & Crops'),
    icon: Leaf,
    roles: ['extension_officer', 'admin', 'farmer'],
  },
  {
    id: 'disease_diagnosis',
    label: getLabel(isModern, 'Pathological Diagnostics', 'Disease Checker'),
    icon: Leaf,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'memory',
    label: getLabel(isModern, 'Cognitive Persistence', 'Memory Manager'),
    icon: Brain,
    roles: ['admin'],
  },
  {
    id: 'email_workflows',
    label: getLabel(isModern, 'Automated Dispatch', 'Email Workflows'),
    icon: Mail,
    roles: ['admin'],
    requiresPro: true,
  },
  {
    id: 'mcp_tools',
    label: getLabel(isModern, 'Protocol Toolchain', 'System Tools'),
    icon: Wrench,
    roles: ['admin'],
  },
  {
    id: 'user_management',
    label: getLabel(isModern, 'Personnel Registry', 'User Management'),
    icon: UserCog,
    roles: ['admin'],
  },
];
