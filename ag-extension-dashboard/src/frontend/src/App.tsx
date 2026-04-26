import React from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import ProtectedRoute from './components/ProtectedRoute';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FarmerMap from '@/components/FarmerMap';
import {
    LayoutDashboard,
    Layout,
    Layers,
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
    HelpCircle,
    Upload,
    Wifi,
    WifiOff,
    Download,
    Brain,
    Mail,
    Wrench,
    Leaf
} from 'lucide-react';
import { NotificationPanel } from './components/NotificationPanel';
import { ConfirmModal } from './components/ConfirmModal';
import { useEffect, useRef } from 'react';
import { WeatherWidget } from '@/components/WeatherWidget';
import { CardSkeleton } from '@/components/Skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '@/api/dashboardService';
import { askAI, searchKnowledge } from '@/api/knowledgeService';
import { fetchUserProfile, AuthResponse, ProfileResponse, logout as apiLogout } from '@/api/authService';
import { fetchFarmers, createFarmer, updateFarmers } from '@/api/farmerService';
import { fetchVisits, updateVisit } from '@/api/visitService';
import { fetchReports, generateReport, downloadReport, getReportContent, Report } from '@/api/reportService';
import { fetchPerformanceData } from '@/api/analyticsService';
import { fetchConversations, fetchMessages, sendMessage, createConversation, createAIConversation, updateConversation, deleteConversation } from '@/api/chatbotService';
import { sendBulkSMS } from '@/api/smsService';
import { fetchUnreadCount } from '@/api/notificationService';
import { getMyTransactions, fetchInvoices } from '@/api/billingService';

// Removed redundant import
import { uploadMultipleFiles } from '@/api/uploadService';
import { themes, getThemeCSS, applyTheme } from '@/theme';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import VisitModal from '@/components/forms/VisitModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { useDesignSystemMode } from '@/hooks/useDesignSystemMode';
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
// Duplicate removed
import { syncQueue } from '@/api/syncQueueService';
import AlphaAI from './components/Cyber/AlphaAI';
import { BreadcrumbNavigation } from '@/components/BreadcrumbNavigation';
import { ContextMenu } from '@/components/ContextMenu';
import { ShareModal } from '@/components/ShareModal';
import ProfileModal from '@/components/ProfileModal';
import SettingsPanel from '@/components/SettingsPanel';
import HelpCenterModal from '@/components/HelpCenterModal';
import { KnowledgeBase } from '@/components/KnowledgeBase';
import { BulkSmsModal } from './components/BulkSmsModal';
import { BulkUpdateModal } from './components/BulkUpdateModal';

// Import new pages
import Telemetry from './pages/Telemetry';
import Agents from './pages/Agents';
import SystemHealth from './pages/SystemHealth';
import { DiseaseDiagnosis as DiseaseDiagnosisPage } from './pages/DiseaseDiagnosis';
import Memory from './pages/Memory';
import EmailWorkflows from './pages/EmailWorkflows';
import MCPTools from './pages/MCPTools';

// A/B Test Imports
import { ABTestBanner, DesignToggle } from '@/components/ABTestBanner';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { SMSPage } from './pages/SMS';


// COLORS constant removed as it's unused

interface StatCardProps {
    title: string;
    value: number | string;
    change?: number;
    icon: React.ElementType;
    delay: number;
    cardClass?: string;
    headingClass?: string;
    dataClass?: string;
}

const StatCard = ({ title, value, change, icon: Icon, delay, cardClass, headingClass, dataClass }: StatCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 300, damping: 24 }}
            className={cardClass}
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-400/5 blur-3xl -mr-12 -mt-12 group-hover:bg-cyan-400/20 transition-all"></div>
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-cyan-400/10 rounded-lg text-cyan-400">
                    <Icon className="w-5 h-5" />
                </div>
                {change !== undefined && (
                    <span className={`text-xs font-bold ${change >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                        {change >= 0 ? '+' : ''}{change}%
                    </span>
                )}
            </div>
            <h3 className={`text-slate-500 dark:text-slate-400 font-headline uppercase mb-1 ${headingClass}`}>{title}</h3>
            <div className={`text-3xl font-headline ${dataClass}`}>
                {value !== undefined && value !== null ? value.toLocaleString() : '0'}
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

// Report type imported from @/api/reportService

interface DashboardData {
    overview: {
        totalFarmers: number;
        activeConversations: number;
        visitsThisMonth: number;
        avgSatisfaction: number;
        avgConversationsPerFarmer: number;
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
        notifications,
        contextMenu, hideContextMenu, 
        shareModal, hideShareModal, showShareModal, removeFarmer, removeFarmers,
        designSystemMode, toggleDesignSystemMode
    } = useAppStore();

    const {
        isModern,
        radiusClass,
        panelClass,
        headerOpacity,
        btnClass,
        headingClass,
        dataClass,
        cardClass
    } = useDesignSystemMode();

    // Logout handler
    const handleLogout = async () => {
        await apiLogout();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [showHelpCenter, setShowHelpCenter] = useState(false);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [showFarmerModal, setShowFarmerModal] = useState(false);
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);
    const [viewingReport, setViewingReport] = useState<Report | null>(null);
    const [isBulkSmsModalOpen, setIsBulkSmsModalOpen] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{

        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info' | 'success';
        confirmText?: string;
    } | null>(null);

    // Other UI states
    const [searchQuery, setSearchQuery] = useState('');
    const [weatherLocation, setWeatherLocation] = useState<string>(storeUser?.region || 'Nairobi, KE');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [globalSearchResults, setGlobalSearchResults] = useState<{ type: string; items: { id: string; label: string; sublabel?: string }[] }[]>([]);
    const [isGlobalSearching, setIsGlobalSearching] = useState(false);
    const [reportContent, setReportContent] = useState<string | null>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);
    const [showBulkSmsComposer, setShowBulkSmsComposer] = useState(false);
    const [bulkSmsMessage, setBulkSmsMessage] = useState('');
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
    const [apiUnreadCount, setApiUnreadCount] = useState(0);

    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedFarmers, setSelectedFarmers] = useState<Set<string>>(new Set());
    const [activeFarmerConvId, setActiveFarmerConvId] = useState<string | null>(null);
    const [farmerChatMessages, setFarmerChatMessages] = useState<ChatMessage[]>([]);
    const [farmerChatInput, setFarmerChatInput] = useState('');
    const [farmerSearchQuery, setFarmerSearchQuery] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [farmerConversations, setFarmerConversations] = useState<Conversation[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [editingConvId, setEditingConvId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState<string>('');
    const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    // Store aliases
    const farmers = storeFarmers;

    // Offline sync queue
    useEffect(() => {
        const unsubscribe = syncQueue.onCountChange(setPendingSyncCount);
        setPendingSyncCount(syncQueue.getPendingCount());
        return unsubscribe;
    }, []);

    // Online/offline detection with sync queue
    useEffect(() => {
        const handleOnline = async () => {
            setIsOnline(true);
            const count = syncQueue.getPendingCount();
            if (count > 0) {
                addNotification({
                    type: 'success',
                    message: `Back online - syncing ${count} queued action(s)...`
                });
                const result = await syncQueue.processQueue();
                if (result.failed > 0) {
                    addNotification({
                        type: 'warning',
                        message: `${result.success} synced, ${result.failed} failed (will retry)`
                    });
                } else if (result.success > 0) {
                    addNotification({
                        type: 'success',
                        message: `All ${result.success} queued action(s) synced successfully`
                    });
                }
            } else {
                addNotification({
                    type: 'success',
                    message: 'Back online'
                });
            }
        };
        const handleOffline = () => {
            setIsOnline(false);
            addNotification({
                type: 'warning',
                message: 'You are offline - changes will be queued and synced when connection returns'
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            try {
                await uploadMultipleFiles(files);
                addNotification({
                    type: 'success',
                    message: `${files.length} file(s) uploaded and processed successfully.`
                });
            } catch (error) {
                console.error('Upload error:', error);
                addNotification({
                    type: 'error',
                    message: 'An error occurred during file upload.'
                });
            }
        }
    };

    // Apply theme when it changes
    useEffect(() => {
        applyTheme(themeName);
        localStorage.setItem('ag-theme-name', themeName);
    }, [themeName]);


    const handleMenuAction = (action: string, entityId?: string) => {
        if (action.startsWith('share_')) {
            const type = action.split('_')[1];
            const entity = type === 'farmer' ? storeFarmers?.find(f => f.id === entityId) : null;
            showShareModal({
                entityType: type,
                entityId: entityId || '',
                entityName: entity ? `${entity.firstName} ${entity.lastName}` : undefined
            });
        } else if (action === 'schedule_visit') {
            setShowVisitModal(true);
        } else if (action === 'export_farmer' || action.startsWith('export_')) {
            // Trigger export logic
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
                    a.href = url;
                    a.download = `farmer_${entityId}_export.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    addNotification({ type: 'success', message: 'Farmer data exported successfully' });
                }
            }
        } else if (action.includes('delete')) {
            setConfirmModal({
                title: 'Confirm Action',
                message: `Are you sure you want to perform this action: ${action}?`,
                variant: 'danger',
                confirmText: 'Delete',
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

    // Keyboard shortcuts (registered after all state declarations)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                if (searchInput) {
                    searchInput.focus();
                    setShowGlobalSearch(true);
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                setSidebarOpen(!sidebarOpen);
            }
            if (e.key === 'Escape') {
                if (isNotificationPanelOpen) setIsNotificationPanelOpen(false);
                else if (isProfileMenuOpen) setIsProfileMenuOpen(false);
                else if (showProfileModal) setShowProfileModal(false);
                else if (showSettingsPanel) setShowSettingsPanel(false);
                else if (showHelpCenter) setShowHelpCenter(false);
                else if (isDetailPanelOpen) setIsDetailPanelOpen(false);
                else if (showVisitModal) setShowVisitModal(false);
                else if (showFarmerModal) setShowFarmerModal(false);
                else if (showGlobalSearch) setShowGlobalSearch(false);
                else if (viewingReport) setViewingReport(null);
                else if (isBulkSmsModalOpen) setIsBulkSmsModalOpen(false);
                else if (confirmModal) setConfirmModal(null);
            }

        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isNotificationPanelOpen, isProfileMenuOpen, showProfileModal, showSettingsPanel, showHelpCenter, isDetailPanelOpen, showVisitModal, showFarmerModal, showGlobalSearch, viewingReport, showBulkSmsComposer, confirmModal]);

    // Fetch unread notification count
    useEffect(() => {
        if (!storeUser || !localStorage.getItem('token')) return;
        const loadUnreadCount = async () => {
            try {
                const count = await fetchUnreadCount();
                setApiUnreadCount(count);
            } catch (error) {
                // Fallback to store count
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

    // Bulk Actions
    const handleSelectFarmer = (farmerId: string, checked: boolean) => {
        const newSelected = new Set(selectedFarmers);
        if (checked) {
            newSelected.add(farmerId);
        } else {
            newSelected.delete(farmerId);
        }
        setSelectedFarmers(newSelected);
    };

    const handleSelectAllFarmers = (checked: boolean) => {
        if (checked && farmers) {
            setSelectedFarmers(new Set(farmers.map(f => f.id)));
        } else {
            setSelectedFarmers(new Set());
        }
    };

    const handleBulkSMS = () => {
        if (selectedFarmers.size > 0) {
            setIsBulkSmsModalOpen(true);
        }
    };

    const onBulkSmsSend = async (message: string) => {
        const selectedFarmersList = effectiveFarmers?.filter(f => selectedFarmers.has(f.id)) || [];
        if (selectedFarmersList.length > 0) {
            setIsSendingBulkSms(true);
            try {
                await sendBulkSMS({
                    recipients: selectedFarmersList.map(f => f.phone).filter(Boolean) as string[],
                    message
                });
                setActiveTab('sms');
                setSelectedFarmers(new Set());
                setIsBulkSmsModalOpen(false);
                addNotification({
                    type: 'success',
                    message: `Bulk SMS sent to ${selectedFarmersList.length} farmers.`
                });
            } catch (error) {
                console.error('Bulk SMS error:', error);
                addNotification({
                    type: 'error',
                    message: 'Error connecting to SMS service.'
                });
            } finally {
                setIsSendingBulkSms(false);
            }
        }
    };


    const handleBulkDelete = async () => {
        const ids = Array.from(selectedFarmers);
        if (ids.length === 0) return;

        setConfirmModal({
            title: 'Delete Farmers',
            message: `Are you sure you want to delete ${ids.length} farmers? This action cannot be undone.`,
            variant: 'danger',
            confirmText: 'Delete All',
            onConfirm: async () => {
                setConfirmModal(null);
                const farmersToRestore = effectiveFarmers?.filter(f => selectedFarmers.has(f.id)) || [];

                try {
                    await removeFarmers(ids);
                    setSelectedFarmers(new Set());

                    addNotification({
                        type: 'success',
                        message: `Deleted ${ids.length} farmers.`,
                        actionLabel: 'Undo',
                        onAction: async () => {
                            for (const farmer of farmersToRestore) {
                                await createFarmer(farmer);
                            }
                            const refreshed = await fetchFarmers();
                            setFarmerList(refreshed.data.farmers || []);
                            setSelectedFarmers(new Set());
                        }
                    });
                } catch (error) {
                    console.error('Bulk delete error:', error);
                    addNotification({
                        type: 'error',
                        message: 'Failed to delete some farmers.'
                    });
                }
            }
        });
    };

    const onBulkUpdateFarmers = async (updates: any) => {
        const ids = Array.from(selectedFarmers);
        if (ids.length > 0) {
            setIsUpdatingBulk(true);
            try {
                await updateFarmers(ids, updates);
                setSelectedFarmers(new Set());
                setIsBulkUpdateModalOpen(false);
                addNotification({
                    type: 'success',
                    message: `Bulk update applied to ${ids.length} farmers.`
                });
            } catch (error) {
                console.error('Bulk update error:', error);
                addNotification({
                    type: 'error',
                    message: 'Error applying bulk update.'
                });
            } finally {
                setIsUpdatingBulk(false);
            }
        }
    };

    const handleBulkExport = () => {
        const selectedFarmersList = effectiveFarmers?.filter(f => selectedFarmers.has(f.id)) || [];
        if (selectedFarmersList.length > 0) {
            // Create CSV export
            const csvContent = [
                ['Name', 'Phone', 'Region', 'Village', 'Crops', 'Farm Size (ha)'],
                ...selectedFarmersList.map(f => [
                    `${f.firstName} ${f.lastName}`,
                    f.phone || '',
                    f.region || '',
                    f.village || '',
                    f.crops?.join(', ') || '',
                    f.farmSize?.toString() || ''
                ])
            ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `farmers_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            setSelectedFarmers(new Set());

            addNotification({
                type: 'success',
                message: `Exported ${selectedFarmersList.length} farmers to CSV`
            });
        }
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
                        setWeatherLocation(location + (country ? `, ${country}` : ''));
                    } catch {
                        setWeatherLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
                    }
                },
                (error) => {
                    if (error.code === 1 && error.message.includes('Only secure origins are allowed')) {
                        // Geolocation blocked by browser policy — use fallback silently
                    } else if (error.code === 1) {
                        // Permission denied — use fallback silently
                    } else {
                        // Geolocation unavailable — use fallback
                    }
                    setWeatherLocation(storeUser?.region || 'Kenya');
                }
            );
        } else {
            setWeatherLocation(storeUser?.region || 'Kenya');
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

    const hasToken = !!localStorage.getItem('token');

    const { data: userResponse, error: userError } = useQuery<ProfileResponse>({
        queryKey: ['user-profile'],
        queryFn: fetchUserProfile,
        enabled: !!storeUser && hasToken
    });

    // Clear invalid user session only on 401 (unauthorized) errors
    useEffect(() => {
        if (userError && storeUser) {
            const error = userError as any;
            const status = error?.response?.status;
            if (status === 401) {
                setUser(null);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
    }, [userError, storeUser, setUser]);

    // Handle the custom auth-unauthorized event from the API client
    useEffect(() => {
        const handleUnauthorized = () => {
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        };
        window.addEventListener('auth-unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
    }, [setUser]);

    const user = userResponse?.data;
    const isOfficer = user?.role === 'extension_officer';

    // Fetch Dashboard Data
    const { data: dashboardResponse, isLoading, isError } = useQuery<any>({
        queryKey: ['dashboard'],
        queryFn: fetchDashboardData,
        enabled: activeTab === 'dashboard' && !!user
    });

    const dashboardData = dashboardResponse?.data;

    // Fetch Farmers Data (Portfolio)
    const { data: farmersResponse } = useQuery<{ success: boolean; data: { farmers: Farmer[] } }>({
        queryKey: ['farmers'],
        queryFn: fetchFarmers,
        enabled: (activeTab === 'portfolio' || activeTab === 'dashboard') && !!user
    });
    const queryFarmers = farmersResponse?.data?.farmers || [];
    const effectiveFarmers = queryFarmers.length > 0 ? queryFarmers : storeFarmers;

    // Fetch Visits Data
    const { data: visitsResponse, refetch: refetchVisits } = useQuery<{ success: boolean; data: { visits: Visit[] } }>({
        queryKey: ['visits'],
        queryFn: fetchVisits,
        enabled: activeTab === 'visits' && !!user
    });
    const visits = visitsResponse?.data?.visits || [];

    // Fetch Reports Data
    const { data: reportsResponse, refetch: refetchReports } = useQuery<{ success: boolean; data: { reports: Report[] } }>({
        queryKey: ['reports'],
        queryFn: fetchReports,
        enabled: activeTab === 'reports' && !!user
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reports = (reportsResponse as any)?.data?.reports || [];

    // Fetch Analytics/Performance Data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: performanceResponse } = useQuery<{ success: boolean; data: any }>({
        queryKey: ['performance'],
        queryFn: fetchPerformanceData,
        enabled: (activeTab === 'analytics' || activeTab === 'dashboard') && !!user
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const performanceData = (performanceResponse as any)?.data;

    // Fetch Billing Transactions
    const { data: transactionsResponse } = useQuery<{ success: boolean; data: any[] }>({
        queryKey: ['transactions'],
        queryFn: getMyTransactions,
        enabled: (activeTab === 'billing' || showGlobalSearch) && !!user
    });
    const transactions = transactionsResponse?.data || [];


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
        // Advanced/Technical Pages (Admin only)
        { id: 'telemetry', label: 'Agent Telemetry', icon: Activity, roles: ['admin'] },
        { id: 'agents', label: 'Agent Orchestration', icon: Settings, roles: ['admin'] },
        { id: 'system_health', label: 'System Health', icon: Shield, roles: ['admin'] },
        { id: 'disease_diagnosis', label: 'Disease Diagnosis', icon: Leaf, roles: ['extension_officer', 'admin'] },
        { id: 'memory', label: 'Memory Manager', icon: Brain, roles: ['admin'] },
        { id: 'email_workflows', label: 'Email Workflows', icon: Mail, roles: ['admin'] },
        { id: 'mcp_tools', label: 'MCP Tools', icon: Wrench, roles: ['admin'] },
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

    // Global search handler — searches farmers, knowledge, visits
    const handleGlobalSearch = async (query: string) => {
        if (!query.trim()) {
            setGlobalSearchResults([]);
            setShowGlobalSearch(false);
            return;
        }
        setIsGlobalSearching(true);
        setShowGlobalSearch(true);
        const results: { type: string; items: { id: string; label: string; sublabel?: string }[] }[] = [];
        try {
            // Search farmers
            const matchedFarmers = (farmers || []).filter((f: Farmer) =>
                `${f.firstName} ${f.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
                (f.region || '').toLowerCase().includes(query.toLowerCase()) ||
                (f.phone || '').includes(query)
            ).slice(0, 5);
            if (matchedFarmers.length > 0) {
                results.push({
                    type: 'Farmers',
                    items: matchedFarmers.map((f: Farmer) => ({
                        id: f.id,
                        label: `${f.firstName} ${f.lastName}`,
                        sublabel: f.region || f.village || '',
                    }))
                });
            }
            // Search knowledge
            try {
                const knowledgeResults = await searchKnowledge(query);
                if (knowledgeResults.success && knowledgeResults.data?.articles?.length > 0) {
                    results.push({
                        type: 'Knowledge',
                        items: knowledgeResults.data.articles.slice(0, 3).map((a: { id: string; title: string; category?: string }) => ({
                            id: a.id,
                            label: a.title,
                            sublabel: a.category || '',
                        }))
                    });
                }
            } catch { /* knowledge search optional */ }
            // Search visits
            const matchedVisits = (visits || []).filter((v: Visit) =>
                v.farmer_name?.toLowerCase().includes(query.toLowerCase()) ||
                v.visit_type?.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 3);
            if (matchedVisits.length > 0) {
                results.push({
                    type: 'Visits',
                    items: matchedVisits.map((v: Visit) => ({
                        id: v.id,
                        label: `${v.farmer_name} — ${v.visit_type}`,
                        sublabel: new Date(v.scheduled_at).toLocaleDateString(),
                    }))
                });
            }
            // Search Reports
            const matchedReports = (reports || []).filter((r: Report) => 
                r.title?.toLowerCase().includes(query.toLowerCase()) ||
                r.type?.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 3);
            if (matchedReports.length > 0) {
                results.push({
                    type: 'Reports',
                    items: matchedReports.map((r: Report) => ({
                        id: r.id,
                        label: r.title,
                        sublabel: `Generated ${new Date(r.generatedAt).toLocaleDateString()}`
                    }))
                });
            }
            // Search Transactions
            const matchedTransactions = (transactions || []).filter((tx: any) => 
                tx.transactionId?.toLowerCase().includes(query.toLowerCase()) ||
                tx.status?.toLowerCase().includes(query.toLowerCase()) ||
                tx.method?.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 3);
            if (matchedTransactions.length > 0) {
                results.push({
                    type: 'Billing',
                    items: matchedTransactions.map((tx: any) => ({
                        id: tx.id,
                        label: `TX: ${tx.transactionId}`,
                        sublabel: `${tx.amount} ${tx.currency} • ${tx.status}`
                    }))
                });
            }

        } finally {
            setGlobalSearchResults(results);
            setIsGlobalSearching(false);
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
            const res = await updateConversation(id, { title });
            if (res.success) {
                setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
                setEditingConvId(null);
            }
        } catch (error) {
            console.error('Failed to update conversation:', error);
        }
    };

    const handleDeleteConversation = async (id: string) => {
        try {
            const res = await deleteConversation(id);
            if (res.success) {
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
        if (!user) return;
        if (activeTab === 'aiassistant') {
            loadConversations();
        }
        if (activeTab === 'farmerchat') {
            loadFarmerConversations();
        }
    }, [activeTab, loadConversations, loadFarmerConversations, user]);

    useEffect(() => {
        if (!user) return;
        if (activeConvId) {
            loadMessages(activeConvId);
        }
    }, [activeConvId, loadMessages, user]);

    if (user && isError) return <div className="flex items-center justify-center min-h-screen text-red-500 bg-gray-50 dark:bg-gray-900">{t('error_loading')}</div>;

    const ThemeToggle = () => (
        <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/50 hover:bg-white/10 transition-all text-slate-400 hover:text-cyan-400 backdrop-blur-sm"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
    );

    // Generate breadcrumb items based on current tab
    const getBreadcrumbItems = () => {
        const items = [
            { label: t('nav_dashboard'), onClick: () => {
                setActiveTab('dashboard');
                setIsDetailPanelOpen(false);
            }}
        ];

        if (activeTab !== 'dashboard') {
            const currentNavItem = allNavItems.find(item => item.id === activeTab);
            if (currentNavItem) {
                items.push({
                    label: currentNavItem.label,
                    onClick: () => {
                        setActiveTab(activeTab);
                        setIsDetailPanelOpen(false);
                    }
                });
            }
        }

        if (isDetailPanelOpen && selectedFarmer) {
            items.push({
                label: `${selectedFarmer.firstName} ${selectedFarmer.lastName}`,
                onClick: () => setIsDetailPanelOpen(true)
            });
        }

        return items;
    };

    // Public routes - accessible without authentication
    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="*" element={<Login />} />
                </Routes>
            </div>
        );
    }

    return (
        <div
            className={`h-screen flex flex-col ${darkMode ? 'dark' : ''} bg-theme-bg-primary transition-colors duration-300 overflow-hidden relative z-0`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Ambient Aurora Glass Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 hidden dark:block">
                <motion.div
                    animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[10%] -left-[10%] w-[800px] h-[800px] bg-blue-600/30 mix-blend-screen rounded-full blur-[150px]"
                />
                <motion.div
                    animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-purple-600/30 mix-blend-screen rounded-full blur-[180px]"
                />
                <motion.div
                    animate={{ x: [0, 50, 0], y: [0, 100, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-green-500/20 mix-blend-screen rounded-full blur-[150px]"
                />
            </div>
            {isDragOver && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md border-8 border-dashed border-primary-500 flex items-center justify-center transition-all animate-in fade-in duration-200 pointer-events-none">
                    <div className="text-center bg-white/10 dark:bg-black/20 p-12 rounded-3xl backdrop-blur-lg border border-white/20 shadow-2xl">
                        <Upload className="w-24 h-24 text-primary-400 mx-auto mb-6 animate-bounce" />
                        <h2 className="text-4xl font-black text-white tracking-tight mb-2">Drop Files to Upload</h2>
                        <p className="text-lg text-primary-200 font-medium">Release to process CSV, PDF, or Image files</p>
                    </div>
                </div>
            )}
            {/* Top Navigation - Cinematic Glass Header */}
            <header className={`fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 ${headerOpacity} backdrop-blur-xl border-b border-gray-200 dark:border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.1)]`}>
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-lg hover:bg-white/5 transition-all text-gray-400"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <span className={`text-2xl font-headline ${headingClass}`}>AG-extension</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-1">
                        <button onClick={() => setActiveTab('dashboard')} className={`font-headline tracking-tight transition-all px-4 py-2 ${btnClass} ${activeTab === 'dashboard' ? (isModern ? 'text-cyan-400 font-black' : 'bg-slate-900 text-white') : 'text-slate-500'}`}>
                            {isModern ? 'Strategic Intelligence' : 'Operations Dashboard'}
                        </button>
                        <button onClick={() => setActiveTab('analytics')} className={`font-headline tracking-tight transition-all px-4 py-2 ${btnClass} ${activeTab === 'analytics' ? (isModern ? 'text-cyan-400 font-black' : 'bg-slate-900 text-white') : 'text-slate-500'}`}>
                            {isModern ? 'Growth Optimization' : 'System Analytics'}
                        </button>
                        <button onClick={() => setActiveTab('reports')} className={`font-headline tracking-tight transition-all px-4 py-2 ${btnClass} ${activeTab === 'reports' ? (isModern ? 'text-cyan-400 font-black' : 'bg-slate-900 text-white') : 'text-slate-500'}`}>
                            {isModern ? 'Executive Reporting' : 'Data Reports'}
                        </button>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search system or location..."
                            className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-cyan-400 outline-none w-64 transition-all text-gray-900 dark:text-white"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                handleGlobalSearch(e.target.value);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchQuery.trim() && globalSearchResults.length === 0) {
                                    setWeatherLocation(searchQuery);
                                    addNotification({
                                        message: `Weather now showing for ${searchQuery}`,
                                        type: 'info'
                                    });
                                    setSearchQuery('');
                                    setShowGlobalSearch(false);
                                }
                            }}
                            onFocus={() => { if (searchQuery.trim()) setShowGlobalSearch(true); }}
                            onBlur={() => { setTimeout(() => setShowGlobalSearch(false), 200); }}
                        />
                        {showGlobalSearch && globalSearchResults.length > 0 && (
                            <div className="absolute top-full mt-2 left-0 right-0 glass-panel rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                                {isGlobalSearching ? (
                                    <div className="p-4 text-center text-sm text-gray-500">
                                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Searching...
                                    </div>
                                ) : (
                                    globalSearchResults.map((group) => (
                                        <div key={group.type}>
                                            <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group.type}</div>
                                            {group.items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3"
                                                    onClick={() => {
                                                        if (group.type === 'Farmers') {
                                                            const farmer = farmers?.find((f: Farmer) => f.id === item.id);
                                                            if (farmer) handleOpenFarmerDetail(farmer);
                                                        } else if (group.type === 'Visits') {
                                                            setActiveTab('visits');
                                                        } else {
                                                            setActiveTab('knowledge');
                                                            setSearchQuery(item.label);
                                                        }
                                                        setShowGlobalSearch(false);
                                                    }}
                                                >
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.label}</p>
                                                        {item.sublabel && <p className="text-xs text-slate-500 truncate">{item.sublabel}</p>}
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                                </button>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Weather & Location */}
                    <div className="hidden xl:block ml-2">
                        <WeatherWidget location={weatherLocation} />
                    </div>

                    <div className="flex items-center gap-3 border-r border-gray-200 dark:border-white/10 pr-4">
                        <div className="hidden lg:flex items-center gap-2 scale-90 origin-right">
                            <button 
                                onClick={toggleDesignSystemMode}
                                className={`flex items-center gap-2 px-3 py-1.5 ${btnClass} text-[10px] font-bold uppercase tracking-widest transition-all ${isModern ? 'bg-cyan-500/10 text-cyan-400' : 'bg-gray-100 dark:bg-white/5 text-gray-500'}`}
                                title="Toggle Design Aesthetic"
                            >
                                <Layout className="w-3.5 h-3.5" />
                                {isModern ? 'Modern' : 'Classic'}
                            </button>
                            <LanguageSwitcher compact />
                            <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
                        </div>
                        <ThemeToggle />
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsNotificationPanelOpen(true)} className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/5 relative">
                            <Bell className="w-5 h-5" />
                            {apiUnreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                            )}
                        </button>
                        <button onClick={() => setShowSettingsPanel(true)} className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-white/5">
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            className="flex items-center gap-3 pl-4 border-l border-white/10 hover:opacity-80 transition-opacity"
                        >
                            <div className="w-8 h-8 rounded-full border border-cyan-400/30 overflow-hidden ring-2 ring-cyan-400/10 flex items-center justify-center bg-slate-800">
                                <span className="text-[10px] text-cyan-400 font-bold">{storeUser?.firstName?.[0]}{storeUser?.lastName?.[0]}</span>
                            </div>
                            <div className="hidden xl:block text-left">
                                <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">
                                    {storeUser?.firstName} {storeUser?.lastName}
                                </p>
                            </div>
                        </button>

                        <AnimatePresence>
                            {isProfileMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-2xl p-2 z-50"
                                    >
                                        <div className="p-3 mb-2 border-b border-white/10">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Account Info</p>
                                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{storeUser?.email}</p>
                                        </div>

                                        <button onClick={() => { setIsProfileMenuOpen(false); setShowProfileModal(true); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300">
                                            <User className="w-4 h-4 text-cyan-400" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Profile</span>
                                        </button>
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-400">
                                            <LogOut className="w-4 h-4" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Sign Out</span>
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* Application Body */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0, x: -20 }}
                        animate={{ width: 256, opacity: 1, x: 0 }}
                        exit={{ width: 0, opacity: 0, x: -20 }}
                        className={`fixed left-0 top-0 h-full flex flex-col pt-20 pb-8 px-4 ${isModern ? 'bg-white/70 dark:bg-slate-950/40 backdrop-blur-2xl' : 'bg-white dark:bg-slate-900 shadow-xl'} border-r border-gray-200 dark:border-white/10 w-64 z-40`}
                    >
                        <div className="px-4 mb-8">
                            <h3 className="font-headline text-cyan-400 text-sm tracking-widest uppercase mb-1">Ag-Extension</h3>
                            <p className="text-[10px] text-slate-500 font-medium">{storeUser?.region || 'Sector 7G - Midwest'}</p>
                        </div>

                        <nav className="flex flex-col gap-2 grow overflow-y-auto custom-scrollbar pr-2">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`flex items-center gap-3 px-4 py-3 ${btnClass} transition-all duration-200 text-left ${activeTab === item.id
                                        ? 'bg-cyan-600/10 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-r-2 border-cyan-600 dark:border-cyan-400 shadow-[inset_0_0_15px_rgba(0,245,255,0.1)]'
                                        : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5 hover:text-cyan-600 dark:hover:text-cyan-200'
                                        }`}
                                >
                                    <item.icon className="w-4 h-4 flex-shrink-0" />
                                    <span className="font-headline font-bold uppercase tracking-widest text-[10px]">{item.label}</span>
                                </button>
                            ))}
                        </nav>

                        <div className="mt-auto flex flex-col gap-2 pt-6 border-t border-white/5">
                            <button
                                onClick={() => setIsGeneratingReport(true)}
                                className={`bg-cyan-500 text-white px-4 py-3 ${btnClass} flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all`}
                            >
                                <FileText className="w-3 h-3" />
                                <span className={headingClass}>Generate Report</span>
                            </button>
                            <button
                                onClick={() => setShowHelpCenter(true)}
                                className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-slate-200 text-[10px] uppercase font-bold tracking-widest"
                            >
                                <HelpCircle className="w-3 h-3" />
                                Support
                            </button>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

                {/* Content Area */}
                <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : ''} pt-16 h-full`}>
                    
                    {/* Main Content Scrollable */}
                    <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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

                    {activeTab === 'sms' && (
                        <ErrorBoundary>
                            <SMSPage />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'dashboard' && (
                        <ErrorBoundary>
                            <div className='mb-12'>
                                <h1 className={`text-5xl font-black tracking-tighter font-headline mb-2 drop-shadow-[0_0_15px_rgba(0,245,255,0.1)] dark:drop-shadow-[0_0_15px_rgba(0,245,255,0.3)] ${headingClass}`}>
                                    {isModern ? 'Global Operations Command' : 'Dashboard Overview'}
                                </h1>
                                <p className='text-slate-400 font-headline font-medium text-lg'>
                                    {t('dashboard_welcome').replace('{name}', user?.firstName || 'Extension Officer')}
                                </p>
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
                                        <StatCard
                                            title={isOfficer ? "My Farmers" : t('stat_total_farmers')}
                                            value={dashboardData.overview.totalFarmers}
                                            change={dashboardData.trends.farmersGrowth}
                                            icon={Users}
                                            delay={0}
                                            cardClass={cardClass}
                                            headingClass={headingClass}
                                            dataClass={dataClass}
                                        />
                                        <StatCard
                                            title={isOfficer ? "My Active Chats" : t('stat_active_conversations')}
                                            value={dashboardData.overview.activeConversations}
                                            change={dashboardData.trends.conversationsGrowth}
                                            icon={MessageSquare}
                                            delay={0.05}
                                            cardClass={cardClass}
                                            headingClass={headingClass}
                                            dataClass={dataClass}
                                        />
                                        <StatCard
                                            title={isOfficer ? "My Visits (30d)" : t('stat_visits_this_month')}
                                            value={dashboardData.overview.visitsThisMonth}
                                            change={dashboardData.trends.visitsGrowth}
                                            icon={MapPin}
                                            delay={0.1}
                                            cardClass={cardClass}
                                            headingClass={headingClass}
                                            dataClass={dataClass}
                                        />
                                        <StatCard
                                            title={isOfficer ? "Avg. Conversations" : t('stat_avg_satisfaction')}
                                            value={isOfficer ? dashboardData.overview.avgConversationsPerFarmer : `${dashboardData.overview.avgSatisfaction}/5`}
                                            change={isOfficer ? undefined : dashboardData.trends.satisfactionChange}
                                            icon={isOfficer ? MessageSquare : Sparkles}
                                            delay={0.15}
                                            cardClass={cardClass}
                                            headingClass={headingClass}
                                            dataClass={dataClass}
                                        />
                                    </>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                <div className={`lg:col-span-2 ${cardClass} group`}>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <MapPin className="w-5 h-5 text-cyan-400" />
                                            {t('stat_regional_distribution')}
                                        </h3>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 bg-cyan-400/10 text-cyan-400 rounded text-[10px] font-bold uppercase tracking-widest border border-cyan-400/20">
                                                {t('stat_kenya_overview') || "Kenya Overview"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="relative h-[400px] bg-slate-950/50 rounded-lg overflow-hidden border border-white/5 shadow-inner">
                                        <FarmerMap
                                            height="400px"
                                            isExternalExpanded={isMapExpanded}
                                            onToggleExpand={setIsMapExpanded}
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            farmers={effectiveFarmers.map((f: any) => ({
                                                id: f.id,
                                                name: f.name || `${f.firstName} ${f.lastName}`,
                                                lat: f.latitude || f.lat || -1.2863,
                                                lng: f.longitude || f.lng || 36.8172,
                                                crop: f.crops?.[0] || f.crop || 'Maize',
                                                region: f.region || f.location || 'Unknown',
                                                size: f.farmSize || f.size || 0,
                                                phone: f.phone,
                                                yield: f.yield || 0,
                                                createdAt: f.createdAt || f.created_at
                                            }))}
                                            onFarmerClick={(farmerData) => {
                                                if (user?.role === 'extension_officer' || user?.role === 'admin') {
                                                    setActiveTab('farmerchat');
                                                    // Map FarmerData back to Farmer for the conversation handler
                                                    const farmer = effectiveFarmers.find(f => f.id === farmerData.id) as Farmer;
                                                    if (farmer) handleStartConversation(farmer, 'farmer');
                                                } else {
                                                    const farmer = effectiveFarmers.find(f => f.id === farmerData.id) as Farmer;
                                                    if (farmer) handleOpenFarmerDetail(farmer);
                                                }
                                            }}
                                        />

                                        {!isMapExpanded && (
                                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10">
                                                <div className="flex gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t('table_active')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t('analytics_disease_alerts')}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setIsMapExpanded(true)}
                                                    className="text-[10px] font-black text-cyan-400 uppercase bg-cyan-400/10 px-3 py-1 rounded-lg border border-cyan-400/20 hover:bg-cyan-400/20 transition-colors"
                                                >
                                                    {t('viz_detail_view')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className={`${cardClass} p-8`}>
                                        <h3 className="text-lg font-headline font-bold text-gray-900 dark:text-white mb-6">{t('analytics_support_efficiency')}</h3>
                                        {performanceData ? (
                                        <div className="space-y-6">
                                            {[
                                                { name: t('analytics_resolution_rate'), progress: performanceData?.metrics?.resolutionRate ?? 0, color: 'bg-cyan-400' },
                                                { name: t('analytics_satisfaction_score'), progress: performanceData?.metrics?.satisfactionScore ? performanceData.metrics.satisfactionScore * 20 : 0, color: 'bg-purple-500' },
                                            ].map((item, i) => (
                                                <div key={i} className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-bold text-slate-300">{item.name}</span>
                                                        <span className="text-xs font-black text-cyan-400">{Math.round(item.progress)}%</span>
                                                    </div>
                                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${item.progress}%` }}
                                                            transition={{ duration: 1, delay: i * 0.1 }}
                                                            className={`h-full ${item.color} rounded-full shadow-[0_0_10px_rgba(0,245,255,0.3)]`}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        ) : (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                                            </div>
                                        )}
                                    </div>

                                    <div className={cardClass}>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                                            <h3 className="text-sm font-headline font-bold text-gray-900 dark:text-white uppercase tracking-widest">Active Pulse</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Sensor Node 04', status: 'Optimal', time: '2m ago' },
                                                { label: 'Drone Survey', status: 'In Progress', time: 'Active' },
                                                { label: 'Satellite Sync', status: 'Complete', time: '1h ago' }
                                            ].map((item, i) => (
                                                <div key={i} className="flex justify-between items-center border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">{item.label}</p>
                                                        <p className="text-[10px] text-slate-500">{item.time}</p>
                                                    </div>
                                                    <span className="text-[10px] font-black text-cyan-400 uppercase">{item.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ErrorBoundary>
                    )}
                    {activeTab === 'portfolio' && (
                        <div>
                            <div className="mb-8">
                                <h1 className={`text-3xl ${headingClass}`}>{t('portfolio_title')}</h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('portfolio_subtitle')}</p>
                            </div>
                            {/* Bulk Actions Bar */}
                            {selectedFarmers.size > 0 && (
                                <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-5 h-5 text-primary-600" />
                                                <span className="font-bold text-primary-800 dark:text-primary-200">
                                                    {selectedFarmers.size} farmer{selectedFarmers.size !== 1 ? 's' : ''} selected
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowBulkSmsComposer(!showBulkSmsComposer)}
                                                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <Send className="w-4 h-4" />
                                                Send SMS
                                            </button>
                                            <button
                                                onClick={handleBulkExport}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <FileText className="w-4 h-4" />
                                                Export CSV
                                            </button>
                                            <button
                                                onClick={handleBulkDelete}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                            <button
                                                onClick={() => setSelectedFarmers(new Set())}
                                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-lg transition-colors"
                                            >
                                                Clear Selection
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showBulkSmsComposer && selectedFarmers.size > 0 && (
                                <div className="mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                            Compose SMS for {selectedFarmers.size} farmer{selectedFarmers.size !== 1 ? 's' : ''}
                                        </h4>
                                        <button onClick={() => setShowBulkSmsComposer(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                            <X className="w-4 h-4 text-gray-400" />
                                        </button>
                                    </div>
                                    <textarea
                                        value={bulkSmsMessage}
                                        onChange={(e) => setBulkSmsMessage(e.target.value)}
                                        placeholder="Type your message here... (leave empty for default message)"
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                                    />
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="text-xs text-gray-400">{bulkSmsMessage.length}/160 characters</span>
                                        <button
                                            onClick={handleBulkSMS}
                                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                                        >
                                            <Send className="w-4 h-4" />
                                            Send to {selectedFarmers.size} farmer{selectedFarmers.size !== 1 ? 's' : ''}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-2">
                                <AnimatePresence>
                                    {effectiveFarmers.map((farmer: Farmer, idx: number) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                            transition={{ duration: 0.4, type: "spring", bounce: 0.3, delay: Math.min(idx * 0.05, 0.5) }}
                                            key={farmer.id}
                                            className="card glass p-6 hover:shadow-2xl transition-all duration-300 relative group flex flex-col justify-between"
                                            onClick={() => handleOpenFarmerDetail(farmer)}
                                        >
                                            {/* Top Section: Avatar and Select Checkbox */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-blue-500 shadow-lg shadow-primary-500/20 flex flex-shrink-0 items-center justify-center text-white font-black text-lg">
                                                        {farmer.firstName?.[0]}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate">{farmer.firstName} {farmer.lastName}</h3>
                                                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">#{farmer.id.slice(0, 8)}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFarmers.has(farmer.id)}
                                                        onChange={(e) => handleSelectFarmer(farmer.id, e.target.checked)}
                                                        className="w-5 h-5 rounded-md border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            {/* Middle Section: Details */}
                                            <div className="flex-1 space-y-4 my-2">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('table_region_village')}</p>
                                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{farmer.region}</p>
                                                        <p className="text-xs text-gray-500 truncate">{farmer.village}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{t('table_farm_size')}</p>
                                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{farmer.farmSize} <span className="text-xs text-gray-500 font-medium tracking-normal">ha</span></p>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                                                    {farmer.crops?.map((crop: string) => (
                                                        <span key={crop} className="px-2.5 py-1 bg-gray-100/50 dark:bg-gray-800 text-primary-600 dark:text-primary-300 rounded-lg text-[10px] font-bold uppercase tracking-tight border border-gray-200 dark:border-gray-700 shadow-sm">
                                                            {crop}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Footer Section */}
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 flex justify-between items-center">
                                                <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-widest shadow-inner shadow-green-500/20">{t('table_active')}</span>
                                                <div className="flex -space-x-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-bold text-blue-600">SMS</div>
                                                </div>
                                            </div>

                                            {/* Permanent Checkbox if selected, so it doesnt vanish when un-hovered */}
                                            {selectedFarmers.has(farmer.id) && (
                                                <div className="absolute top-6 right-6" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedFarmers.has(farmer.id)}
                                                        onChange={(e) => handleSelectFarmer(farmer.id, e.target.checked)}
                                                        className="w-5 h-5 rounded-md border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {activeTab === 'visits' && (
                        <div>
                            <div className="mb-8 flex justify-between items-center">
                                <div>
                                    <h1 className={`text-3xl ${headingClass}`}>{t('nav_visits')}</h1>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">{t('visits_subtitle')}</p>
                                </div>
                                <button
                                    onClick={() => setShowVisitModal(true)}
                                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    {t('visits_schedule_new')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-2">
                                <AnimatePresence>
                                    {visits.map((visit: Visit, idx: number) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                            transition={{ duration: 0.4, type: "spring", bounce: 0.3, delay: Math.min(idx * 0.05, 0.5) }}
                                            key={visit.id}
                                            className="card glass p-6 flex flex-col justify-between hover:shadow-2xl transition-all duration-300 relative group min-h-[180px]"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-secondary-900/10 dark:bg-white/10 rounded-2xl flex items-center justify-center transition-colors shadow-inner">
                                                        <MapPin className="w-6 h-6 text-secondary-600 dark:text-secondary-300" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white text-lg tracking-tight truncate max-w-[150px]">{visit.farmer_name}</h4>
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                            {visit.visit_type}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm ${visit.status === 'completed'
                                                        ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
                                                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                                                    }`}>
                                                    {visit.status}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-black/20 flex items-center justify-center">
                                                    <Clock className="w-4 h-4 text-primary-500" />
                                                </div>
                                                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                                    {new Date(visit.scheduled_at).toLocaleDateString()} <span className="opacity-50">@</span> {new Date(visit.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>

                                            <div className="mt-auto pt-4 border-t border-gray-100 dark:border-white/10 flex justify-between items-center group-hover:border-primary-500/30 transition-colors">
                                                <div className="flex gap-2">
                                                    {visit.status !== 'completed' && visit.status !== 'cancelled' && (
                                                        <>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        await updateVisit(visit.id, { status: 'completed' });
                                                                        refetchVisits();
                                                                        addNotification({ type: 'success', message: `Visit marked as completed` });
                                                                    } catch {
                                                                        addNotification({ type: 'error', message: 'Failed to update visit status' });
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 bg-green-500/20 text-green-700 dark:text-green-400 rounded-lg text-[10px] font-black uppercase hover:bg-green-500/30 transition-colors shadow-sm"
                                                            >
                                                                Complete
                                                            </button>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        await updateVisit(visit.id, { status: 'cancelled' });
                                                                        refetchVisits();
                                                                        addNotification({ type: 'info', message: `Visit cancelled` });
                                                                    } catch {
                                                                        addNotification({ type: 'error', message: 'Failed to update visit status' });
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 bg-red-500/10 text-red-700 dark:text-red-400 rounded-lg text-[10px] font-black uppercase hover:bg-red-500/20 transition-colors"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        const farmerData = farmers.find((f: any) => f.id === visit.farmer_id || f.name === visit.farmer_name);
                                                        if (farmerData) handleOpenFarmerDetail(farmerData);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center glass rounded-full hover:bg-primary-500 hover:text-white transition-colors"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div>
                            <div className="mb-8 flex justify-between items-center">
                                <div>
                                    <h1 className={`text-3xl font-bold ${headingClass}`}>
                                        {isModern ? 'Strategic Governance & Reports' : 'System Compliance & Reports'}
                                    </h1>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                        {isModern ? 'Enterprise-grade performance documentation' : 'Operational audit logs and data exports'}
                                    </p>
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
                                    <div key={report.id} className="card group p-6 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-all cursor-pointer shadow-sm hover:shadow-xl"
                                        onClick={async () => {
                                            setIsLoadingReport(true);
                                            try {
                                                const res = await getReportContent(report.id);
                                                if (res.success && res.data) {
                                                    setViewingReport(res.data);
                                                    setReportContent(res.data.content || res.data.data?.content || null);
                                                }
                                            } catch {
                                                addNotification({ type: 'error', message: 'Failed to load report' });
                                            } finally {
                                                setIsLoadingReport(false);
                                            }
                                        }}
                                    >
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
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        downloadReport(report.id).then(blob => {
                                                            const url = window.URL.createObjectURL(blob);
                                                            const a = document.createElement('a');
                                                            a.href = url;
                                                            a.download = `${report.title}.pdf`;
                                                            a.click();
                                                        });
                                                    }}
                                                    className="p-1 px-2 text-[10px] font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    {t('common_download') || 'PDF'}
                                                </button>
                                                <div className="flex -space-x-2">
                                                    {report.createdBy === `${user?.firstName} ${user?.lastName}` && user?.avatarUrl ? (
                                                        <img 
                                                            src={user.avatarUrl} 
                                                            alt="" 
                                                            className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-primary-500 flex items-center justify-center text-[8px] text-white font-bold">
                                                            {report.createdBy
                                                                ? report.createdBy.split(/[\s_]+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()
                                                                : `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`
                                                            }
                                                        </div>
                                                    )}
                                                    {report.createdBy && (
                                                        <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium self-center ml-1 truncate max-w-[80px]">
                                                            {report.createdBy}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div>
                            <div className="mb-8">
                                <h1 className={`text-3xl font-bold ${headingClass}`}>
                                    {isModern ? 'Predictive Intelligence & Optimization' : 'Analytical Performance Metrics'}
                                </h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                    {isModern ? 'Real-time yield modeling and resource allocation metrics' : 'Detailed breakdown of system throughput and regional activity'}
                                </p>
                            </div>

                            {performanceData ? (
                            <>
                            {/* Metrics Cards - Redesigned */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                                <div className="card p-5 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-900/10 border-primary-200 dark:border-primary-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary-500/10 rounded-lg">
                                            <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">{t('analytics_resolution_rate')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                                        {performanceData?.metrics?.resolutionRate ?? '—'}%
                                    </p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-secondary-500/10 rounded-lg">
                                            <Clock className="w-4 h-4 text-secondary-600 dark:text-secondary-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">{t('analytics_avg_response_time')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                        {performanceData?.metrics?.avgResponseTime ?? '—'}
                                    </p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/10 border-green-200 dark:border-green-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-primary-500/10 rounded-lg">
                                            <Activity className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">{t('analytics_satisfaction_score')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                        {performanceData?.metrics?.satisfactionScore ?? '—'}
                                    </p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/10 border-orange-200 dark:border-orange-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-orange-500/10 rounded-lg">
                                            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">{t('analytics_follow_up_rate')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                                        {performanceData?.metrics?.followUpRate ?? '—'}%
                                    </p>
                                </div>

                                <div className="card p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-purple-500/10 rounded-lg">
                                            <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">{t('analytics_first_contact_res')}</p>
                                    </div>
                                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                                        {performanceData?.metrics?.firstContactResolution ?? '—'}%
                                    </p>
                                </div>
                            </div>

                            {/* Activity Timeline Chart */}
                            <div className="card p-8 mb-8 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">{t('analytics_activity_timeline')}</h3>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={performanceData?.timeline || []}>
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
                            </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
                                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        {t('analytics_no_data') || 'No Analytics Data Available'}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                                        {t('analytics_no_data_desc') || 'Analytics data will appear here once there is sufficient activity. Check back later or ensure the analytics service is running.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <ErrorBoundary>
                            <BillingDashboard />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'knowledge' && (
                        <KnowledgeBase />
                    )}

                    {activeTab === 'aiassistant' && (
                        <AlphaAI />
                    )}

                    {/* Farmer Chat Section */}

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
                                    className={`bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-6`}
                                >
                                    <div className="relative w-24 h-24 mx-auto">
                                        <div className="absolute inset-0 border-4 border-primary-500/20 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <FileText className="w-10 h-10 text-primary-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className={`text-2xl font-black 'text-gray-900 dark:text-white'`}>
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

                    {/* Report Viewer Modal */}
                    {viewingReport && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
                            >
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{viewingReport.title}</h3>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Generated: {new Date(viewingReport.generatedAt).toLocaleString()} · Status: {viewingReport.status}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { setViewingReport(null); setReportContent(null); }}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    {isLoadingReport ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                        </div>
                                    ) : reportContent ? (
                                        <div className="prose dark:prose-invert max-w-none">
                                            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{reportContent}</pre>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-500">No content available for this report.</p>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const blob = await downloadReport(viewingReport.id);
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `${viewingReport.title}.pdf`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    } catch {
                                                        addNotification({ type: 'error', message: 'Download failed' });
                                                    }
                                                }}
                                                className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold"
                                            >
                                                Download Report
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
                                    <button
                                        onClick={async () => {
                                            try {
                                                const blob = await downloadReport(viewingReport.id);
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `${viewingReport.title}.pdf`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            } catch {
                                                addNotification({ type: 'error', message: 'Download failed' });
                                            }
                                        }}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Download
                                    </button>
                                    <button
                                        onClick={() => { setViewingReport(null); setReportContent(null); }}
                                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* New Advanced Pages */}
                    {activeTab === 'telemetry' && (
                        <ErrorBoundary>
                            <Telemetry />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'agents' && (
                        <ErrorBoundary>
                            <Agents />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'system_health' && (
                        <ErrorBoundary>
                            <SystemHealth />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'disease_diagnosis' && (
                        <ErrorBoundary>
                            <DiseaseDiagnosisPage />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'memory' && (
                        <ErrorBoundary>
                            <Memory />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'email_workflows' && (
                        <ErrorBoundary>
                            <EmailWorkflows />
                        </ErrorBoundary>
                    )}

                    {activeTab === 'mcp_tools' && (
                        <ErrorBoundary>
                            <MCPTools />
                        </ErrorBoundary>
                    )}

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
                    </main>
                </div>
            </div>

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
            {/* Global UI Elements */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    entityType={contextMenu.entityType}
                    entityId={contextMenu.entityId}
                    isBulk={contextMenu.isBulk}
                    onClose={hideContextMenu}
                    onAction={handleMenuAction}
                />
            )}
            {shareModal && (
                <ShareModal
                    isOpen={!!shareModal}
                    onClose={hideShareModal}
                    entityType={shareModal.entityType}
                    entityId={shareModal.entityId}
                    entityName={shareModal.entityName}
                />
            )}
            <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
            <SettingsPanel isOpen={showSettingsPanel} onClose={() => setShowSettingsPanel(false)} />
            <HelpCenterModal isOpen={showHelpCenter} onClose={() => setShowHelpCenter(false)} />
            <BulkSmsModal
                isOpen={isBulkSmsModalOpen}
                onClose={() => setIsBulkSmsModalOpen(false)}
                onSend={onBulkSmsSend}
                selectedCount={selectedFarmers.size}
                isLoading={isSendingBulkSms}
            />

            <BulkUpdateModal
                isOpen={isBulkUpdateModalOpen}
                onClose={() => setIsBulkUpdateModalOpen(false)}
                onUpdate={onBulkUpdateFarmers}
                selectedCount={selectedFarmers.size}
                isLoading={isUpdatingBulk}
            />
            {confirmModal && (

                <ConfirmModal
                    isOpen={!!confirmModal}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    variant={confirmModal.variant}
                    confirmText={confirmModal.confirmText}
                />
            )}
        </div>
    );
}

export default App;
