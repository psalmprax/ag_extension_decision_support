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
}

export const getNavItems = (isModern: boolean): NavItem[] => [
    { id: 'dashboard', label: isModern ? 'Strategic Intelligence' : 'Operations Dashboard', icon: LayoutDashboard, roles: ['extension_officer', 'admin'] },
    { id: 'farmer_dashboard', label: isModern ? 'Strategic Intelligence' : 'Operations Dashboard', icon: LayoutDashboard, roles: ['farmer'] },
    { id: 'aiassistant', label: isModern ? 'Cognitive Synthesizer' : 'AI Assistant', icon: MessageSquare, roles: ['extension_officer', 'admin', 'farmer'] },
    { id: 'farmerchat', label: isModern ? 'Network Communications' : 'Farmer Chat', icon: Users, roles: ['extension_officer', 'admin'] },
    { id: 'knowledge', label: isModern ? 'Ontological Repository' : 'Knowledge Base', icon: Search, roles: ['extension_officer', 'admin', 'farmer'] },
    { id: 'portfolio', label: isModern ? 'Human Capital Network' : 'Client Portfolio', icon: Users, roles: ['extension_officer', 'admin'] },
    { id: 'register_farmer', label: isModern ? 'Node Provisioning' : 'Register Client', icon: UserPlus, roles: ['extension_officer', 'admin'] },
    { id: 'visit_synthesis', label: isModern ? 'Encounter Analysis' : 'Visit Synthesis', icon: Sparkles, roles: ['extension_officer', 'admin'] },
    { id: 'visits', label: isModern ? 'Field Telemetry' : 'Field Visits', icon: MapPin, roles: ['extension_officer', 'admin', 'farmer'] },
    { id: 'reports', label: isModern ? 'Executive Reporting' : 'Data Reports', icon: FileText, roles: ['extension_officer', 'admin'] },
    { id: 'sms', label: isModern ? 'Omnichannel Broadcasting' : 'SMS Campaigns', icon: Send, roles: ['extension_officer', 'admin'] },
    { id: 'analytics', label: isModern ? 'Growth Optimization' : 'System Analytics', icon: BarChart3, roles: ['extension_officer', 'admin'] },
    { id: 'billing', label: isModern ? 'Capital Utilization' : 'Billing & Subscriptions', icon: CreditCard, roles: ['extension_officer', 'admin', 'farmer'] },
    { id: 'telemetry', label: isModern ? 'Neural Telemetry' : 'System Telemetry', icon: Activity, roles: ['admin'] },
    { id: 'agents', label: isModern ? 'Autonomous Orchestration' : 'Agent Manager', icon: Settings, roles: ['admin'] },
    { id: 'system_health', label: isModern ? 'Infrastructure Vitality' : 'System Health', icon: Shield, roles: ['admin'] },
    { id: 'fields', label: isModern ? 'Agronomic Topology' : 'Fields & Crops', icon: Leaf, roles: ['extension_officer', 'admin', 'farmer'] },
    { id: 'disease_diagnosis', label: isModern ? 'Pathological Diagnostics' : 'Disease Checker', icon: Leaf, roles: ['extension_officer', 'admin'] },
    { id: 'memory', label: isModern ? 'Cognitive Persistence' : 'Memory Manager', icon: Brain, roles: ['admin'] },
    { id: 'email_workflows', label: isModern ? 'Automated Dispatch' : 'Email Workflows', icon: Mail, roles: ['admin'] },
    { id: 'mcp_tools', label: isModern ? 'Protocol Toolchain' : 'System Tools', icon: Wrench, roles: ['admin'] },
    { id: 'user_management', label: isModern ? 'Personnel Registry' : 'User Management', icon: UserCog, roles: ['admin'] },
];
