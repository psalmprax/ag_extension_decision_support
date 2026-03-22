import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FarmerMap from '@/components/FarmerMap';
import {
    LayoutDashboard,
    MessageSquare,
    FileText,
    BarChart3,
    Users,
    MapPin,
    Search,
    ChevronRight,
    TrendingUp,
    Activity,
    AlertTriangle,
    Clock,
    Sun as SunIcon,
    Moon as MoonIcon,
    Send,
    Plus,
    UserPlus,
    Sparkles,
    LogOut,
    Navigation,
    Pencil,
    Trash2,
    CreditCard,
    Menu,
    X,
    Bell,
    Loader2,
    ChevronDown,
    User,
    Settings,
    Shield,
    HelpCircle
} from 'lucide-react';
import { NotificationPanel } from './components/NotificationPanel';
import { useEffect } from 'react';
import { WeatherWidget } from '@/components/WeatherWidget';
import { CardSkeleton } from '@/components/Skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { askAI } from '@/api/knowledgeService';
import { fetchUserProfile, AuthResponse, ProfileResponse } from '@/api/authService';
import { fetchFarmers } from '@/api/farmerService';
import { fetchVisits } from '@/api/visitService';
import { fetchReports, generateReport } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { fetchConversations, fetchMessages, sendMessage, createConversation, createAIConversation } from '@/api/chatbotService';
import { themes, getThemeCSS, applyTheme } from '@/theme';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import VisitModal from '@/components/forms/VisitModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { FarmerRegistrationForm } from '@/components/forms/FarmerRegistrationForm';
import { FarmerDashboard } from '@/components/FarmerDashboard';
import { RoleGuard } from '@/components/RoleGuard';
import { VisitSynthesisForm } from '@/components/forms/VisitSynthesisForm';
import { BillingDashboard } from '@/components/BillingDashboard';
import { UsageQuota } from '@/components/UsageQuota';
import { FarmerDetailPanel } from '@/components/FarmerDetailPanel';
import ErrorBoundary from '@/components/ErrorBoundary';
import { subscribeUserToPush } from '@/api/pushNotificationService';

// COLORS constant removed as it's unused

interface StatCardProps {
    title: string;
    value: number | string;
    change?: number;
    icon: React.ElementType;
    delay: number;
}

const StatCard = ({ title, value, change, icon: Icon, delay }: StatCardProps) => {
    const { t } = useLanguage();
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="card p-6 bg-theme-bg-card dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300"
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value.toLocaleString()}</p>
                    {change !== undefined && (
                        <div className={`flex items-center gap-1 text-xs font-bold mt-2 ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                            <span>{change >= 0 ? '+' : ''}{change}%</span>
                            <span className="text-gray-400 font-medium ml-1">{t('stat_vs_last_month')}</span>
                        </div>
                    )}
                </div>
                <div className="p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
            </div>
        </motion.div>
    );
};

interface Conversation {
    id: string;
    title: string;
    farmerId?: string;
    farmerName?: string;
    lastMessage?: string;
    updatedAt: string;
    startedAt: string;
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'officer';
    content: string;
    timestamp: string;
}

interface Farmer {
    id: string;
    firstName: string;
    lastName: string;
    region?: string;
    village?: string;
    farmSize?: number;
    crops?: string[];
    latitude?: number;
    longitude?: number;
    phone?: string;
    yield?: number;
    status?: string;
}

interface Visit {
    id: string;
    farmer_id: string;
    farmer_name: string;
    scheduled_at: string;
    visit_type: string;
    status: string;
}

interface Report {
    id: string;
    title: string;
    status: string;
    generatedAt: string;
}

interface DashboardData {
    overview: {
        totalFarmers: number;
        activeConversations: number;
        visitsThisMonth: number;
        avgSatisfaction: number;
    };
    trends: {
        farmersGrowth: number;
        conversationsGrowth: number;
        visitsGrowth: number;
        satisfactionChange: number;
    };
}

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
        notifications
    } = useAppStore();

    // Logout handler
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [userLocation, setUserLocation] = useState<string>('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [ragAnswer, setRagAnswer] = useState<{ answer: string; contextUsed: any[] } | null>(null);
    const [isAsking, setIsAsking] = useState(false);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Apply theme when it changes
    useEffect(() => {
        applyTheme(themeName);
        localStorage.setItem('ag-theme-name', themeName);
    }, [themeName]);

    // Chatbot States (AI Assistant)
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [editingConvId, setEditingConvId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState<string>('');
    const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Farmer Chat States
    const [farmerConversations, setFarmerConversations] = useState<Conversation[]>([]);

    // Visit Modal State
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [activeFarmerConvId, setActiveFarmerConvId] = useState<string | null>(null);
    const [farmerChatMessages, setFarmerChatMessages] = useState<ChatMessage[]>([]);
    const [farmerChatInput, setFarmerChatInput] = useState('');
    const [showFarmerModal, setShowFarmerModal] = useState(false);
    const [farmerSearchQuery, setFarmerSearchQuery] = useState('');

    // Farmer Detail Panel State
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

    const handleOpenFarmerDetail = (farmer: Farmer) => {
        setSelectedFarmer(farmer);
        setIsDetailPanelOpen(true);
    };

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    useEffect(() => {
        localStorage.setItem('ag-theme-name', themeName);

        // Apply theme variables to :root
        const root = document.documentElement;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const theme = themes[themeName];

        // Inject variables
        const cssVars = getThemeCSS(themeName);
        // We can either set them individually or use a style tag. 
        // Individual setProperty is more robust for some browsers.
        const varsArray = cssVars.split(';').filter(v => v.trim());
        varsArray.forEach(v => {
            const [name, value] = v.split(':');
            if (name && value) {
                root.style.setProperty(name.trim(), value.trim());
            }
        });
    }, [themeName]);

    // Push Notification Subscription
    useEffect(() => {
        if (storeUser) {
            // Attempt to subscribe to push notifications
            subscribeUserToPush().catch(err => {
                console.warn('Push subscription failed:', err);
            });
        }
    }, [storeUser]);

    // Get user location on mount
    useEffect(() => {
        // Set login time
        // Set login time removed as loginTime state is unused

        // Try to get user's real location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        // Reverse geocode to get location name
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                        );
                        const data = await response.json();
                        const location = data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Unknown';
                        const country = data.address?.country || '';
                        setUserLocation(location + (country ? `, ${country}` : ''));
                    } catch {
                        setUserLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
                    }
                },
                (error) => {
                    console.log('Geolocation error:', error.message);
                    if (error.code === 1 && error.message.includes('Only secure origins are allowed')) {
                        console.warn('Geolocation blocked: Not a secure origin (HTTPS/localhost)');
                    }
                    setUserLocation(storeUser?.region || 'Kenya');
                }
            );
        } else {
            setUserLocation(storeUser?.region || 'Kenya');
        }
    }, [storeUser]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            setActiveTab('billing');
            // Show toast or notification? We can use the existing state
        } else if (params.get('canceled') === 'true') {
            setActiveTab('billing');
        }
    }, [setActiveTab]);

    const { data: userResponse } = useQuery<ProfileResponse>({
        queryKey: ['user-profile'],
        queryFn: fetchUserProfile,
    });

    const user = userResponse?.data;

    // Fetch Dashboard Data
    const { data: dashboardResponse, isLoading, isError } = useQuery<{ success: boolean; data: DashboardData }>({
        queryKey: ['dashboard'],
        queryFn: fetchDashboardData,
        enabled: activeTab === 'dashboard'
    });

    const dashboardData = dashboardResponse?.data;

    // Fetch Farmers Data (Portfolio)
    const { data: farmersResponse } = useQuery<{ success: boolean; data: { farmers: Farmer[] } }>({
        queryKey: ['farmers'],
        queryFn: fetchFarmers,
        enabled: activeTab === 'portfolio'
    });
    const queryFarmers = farmersResponse?.data?.farmers || [];
    const farmers = queryFarmers.length > 0 ? queryFarmers : storeFarmers;

    // Fetch Visits Data
    const { data: visitsResponse, refetch: refetchVisits } = useQuery<{ success: boolean; data: { visits: Visit[] } }>({
        queryKey: ['visits'],
        queryFn: fetchVisits,
        enabled: activeTab === 'visits'
    });
    const visits = visitsResponse?.data?.visits || [];

    // Fetch Reports Data
    const { data: reportsResponse, refetch: refetchReports } = useQuery<{ success: boolean; data: { reports: Report[] } }>({
        queryKey: ['reports'],
        queryFn: fetchReports,
        enabled: activeTab === 'reports'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reports = (reportsResponse as any)?.data?.reports || [];

    // Fetch Analytics/Performance Data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: performanceResponse } = useQuery<{ success: boolean; data: any }>({
        queryKey: ['performance'],
        queryFn: fetchPerformanceData,
        enabled: activeTab === 'analytics'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const performanceData = (performanceResponse as any)?.data;

    const allNavItems = [
        { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, roles: ['extension_officer', 'admin'] },
        { id: 'farmer_dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, roles: ['farmer'] },
        { id: 'aiassistant', label: t('chat_ai_advisor'), icon: MessageSquare, roles: ['extension_officer', 'admin', 'farmer'] },
        { id: 'farmerchat', label: t('chat_farmer_chats'), icon: Users, roles: ['extension_officer', 'admin'] },
        { id: 'knowledge', label: t('nav_knowledge'), icon: Search, roles: ['extension_officer', 'admin', 'farmer'] },
        { id: 'portfolio', label: t('portfolio_title'), icon: Users, roles: ['extension_officer', 'admin'] },
        { id: 'register_farmer', label: t('farmer_register_title'), icon: UserPlus, roles: ['extension_officer', 'admin'] },
        { id: 'visit_synthesis', label: t('visit_synthesis_title'), icon: Sparkles, roles: ['extension_officer', 'admin'] },
        { id: 'visits', label: t('nav_visits'), icon: MapPin, roles: ['extension_officer', 'admin', 'farmer'] },
        { id: 'reports', label: t('reports_title'), icon: FileText, roles: ['extension_officer', 'admin'] },
        { id: 'sms', label: t('nav_sms'), icon: Send, roles: ['extension_officer', 'admin'] },
        { id: 'analytics', label: t('analytics_title'), icon: BarChart3, roles: ['extension_officer', 'admin'] },
        { id: 'billing', label: t('nav_billing'), icon: CreditCard, roles: ['extension_officer', 'admin', 'farmer'] },
    ];

    const navItems = allNavItems.filter(item => !user || item.roles.includes(user.role));

    // Report Generation
    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        try {
            await generateReport('synthesis', 'AI Synthesis Report');
            addNotification({
                type: 'success',
                message: t('reports_generated_success') || 'AI Synthesis Report generated successfully!'
            });
            refetchReports();
        } catch (error) {
            console.error('Failed to generate report:', error);
            addNotification({
                type: 'error',
                message: 'Failed to generate report. Please try again.'
            });
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleKnowledgeSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setRagAnswer(null);
        setIsAsking(true);
        try {
            const result = await askAI(searchQuery);
            setRagAnswer(result.data);
        } catch (error) {
            console.error('Failed to ask AI:', error);
        } finally {
            setIsAsking(false);
        }
    };

    const loadConversations = useCallback(async () => {
        try {
            const res = await fetchConversations();
            setConversations(res.data);
            if (res.data.length > 0 && !activeConvId) {
                setActiveConvId(res.data[0].id);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    }, [activeConvId]);

    const loadMessages = useCallback(async (id: string) => {
        try {
            const res = await fetchMessages(id);
            setChatMessages(res.data);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }, []);

    const updateConversationTitle = async (id: string, title: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/chatbot/conversations/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title }),
            });
            if (res.ok) {
                setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
                setEditingConvId(null);
            }
        } catch (error) {
            console.error('Failed to update conversation:', error);
        }
    };

    const deleteConversation = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/chatbot/conversations/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });
            if (res.ok) {
                setConversations(prev => prev.filter(c => c.id !== id));
                if (activeConvId === id) {
                    setActiveConvId(null);
                    setChatMessages([]);
                }
                setDeletingConvId(null);
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        }
    };

    // Farmer Chat functions
    const loadFarmerConversations = useCallback(async () => {
        try {
            const res = await fetchConversations();
            setFarmerConversations(res.data);
            if (res.data.length > 0 && !activeFarmerConvId) {
                setActiveFarmerConvId(res.data[0].id);
            }
        } catch (error) {
            console.error('Failed to load farmer conversations:', error);
        }
    }, [activeFarmerConvId]);

    const loadFarmerMessages = useCallback(async (id: string) => {
        try {
            const res = await fetchMessages(id);
            setFarmerChatMessages(res.data);
        } catch (error) {
            console.error('Failed to load farmer messages:', error);
        }
    }, []);

    const handleFarmerChatSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!farmerChatInput.trim()) return;

        const userMsg: ChatMessage = { role: 'officer', content: farmerChatInput, timestamp: new Date().toISOString() };
        setFarmerChatMessages(prev => [...prev, userMsg]);
        setFarmerChatInput('');

        try {
            const res = await sendMessage({
                conversationId: activeFarmerConvId || undefined,
                message: farmerChatInput,
                mode: 'farmer',
                language
            });
            if (res.success) {
                // Reload messages to get the saved message
                if (activeFarmerConvId) {
                    loadFarmerMessages(activeFarmerConvId);
                }
            }
        } catch (error) {
            console.error('Failed to send farmer message:', error);
        }
    };

    // Farmer state for new conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [farmerList, setFarmerList] = useState<any[]>([]);
    const [isLoadingFarmers, setIsLoadingFarmers] = useState(false);

    const loadFarmers = async () => {
        try {
            setIsLoadingFarmers(true);
            const res = await fetchFarmers();
            setFarmerList(res.data?.farmers || []);
        } catch (error) {
            console.error('Failed to load farmers:', error);
            setFarmerList([]);
        } finally {
            setIsLoadingFarmers(false);
        }
    };

    const handleStartConversation = async (farmer: Farmer, chatType: 'ai' | 'farmer' = 'ai') => {
        try {
            // Check if conversation already exists with this farmer
            const existingConversations = chatType === 'farmer' ? farmerConversations : conversations;
            const existingConv = existingConversations.find((c: Conversation) => c.farmerId === farmer.id);

            if (existingConv) {
                // Redirect to existing conversation
                if (chatType === 'farmer') {
                    setActiveFarmerConvId(existingConv.id);
                    loadFarmerMessages(existingConv.id);
                } else {
                    setActiveConvId(existingConv.id);
                    loadMessages(existingConv.id);
                }
                setShowFarmerModal(false);
                setFarmerSearchQuery('');
                return;
            }

            const res = await createConversation({
                farmerId: farmer.id,
                farmerName: `${farmer.firstName} ${farmer.lastName}`,
                language: 'en'
            });
            if (res.success && res.data) {
                if (chatType === 'farmer') {
                    // Add to Farmer Chat list
                    setFarmerConversations(prev => [res.data, ...prev]);
                    setActiveFarmerConvId(res.data.id);
                    setFarmerChatMessages([]);
                } else {
                    // Add to AI Assistant list
                    setConversations(prev => [res.data, ...prev]);
                    setActiveConvId(res.data.id);
                    setChatMessages([]);
                }
                setShowFarmerModal(false);
                setFarmerSearchQuery('');
            }
        } catch (error) {
            console.error('Failed to start conversation:', error);
        }
    };

    const handleChatSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !activeConvId) return;

        const userMsg: ChatMessage = { role: 'user', content: chatInput, timestamp: new Date().toISOString() };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsTyping(true);

        try {
            const res = await sendMessage({ conversationId: activeConvId, message: chatInput, language });
            const aiMsg: ChatMessage = { role: 'assistant', content: res.response, timestamp: new Date().toISOString() };
            setChatMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'aiassistant') {
            loadConversations();
        }
        if (activeTab === 'farmerchat') {
            loadFarmerConversations();
        }
    }, [activeTab, loadConversations, loadFarmerConversations]);

    useEffect(() => {
        if (activeConvId) {
            loadMessages(activeConvId);
        }
    }, [activeConvId, loadMessages]);

    if (isError) return <div className="flex items-center justify-center min-h-screen text-red-500 bg-gray-50 dark:bg-gray-900">{t('error_loading')}</div>;

    const ThemeToggle = () => (
        <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-600 dark:text-gray-400 backdrop-blur-sm"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
    );

    return (
        <div className={`min-h-screen ${darkMode ? 'dark' : ''} bg-theme-bg-primary transition-colors duration-300`}>
            {/* Top Navigation */}
            <header className="fixed top-0 left-0 right-0 z-50 glass bg-theme-bg-card/80 border-b border-gray-200 dark:border-gray-800 transition-colors">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
                        >
                            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                                <span className="text-white font-bold text-lg">Ag</span>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('app_title')}</h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('app_subtitle')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:block flex-1 max-w-xl mx-8">
                        <WeatherWidget location={userLocation || storeUser?.region || 'Kenya'} />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={t('common_search') + "..."}
                                className="input dark:bg-gray-800 dark:border-gray-700 dark:text-white pl-10 w-48 xl:w-64"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
                        <LanguageSwitcher compact />
                        <ThemeToggle />
                        <button 
                            onClick={() => setIsNotificationPanelOpen(true)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                        >
                            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            {notifications.some(n => !n.read) && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse"></span>
                            )}
                        </button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                            >
                                <div className="w-10 h-10 bg-gradient-to-br from-secondary-500 to-secondary-700 rounded-full flex items-center justify-center shadow-lg shadow-secondary-500/20">
                                    <span className="text-white font-medium">{storeUser?.firstName?.[0]}{storeUser?.lastName?.[0] || 'U'}</span>
                                </div>
                                <div className="hidden xl:block text-left">
                                    <p className="text-sm font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-1">
                                        {storeUser?.firstName} {storeUser?.lastName || 'User'}
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                                    </p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-black leading-none mt-1">{storeUser?.role?.replace('_', ' ') || 'Extension Officer'}</p>
                                </div>
                            </button>

                            <AnimatePresence>
                                {isProfileMenuOpen && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setIsProfileMenuOpen(false)}
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-2 z-50 backdrop-blur-xl"
                                        >
                                            <div className="p-3 mb-2 border-b border-gray-100 dark:border-gray-700">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Account Info</p>
                                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{storeUser?.email}</p>
                                            </div>
                                            
                                            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 group">
                                                <User className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                                                <span className="text-xs font-bold uppercase tracking-widest">My Profile</span>
                                            </button>
                                            
                                            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 group">
                                                <Settings className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Settings</span>
                                            </button>

                                            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 group">
                                                <HelpCircle className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Help Center</span>
                                            </button>

                                            <div className="h-px bg-gray-100 dark:bg-gray-700 my-2" />
                                            
                                            <button 
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-gray-600 dark:text-gray-300 group"
                                            >
                                                <LogOut className="w-4 h-4 text-gray-400 group-hover:text-rose-500" />
                                                <span className="text-xs font-bold uppercase tracking-widest group-hover:text-rose-500">Sign Out</span>
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </header>

            {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 260, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="fixed left-0 top-[73px] bottom-0 z-40 bg-theme-bg-card border-r border-gray-200 dark:border-gray-800 overflow-hidden transition-colors"
                    >
                        <nav className="p-4 space-y-2">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => item.id === 'sms' ? navigate('/sms') : setActiveTab(item.id)}
                                    aria-label={item.label}
                                    aria-current={activeTab === item.id ? 'page' : undefined}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${activeTab === item.id
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                                    <span className="font-semibold text-sm truncate">{item.label}</span>
                                </button>
                            ))}

                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
                                <UsageQuota />
                            </div>
                        </nav>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className={`pt-[73px] min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-[260px]' : 'ml-0'}`}>
                <div className="p-8">
                    <div className=''>
                        <ErrorBoundary>
                            {activeTab === 'farmer_dashboard' && <FarmerDashboard />}

                            {activeTab === 'register_farmer' && (
                                <RoleGuard allowedRoles={['extension_officer', 'admin']}>
                                    <FarmerRegistrationForm />
                                </RoleGuard>
                            )}

                            {activeTab === 'visit_synthesis' && (
                                <RoleGuard allowedRoles={['extension_officer', 'admin']}>
                                    <VisitSynthesisForm />
                                </RoleGuard>
                            )}
                        </ErrorBoundary>
                    </div>

                    {activeTab === 'dashboard' && (
                        <ErrorBoundary>
                            <div className='mb-8'>
                                <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>{t('dashboard_overview')}</h1>
                                <p className={themeName === 'cyber' ? 'text-primary-300/60 mt-1 font-bold uppercase tracking-widest text-xs' : 'text-gray-500 dark:text-gray-400 mt-1 font-medium'}>{t('dashboard_welcome').replace('{name}', user?.firstName || 'Extension Officer')}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                {isLoading ? (
                                    <>
                                        <CardSkeleton />
                                        <CardSkeleton />
                                        <CardSkeleton />
                                        <CardSkeleton />
                                    </>
                                ) : dashboardData ? (
                                    <>
                                        <StatCard title={t('stat_total_farmers')} value={dashboardData.overview.totalFarmers} change={dashboardData.trends.farmersGrowth} icon={Users} delay={0} />
                                        <StatCard title={t('stat_active_conversations')} value={dashboardData.overview.activeConversations} change={dashboardData.trends.conversationsGrowth} icon={MessageSquare} delay={0.05} />
                                        <StatCard title={t('stat_visits_this_month')} value={dashboardData.overview.visitsThisMonth} change={dashboardData.trends.visitsGrowth} icon={MapPin} delay={0.1} />
                                        <StatCard title={t('stat_avg_satisfaction')} value={dashboardData.overview.avgSatisfaction} change={dashboardData.trends.satisfactionChange} icon={TrendingUp} delay={0.15} />
                                    </>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                <div className={`${themeName === 'cyber' ? 'lg:col-span-3' : 'lg:col-span-2'} card p-6 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group`}>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <MapPin className="w-5 h-5 text-primary-500" />
                                            {t('stat_regional_distribution')}
                                        </h3>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded text-[10px] font-bold uppercase tracking-widest">
                                                {t('stat_malawi_overview')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="relative h-[400px] bg-theme-bg-primary dark:bg-gray-900/50 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                                        <FarmerMap
                                            height="400px"
                                            isExternalExpanded={isMapExpanded}
                                            onToggleExpand={setIsMapExpanded}
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            farmers={farmers.map((f: any) => ({
                                                id: f.id,
                                                name: f.name || `${f.firstName} ${f.lastName}`,
                                                lat: f.latitude || f.lat || 0,
                                                lng: f.longitude || f.lng || 0,
                                                crop: f.crops?.[0] || f.crop || 'Maize',
                                                region: f.region || f.location || 'Unknown',
                                                size: f.farmSize || f.size || 0,
                                                phone: f.phone,
                                                yield: f.yield || 0
                                            }))}
                                            onFarmerClick={(farmerData) => {
                                                if (user?.role === 'extension_officer' || user?.role === 'admin') {
                                                    setActiveTab('farmerchat');
                                                    // Map FarmerData back to Farmer for the conversation handler
                                                    const farmer = farmers.find(f => f.id === farmerData.id) as Farmer;
                                                    if (farmer) handleStartConversation(farmer, 'farmer');
                                                } else {
                                                    const farmer = farmers.find(f => f.id === farmerData.id) as Farmer;
                                                    if (farmer) handleOpenFarmerDetail(farmer);
                                                }
                                            }}
                                        />

                                         {!isMapExpanded && (
                                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-white/10 dark:bg-black/20 backdrop-blur-md p-3 rounded-xl border border-white/20">
                                                <div className="flex gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">{t('table_active')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-secondary-500 rounded-full"></div>
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">{t('analytics_disease_alerts')}</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setIsMapExpanded(true)}
                                                    className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase bg-primary-50 dark:bg-primary-900/30 px-3 py-1 rounded-lg hover:bg-primary-100 transition-colors"
                                                >
                                                    {t('viz_detail_view')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="card p-8 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden relative">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">{t('analytics_support_efficiency')}</h3>
                                    <div className="space-y-6">
                                        {[
                                            { name: t('analytics_resolution_rate'), progress: performanceData?.metrics?.resolutionRate || 85, color: 'bg-primary-500' },
                                            { name: t('analytics_satisfaction_score'), progress: (performanceData?.metrics?.satisfactionScore || 4.5) * 20, color: 'bg-secondary-500' },
                                            { name: t('analytics_follow_up_rate'), progress: performanceData?.metrics?.followUpRate || 45, color: 'bg-purple-500' },
                                            { name: t('analytics_first_contact_res'), progress: performanceData?.metrics?.firstContactResolution || 78, color: 'bg-orange-500' }
                                        ].map((item, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{item.name}</span>
                                                    <span className="text-xs font-black text-gray-400">{Math.round(item.progress)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${item.progress}%` }}
                                                        transition={{ duration: 1, delay: i * 0.1 }}
                                                        className={`h-full ${item.color} rounded-full`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                            </div>
                        </div>
                        </ErrorBoundary>
                    )}
                    {activeTab === 'portfolio' && (
                        <div>
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('portfolio_title')}</h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('portfolio_subtitle')}</p>
                            </div>
                            <div className="card overflow-hidden bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_farmer_details')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_region_village')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_crops')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_farm_size')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_status')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                            {farmers.map((farmer: Farmer) => (
                                                <tr
                                                    key={farmer.id}
                                                    onClick={() => handleOpenFarmerDetail(farmer)}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xs">
                                                                {farmer.firstName?.[0]}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{farmer.firstName} {farmer.lastName}</p>
                                                                <p className="text-[10px] text-gray-500">ID: #{farmer.id.slice(0, 8)}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{farmer.region}</p>
                                                        <p className="text-[10px] text-gray-500">{farmer.village}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {farmer.crops?.map((crop: string) => (
                                                                <span key={crop} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[9px] font-bold uppercase tracking-tighter">
                                                                    {crop}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 font-bold">{farmer.farmSize} <span className="text-gray-400 font-medium">ha</span></td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-[10px] font-bold uppercase tracking-wider">{t('table_active')}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'visits' && (
                        <div>
                            <div className="mb-8 flex justify-between items-center">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('nav_visits')}</h1>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('visits_subtitle')}</p>
                                </div>
                                <button
                                    onClick={() => setShowVisitModal(true)}
                                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    {t('visits_schedule_new')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {visits.map((visit: Visit) => (
                                    <div key={visit.id} className="card p-6 flex items-center justify-between bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-secondary-50 dark:bg-secondary-900/30 rounded-2xl flex items-center justify-center transition-colors group-hover:bg-secondary-100 dark:group-hover:bg-secondary-900/50">
                                                <MapPin className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{visit.farmer_name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Clock className="w-3 h-3 text-gray-400" />
                                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                                        {new Date(visit.scheduled_at).toLocaleDateString()} at {new Date(visit.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium bg-gray-50 dark:bg-gray-700/50 w-fit px-2 py-0.5 rounded uppercase tracking-tighter">
                                                    {visit.visit_type}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${visit.status === 'completed'
                                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                                                : 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                                                }`}>
                                                {visit.status}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    const farmerData = farmers.find((f: any) => f.id === visit.farmer_id || f.name === visit.farmer_name);
                                                    if (farmerData) handleOpenFarmerDetail(farmerData);
                                                }}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            >
                                                <ChevronRight className="w-5 h-5 text-gray-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div>
                            <div className="mb-8 flex justify-between items-center">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('reports_title')}</h1>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('reports_subtitle')}</p>
                                </div>
                                <button 
                                    onClick={handleGenerateReport}
                                    disabled={isGeneratingReport}
                                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2"
                                >
                                    {isGeneratingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    {isGeneratingReport ? t('reports_generating') || 'Generating...' : t('reports_generate_new')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {reports.map((report: Report) => (
                                    <div key={report.id} className="card group p-6 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-all cursor-pointer shadow-sm hover:shadow-xl">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-2xl group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                                                <FileText className="w-8 h-8 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                                            </div>
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${report.status === 'ready'
                                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                                                : 'bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-400'
                                                }`}>
                                                {report.status}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors capitalize">
                                            {report.title}
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-6 font-medium">
                                            {t('reports_description_prefix')}{report.title.toLowerCase()}{t('reports_description_suffix')}
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3 h-3 text-gray-400" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                    {new Date(report.generatedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex -space-x-2">
                                                <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-primary-500 flex items-center justify-center text-[8px] text-white font-bold">JD</div>
                                                <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-secondary-500 flex items-center justify-center text-[8px] text-white font-bold">AS</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && performanceData && (
                        <div>
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('analytics_title')}</h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('analytics_subtitle')}</p>
                            </div>

                            {/* Metrics Cards - Redesigned */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                                <div className="card p-5 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-900/10 border-primary-200 dark:border-primary-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary-500/10 rounded-lg">
                                            <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">{t('analytics_resolution_rate')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{performanceData.metrics.resolutionRate}%</p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-secondary-500/10 rounded-lg">
                                            <Clock className="w-4 h-4 text-secondary-600 dark:text-secondary-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">{t('analytics_avg_response_time')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{performanceData.metrics.avgResponseTime}</p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/10 border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary-500/10 rounded-lg">
                                            <Activity className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">{t('analytics_satisfaction_score')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{performanceData.metrics.satisfactionScore}</p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/10 border-orange-200 dark:border-orange-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-orange-500/10 rounded-lg">
                                            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">{t('analytics_follow_up_rate')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{performanceData.metrics.followUpRate}%</p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-purple-500/10 rounded-lg">
                                            <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">{t('analytics_first_contact_res')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{performanceData.metrics.firstContactResolution}%</p>
                                </div>
                            </div>

                            {/* Activity Timeline Chart */}
                            <div className="card p-8 mb-8 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">{t('analytics_activity_timeline')}</h3>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={performanceData.timeline}>
                                            <defs>
                                                <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 600 }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 600 }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                                                    borderColor: darkMode ? '#374151' : '#f3f4f6',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold'
                                                }}
                                            />
                                            <Area type="monotone" dataKey="visits" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorVisits)" />
                                            <Area type="monotone" dataKey="queries" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorQueries)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <BillingDashboard />
                    )}

                    {activeTab === 'knowledge' && (
                        <div className="max-w-4xl mx-auto py-8">
                            <div className="mb-8 text-center">
                                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">{t('knowledge_title')}</h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg font-medium">{t('knowledge_subtitle')}</p>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleKnowledgeSearch(e); }} className="mb-12">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-primary-500/10 dark:bg-primary-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-focus-within:opacity-100"></div>
                                    <div className="relative flex gap-3 p-2 bg-theme-bg-card dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-primary-500/5 items-center">
                                        <div className="pl-4">
                                            <Search className="w-5 h-5 text-primary-500" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={t('knowledge_search_ask')}
                                            className="flex-1 bg-transparent border-none focus:ring-0 py-4 text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <button
                                            type="submit"
                                            disabled={isAsking}
                                            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2"
                                        >
                                            {isAsking ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                    {t('knowledge_thinking')}
                                                </>
                                            ) : t('ai_ask_button')}
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {ragAnswer && (
                                <motion.div
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="card p-10 bg-theme-bg-card dark:bg-gray-800 shadow-2xl border-primary-100 dark:border-primary-900/50 border relative overflow-hidden group"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-bl-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform"></div>

                                    <div className="flex items-center gap-3 mb-6 text-primary-600 dark:text-primary-400">
                                        <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                                            <MessageSquare className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-2xl font-black tracking-tight">{t('ai_expert_recommendation')}</h3>
                                    </div>
                                    <div className="prose prose-primary dark:prose-invert max-w-none">
                                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg font-medium whitespace-pre-wrap">
                                            {ragAnswer.answer}
                                        </p>
                                    </div>
                                    <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700/50 flex flex-col gap-4">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-gray-400" />
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ">{t('ai_contextual_verification')}</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {ragAnswer.contextUsed.map((ctx: { metadata: { crop: string; category: string } }, i: number) => (
                                                <div key={i} className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600/50 rounded-xl flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                        {ctx.metadata.crop} / {ctx.metadata.category}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {activeTab === 'aiassistant' && (
                        <div className="flex h-[calc(100vh-140px)] gap-6">
                            {/* AI Advisor Sidebar - Redesigned */}
                            <div className="w-80 flex flex-col bg-theme-bg-card dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                                {/* Header */}
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{t('chat_ai_advisor')}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('chat_connect_farmers')}</p>
                                </div>

                                {/* Quick Actions */}
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await createAIConversation({ language });
                                                if (res.success && res.data) {
                                                    setConversations(prev => [res.data, ...prev]);
                                                    setActiveConvId(res.data.id);
                                                    setChatMessages([]);
                                                }
                                            } catch (error) {
                                                console.error('Failed to start AI conversation:', error);
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-primary-500/20"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('chat_start_new')}
                                    </button>
                                </div>

                                {/* AI Capabilities - Clean Card Design */}
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                    <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">{t('chat_ask_anything')}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                            <span className="text-primary-500">✓</span>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('chat_crop_diseases')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                            <span className="text-primary-500">✓</span>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('chat_weather')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                            <span className="text-primary-500">✓</span>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('chat_farming_practices')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                                            <span className="text-primary-500">✓</span>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('chat_pest_management')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg col-span-2">
                                            <span className="text-primary-500">✓</span>
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('chat_market_prices')}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Conversations */}
                                <div className="flex-1 overflow-y-auto p-2">
                                    <p className="px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('chat_recent')}</p>
                                    {conversations.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                            {t('chat_no_conversations')}
                                        </div>
                                    ) : (
                                        conversations.map(conv => (
                                            <div
                                                key={conv.id}
                                                className={`w-full p-3 rounded-xl text-left transition-all mb-1 ${activeConvId === conv.id
                                                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                                                        onClick={() => {
                                                            setActiveConvId(conv.id);
                                                            loadMessages(conv.id);
                                                        }}
                                                    >
                                                        <Sparkles className="w-4 h-4" />
                                                    </div>
                                                    {editingConvId === conv.id ? (
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingTitle}
                                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        updateConversationTitle(conv.id, editingTitle);
                                                                    } else if (e.key === 'Escape') {
                                                                        setEditingConvId(null);
                                                                    }
                                                                }}
                                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => updateConversationTitle(conv.id, editingTitle)}
                                                                className="p-1 text-green-600 hover:text-green-700"
                                                            >
                                                                <span className="text-lg">✓</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingConvId(null)}
                                                                className="p-1 text-gray-500 hover:text-gray-600"
                                                            >
                                                                <span className="text-lg">✕</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div
                                                                className="flex-1 min-w-0 cursor-pointer"
                                                                onClick={() => {
                                                                    setActiveConvId(conv.id);
                                                                    loadMessages(conv.id);
                                                                }}
                                                            >
                                                                <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                                                    {conv.title || t('chat_new_conv')}
                                                                </p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                    {conv.lastMessage || t('chat_ai_advisor')}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingConvId(conv.id);
                                                                        setEditingTitle(conv.title || '');
                                                                    }}
                                                                    className="p-1.5 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                                                                    title={t('chat_rename_conversation')}
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                {deletingConvId === conv.id ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => deleteConversation(conv.id)}
                                                                            className="p-1.5 text-error-500 hover:text-error-600 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20"
                                                                        >
                                                                            <span className="text-lg">✓</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDeletingConvId(null)}
                                                                            className="p-1.5 text-gray-400 hover:text-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                                                                        >
                                                                            <span className="text-lg">✕</span>
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setDeletingConvId(conv.id)}
                                                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                                                                        title={t('chat_delete_conversation')}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* AI Chat Area */}
                            <div className="flex-1 flex flex-col bg-theme-bg-card dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                                {activeConvId ? (
                                    <>
                                        {/* Chat Header */}
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/20">
                                                    <Sparkles className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">{t('chat_ai_advisor')}</h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('chat_ai_ready')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                                                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.role === 'assistant'
                                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                                                        : 'bg-primary-600 text-white rounded-tr-none'
                                                        }`}>
                                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                                        <span className={`text-[9px] mt-2 block ${msg.role === 'assistant' ? 'text-gray-400' : 'text-primary-200'}`}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            {isTyping && (
                                                <div className="flex justify-start">
                                                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-2xl rounded-tl-none animate-pulse flex gap-1">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Input */}
                                        <form onSubmit={handleChatSend} className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700">
                                            <div className="relative flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    value={chatInput}
                                                    onChange={(e) => setChatInput(e.target.value)}
                                                    placeholder={t('chat_input_placeholder')}
                                                    className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!chatInput.trim() || isTyping}
                                                    className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
                                                >
                                                    <Send className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 transition-colors">
                                            <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('chat_select_conversation')}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 max-w-xs">{t('chat_connect_farmers')}</p>
                                    </div>
                                )}
                            </div>

                            {/* Farmer Selection Modal */}
                            {showFarmerModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFarmerModal(false)} />
                                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                                        {/* Modal Header */}
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-gray-900 dark:text-white">{t('chat_start_new')}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('chat_select_farmer')}</p>
                                            </div>
                                            <button onClick={() => setShowFarmerModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                                <X className="w-5 h-5 text-gray-500" />
                                            </button>
                                        </div>

                                        {/* Search */}
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder={t('farmer_search_placeholder')}
                                                    value={farmerSearchQuery}
                                                    onChange={(e) => setFarmerSearchQuery(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 dark:text-white"
                                                />
                                            </div>
                                        </div>

                                        {/* Farmer List */}
                                        <div className="p-2 overflow-y-auto max-h-96">
                                            {isLoadingFarmers ? (
                                                <div className="p-8 text-center text-gray-500">{t('chat_loading_farmers')}</div>
                                            ) : farmerList.filter(f =>
                                                !farmerSearchQuery ||
                                                `${f.firstName} ${f.lastName}`.toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                                (f.region || '').toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                                (f.village || '').toLowerCase().includes(farmerSearchQuery.toLowerCase())
                                            ).length === 0 ? (
                                                <div className="p-8 text-center text-gray-500">{t('chat_no_farmers')}</div>
                                            ) : (
                                                farmerList.filter(f =>
                                                    !farmerSearchQuery ||
                                                    `${f.firstName} ${f.lastName}`.toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                                    (f.region || '').toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                                    (f.village || '').toLowerCase().includes(farmerSearchQuery.toLowerCase())
                                                ).map((farmer) => (
                                                    <button
                                                        key={farmer.id}
                                                        onClick={() => handleStartConversation(farmer, 'ai')}
                                                        className="w-full p-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
                                                    >
                                                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                                                            {farmer.firstName?.[0]}{farmer.lastName?.[0]}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-bold text-gray-900 dark:text-white">{farmer.firstName} {farmer.lastName}</p>
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                                <MapPin className="w-3 h-3" />
                                                                {farmer.village || farmer.region || t('unknown_location')}
                                                            </div>
                                                            {farmer.crops && farmer.crops.length > 0 && (
                                                                <div className="flex gap-1 mt-1 flex-wrap">
                                                                    {farmer.crops.slice(0, 2).map((crop: string, i: number) => (
                                                                        <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-full text-xs text-gray-600 dark:text-gray-300">{crop}</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <UserPlus className="w-5 h-5 text-primary-500" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Farmer Chat Section */}
                    {activeTab === 'farmerchat' && (
                        <div className="flex h-[calc(100vh-140px)] gap-6">
                            {/* Farmer Conversations Sidebar */}
                            <div className="w-80 flex flex-col bg-theme-bg-card dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-900 dark:text-white">{t('chat_farmer_chats')}</h3>
                                    <button
                                        onClick={() => { loadFarmers(); setShowFarmerModal(true); }}
                                        className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                                        title={t('common_new_conversation')}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {farmerConversations.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                            {t('chat_no_conversations')}<br />{t('chat_start_new_chat')}
                                        </div>
                                    ) : (
                                        farmerConversations.map(conv => (
                                            <button
                                                key={conv.id}
                                                onClick={() => {
                                                    setActiveFarmerConvId(conv.id);
                                                    loadFarmerMessages(conv.id);
                                                }}
                                                className={`w-full p-3 rounded-xl text-left transition-all ${activeFarmerConvId === conv.id
                                                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800'
                                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                                        {conv.farmerName?.[0]}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{conv.farmerName}</span>
                                                            <span className="text-[10px] text-gray-400">{new Date(conv.startedAt).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.lastMessage}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Farmer Chat Area */}
                            <div className="flex-1 flex flex-col bg-theme-bg-card dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                                {activeFarmerConvId ? (
                                    <>
                                        {/* Chat Header */}
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/20">
                                                    {farmerConversations.find(c => c.id === activeFarmerConvId)?.farmerName?.[0]}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">
                                                        {farmerConversations.find(c => c.id === activeFarmerConvId)?.farmerName}
                                                    </h4>
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-secondary-500 rounded-full animate-pulse"></span>
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('chat_direct_chat')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                            {farmerChatMessages.map((msg, i) => (
                                                <div key={i} className={`flex ${msg.role === 'officer' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${msg.role === 'officer'
                                                        ? 'bg-primary-600 text-white rounded-tr-none'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                                                        }`}>
                                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                                        <span className={`text-[9px] mt-2 block ${msg.role === 'officer' ? 'text-primary-200' : 'text-gray-400'}`}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Input */}
                                        <form onSubmit={handleFarmerChatSend} className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700">
                                            <div className="relative flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    value={farmerChatInput}
                                                    onChange={(e) => setFarmerChatInput(e.target.value)}
                                                    placeholder={t('farmer_chat_placeholder')}
                                                    className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 transition-all dark:text-white"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!farmerChatInput.trim()}
                                                    className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50"
                                                >
                                                    <Send className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                                        <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4">
                                            <Users className="w-10 h-10" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('chat_select_conversation')}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 max-w-xs">{t('chat_connect_farmers')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                {/* Report Generation Overlay */}
                <AnimatePresence>
                    {isGeneratingReport && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`${themeName === 'cyber' ? 'glass-premium border border-primary-500/30' : 'bg-white dark:bg-gray-800'} p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6`}
                            >
                                <div className="relative w-24 h-24 mx-auto">
                                    <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <FileText className="w-10 h-10 text-primary-500" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className={`text-2xl font-black ${themeName === 'cyber' ? 'text-white text-glow' : 'text-gray-900 dark:text-white'}`}>
                                        {t('reports_generating_title') || 'Synthesizing Data'}
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                                        {t('reports_generating_desc') || 'Our AI is analyzing visit records, yield trends, and farmer interactions to generate your comprehensive report.'}
                                    </p>
                                </div>
                                <div className="flex gap-2 justify-center">
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></span>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Farmer Selection Modal - accessible from both AI Assistant and Farmer Chat */}
                {(activeTab === 'aiassistant' || activeTab === 'farmerchat') && showFarmerModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFarmerModal(false)} />
                        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white">{t('chat_start_new')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('chat_select_farmer')}</p>
                                </div>
                                <button onClick={() => setShowFarmerModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={t('common_search_farmers')}
                                        value={farmerSearchQuery}
                                        onChange={(e) => setFarmerSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="p-2 overflow-y-auto max-h-96">
                                {isLoadingFarmers ? (
                                    <div className="p-8 text-center text-gray-500">{t('chat_loading_farmers')}</div>
                                ) : farmerList.filter(f =>
                                    !farmerSearchQuery ||
                                    `${f.firstName} ${f.lastName}`.toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                    (f.region || '').toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                    (f.village || '').toLowerCase().includes(farmerSearchQuery.toLowerCase())
                                ).length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">{t('chat_no_farmers')}</div>
                                ) : (
                                    farmerList.filter(f =>
                                        !farmerSearchQuery ||
                                        `${f.firstName} ${f.lastName}`.toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                        (f.region || '').toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
                                        (f.village || '').toLowerCase().includes(farmerSearchQuery.toLowerCase())
                                    ).map((farmer) => (
                                        <button
                                            key={farmer.id}
                                            onClick={() => activeTab === 'farmerchat' ? handleStartConversation(farmer, 'farmer') : handleStartConversation(farmer, 'ai')}
                                            className="w-full p-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
                                        >
                                            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                                                {farmer.firstName?.[0]}{farmer.lastName?.[0]}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-gray-900 dark:text-white">
                                                    {farmer.firstName} {farmer.lastName}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {farmer.region}{farmer.village ? `, ${farmer.village}` : ''}
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
                    </div>
                </div>
            </main>

            {/* Visit Modal */}
            <VisitModal
                isOpen={showVisitModal}
                onClose={() => setShowVisitModal(false)}
                onSuccess={() => refetchVisits()}
            />

            {/* Farmer Detail Panel */}
            <FarmerDetailPanel
                isOpen={isDetailPanelOpen}
                onClose={() => setIsDetailPanelOpen(false)}
                farmer={selectedFarmer}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                visits={visits.filter((v: any) => selectedFarmer && (v.farmer_id === selectedFarmer.id || v.farmer_name === `${selectedFarmer.firstName} ${selectedFarmer.lastName}`))}
            />
            <NotificationPanel 
                isOpen={isNotificationPanelOpen} 
                onClose={() => setIsNotificationPanelOpen(false)} 
            />
        </div>
    );
}

export default App;
