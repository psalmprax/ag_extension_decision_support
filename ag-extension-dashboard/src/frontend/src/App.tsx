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
    HelpCircle,
    Upload,
    Wifi,
    WifiOff,
    Download
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
import { fetchFarmers, createFarmer } from '@/api/farmerService';
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
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value !== undefined && value !== null ? value.toLocaleString() : '0'}</p>
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
        shareModal, hideShareModal, showShareModal, removeFarmer, removeFarmers
    } = useAppStore();

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
    const [userLocation, setUserLocation] = useState<string>('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [globalSearchResults, setGlobalSearchResults] = useState<{ type: string; items: { id: string; label: string; sublabel?: string }[] }[]>([]);
    const [isGlobalSearching, setIsGlobalSearching] = useState(false);
    const [reportContent, setReportContent] = useState<string | null>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);
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
        const loadUnreadCount = async () => {
            try {
                const count = await fetchUnreadCount();
                setApiUnreadCount(count);
            } catch {
                // Fallback to store count
            }
        };
        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 60000);
        return () => clearInterval(interval);
    }, []);

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
                        setUserLocation(location + (country ? `, ${country}` : ''));
                    } catch {
                        setUserLocation(`${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
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
    const isOfficer = user?.role === 'extension_officer';

    // Fetch Dashboard Data
    const { data: dashboardResponse, isLoading, isError } = useQuery<any>({
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
    const effectiveFarmers = queryFarmers.length > 0 ? queryFarmers : storeFarmers;

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
        enabled: activeTab === 'analytics' || activeTab === 'dashboard'
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const performanceData = (performanceResponse as any)?.data;

    // Fetch Billing Transactions
    const { data: transactionsResponse } = useQuery<{ success: boolean; data: any[] }>({
        queryKey: ['transactions'],
        queryFn: getMyTransactions,
        enabled: activeTab === 'billing' || showGlobalSearch
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
                        sublabel: `Generated ${new Date(r.createdAt).toLocaleDateString()}`
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

    return (
        <div
            className={`h-screen flex flex-col ${darkMode ? 'dark' : ''} bg-theme-bg-primary transition-colors duration-300 overflow-hidden relative`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragOver && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md border-8 border-dashed border-primary-500 flex items-center justify-center transition-all animate-in fade-in duration-200 pointer-events-none">
                    <div className="text-center bg-white/10 dark:bg-black/20 p-12 rounded-3xl backdrop-blur-lg border border-white/20 shadow-2xl">
                        <Upload className="w-24 h-24 text-primary-400 mx-auto mb-6 animate-bounce" />
                        <h2 className="text-4xl font-black text-white tracking-tight mb-2">Drop Files to Upload</h2>
                        <p className="text-lg text-primary-200 font-medium">Release to process CSV, PDF, or Image files</p>
                    </div>
                </div>
            )}
            {/* Top Navigation */}
            <header className="z-50 glass bg-theme-bg-card/80 border-b border-gray-200 dark:border-gray-800 transition-colors flex-shrink-0">
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
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    handleGlobalSearch(e.target.value);
                                }}
                                onFocus={() => { if (searchQuery.trim()) setShowGlobalSearch(true); }}
                                onBlur={() => { setTimeout(() => setShowGlobalSearch(false), 200); }}
                            />
                            {showGlobalSearch && globalSearchResults.length > 0 && (
                                <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
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
                                                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
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
                                                            {item.sublabel && <p className="text-xs text-gray-500 truncate">{item.sublabel}</p>}
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                ))}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        <ThemeSwitcher currentTheme={themeName} onThemeChange={setThemeName} />
                        <LanguageSwitcher compact />
                        <ThemeToggle />
                        {/* Sync Status Indicator */}
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100/80 dark:bg-gray-800/80 text-xs font-bold">
                            {isOnline ? (
                                <Wifi className="w-3 h-3 text-green-600" />
                            ) : (
                                <WifiOff className="w-3 h-3 text-red-600" />
                            )}
                            <span className={isOnline ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsNotificationPanelOpen(true)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                        >
                            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            {(apiUnreadCount > 0 || notifications.some(n => !n.read)) && (
                                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse flex items-center justify-center">
                                    {(() => {
                                        const storeUnread = notifications.filter(n => !n.read).length;
                                        const totalUnread = apiUnreadCount + storeUnread;
                                        return totalUnread > 0 ? (
                                            <span className="text-[6px] text-white font-bold">{totalUnread > 9 ? '9+' : totalUnread}</span>
                                        ) : null;
                                    })()}
                                </span>
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

                                            <button
                                                onClick={() => { setIsProfileMenuOpen(false); setShowProfileModal(true); }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 group"
                                            >
                                                <User className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                                                <span className="text-xs font-bold uppercase tracking-widest">My Profile</span>
                                            </button>

                                            <button
                                                onClick={() => { setIsProfileMenuOpen(false); setShowSettingsPanel(true); }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 group"
                                            >
                                                <Settings className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Settings</span>
                                            </button>

                                            <button
                                                onClick={() => { setIsProfileMenuOpen(false); setShowHelpCenter(true); }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-600 dark:text-gray-300 group"
                                            >
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

            {/* Application Body */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.aside
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 260, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="h-full z-40 bg-theme-bg-card border-r border-gray-200 dark:border-gray-800 overflow-y-auto transition-colors flex-shrink-0"
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

                            <div className="mt-auto pt-6 flex flex-col items-center border-t border-gray-100 dark:border-gray-800">
                                <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                                        v1.0.2 [Hardened]
                                    </span>
                                </div>
                            </div>
                        </nav>
                    </motion.aside>
                )}
            </AnimatePresence>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Breadcrumb Navigation - Sticky within the content area */}
                    <div className="z-40 bg-theme-bg-primary/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-800/50 flex-shrink-0">
                        <div className="px-6 py-3">
                            <BreadcrumbNavigation items={getBreadcrumbItems()} />
                        </div>
                    </div>

                    {/* Main Content Scrollable */}
                    <main className="flex-1 overflow-y-auto scrollbar-hide">
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
                                <p className={'text-gray-500 dark:text-gray-400 mt-1 font-medium'}>{t('dashboard_welcome').replace('{name}', user?.firstName || 'Extension Officer')}</p>
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
                                        />
                                        <StatCard
                                            title={isOfficer ? "My Active Chats" : t('stat_active_conversations')}
                                            value={dashboardData.overview.activeConversations}
                                            change={dashboardData.trends.conversationsGrowth}
                                            icon={MessageSquare}
                                            delay={0.05}
                                        />
                                        <StatCard
                                            title={isOfficer ? "My Visits (30d)" : t('stat_visits_this_month')}
                                            value={dashboardData.overview.visitsThisMonth}
                                            change={dashboardData.trends.visitsGrowth}
                                            icon={MapPin}
                                            delay={0.1}
                                        />
                                        <StatCard
                                            title={isOfficer ? "Avg. Conversations" : t('stat_avg_satisfaction')}
                                            value={isOfficer ? dashboardData.overview.avgConversationsPerFarmer : `${dashboardData.overview.avgSatisfaction}/5`}
                                            change={isOfficer ? undefined : dashboardData.trends.satisfactionChange}
                                            icon={isOfficer ? MessageSquare : Sparkles}
                                            delay={0.15}
                                        />
                                    </>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                <div className={`lg:col-span-2 card p-6 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group`}>
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
                                            farmers={effectiveFarmers.map((f: any) => ({
                                                id: f.id,
                                                name: f.name || `${f.firstName} ${f.lastName}`,
                                                lat: f.latitude || f.lat || 0,
                                                lng: f.longitude || f.lng || 0,
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
                                    {performanceData ? (
                                    <div className="space-y-6">
                                        {[
                                            { name: t('analytics_resolution_rate'), progress: performanceData?.metrics?.resolutionRate ?? 0, color: 'bg-primary-500' },
                                            { name: t('analytics_satisfaction_score'), progress: performanceData?.metrics?.satisfactionScore ? performanceData.metrics.satisfactionScore * 20 : 0, color: 'bg-secondary-500' },
                                            { name: t('analytics_follow_up_rate'), progress: performanceData?.metrics?.followUpRate ?? 0, color: 'bg-purple-500' },
                                            { name: t('analytics_first_contact_res'), progress: performanceData?.metrics?.firstContactResolution ?? 0, color: 'bg-orange-500' }
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
                                    ) : (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                        </div>
                                    )}
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

                            <div className="card overflow-hidden bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={effectiveFarmers && selectedFarmers.size === effectiveFarmers.length && effectiveFarmers.length > 0}
                                                        onChange={(e) => handleSelectAllFarmers(e.target.checked)}
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                </th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_farmer_details')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_region_village')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_crops')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_farm_size')}</th>
                                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ">{t('table_status')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                            {effectiveFarmers.map((farmer: Farmer) => (
                                                <tr
                                                    key={farmer.id}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedFarmers.has(farmer.id)}
                                                            onChange={(e) => handleSelectFarmer(farmer.id, e.target.checked)}
                                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4" onClick={() => handleOpenFarmerDetail(farmer)}>
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
                                            {visit.status !== 'completed' && visit.status !== 'cancelled' && (
                                                <div className="flex gap-1">
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
                                                        className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-[9px] font-bold uppercase hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
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
                                                        className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-[9px] font-bold uppercase hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
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
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('analytics_title')}</h1>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('analytics_subtitle')}</p>
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
