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
  Globe,
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

export const getNavItems = (): NavItem[] => [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'farmer_dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['farmer'],
  },
  {
    id: 'aiassistant',
    label: 'AI Assistant',
    icon: MessageSquare,
    roles: ['extension_officer', 'admin', 'farmer'],
    hiddenInDemo: true,
    requiresPro: true,
  },
  {
    id: 'farmerchat',
    label: 'Farmer Chat',
    icon: Users,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'knowledge',
    label: 'Knowledge Base',
    icon: Search,
    roles: ['extension_officer', 'admin', 'farmer'],
  },
  {
    id: 'portfolio',
    label: 'Farmers',
    icon: Users,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'register_farmer',
    label: 'Register Client',
    icon: UserPlus,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'visit_synthesis',
    label: 'Visit Synthesis',
    icon: Sparkles,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'visits',
    label: 'Visits',
    icon: MapPin,
    roles: ['extension_officer', 'admin', 'farmer'],
    requiresPro: true,
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    roles: ['extension_officer', 'admin'],
  },
  {
    id: 'sms',
    label: 'SMS',
    icon: Send,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    roles: ['extension_officer', 'admin', 'farmer'],
  },
  {
    id: 'telemetry',
    label: 'Telemetry',
    icon: Activity,
    roles: ['admin'],
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: Settings,
    roles: ['admin'],
  },
  {
    id: 'system_health',
    label: 'System Health',
    icon: Shield,
    roles: ['admin'],
  },
  {
    id: 'fields',
    label: 'Fields',
    icon: Leaf,
    roles: ['extension_officer', 'admin', 'farmer'],
  },
  {
    id: 'disease_diagnosis',
    label: 'Disease Diagnosis',
    icon: Leaf,
    roles: ['extension_officer', 'admin'],
    requiresPro: true,
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: Brain,
    roles: ['admin'],
  },
  {
    id: 'email_workflows',
    label: 'Email Workflows',
    icon: Mail,
    roles: ['admin'],
    requiresPro: true,
  },
  {
    id: 'mcp_tools',
    label: 'MCP Tools',
    icon: Wrench,
    roles: ['admin'],
  },
  {
    id: 'user_management',
    label: 'User Management',
    icon: UserCog,
    roles: ['admin'],
  },
  {
    id: 'worldmonitor',
    label: 'WorldMonitor',
    icon: Globe,
    roles: ['extension_officer', 'admin', 'regional_manager'],
    requiresPro: true,
  },
];
