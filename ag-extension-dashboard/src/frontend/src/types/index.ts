/**
 * Shared Types
 * Centralized type definitions for the entire frontend application
 */

// ============================================================================
// User Types
// ============================================================================

export type UserRole = 'admin' | 'extension_officer' | 'farmer';

export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    region?: string;
    phone?: string;
    avatar?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface UserProfile extends User {
    subscription?: Subscription;
    preferences?: UserPreferences;
}

export interface UserPreferences {
    language: string;
    theme: string;
    notifications: boolean;
    emailAlerts: boolean;
}

// ============================================================================
// Farmer Types
// ============================================================================

export interface Farmer {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    location: string;
    village?: string;
    region?: string;
    district?: string;
    languagePreference?: string;
    crops?: string[];
    farmSize?: number;
    latitude?: number;
    longitude?: number;
    yield?: number;
    status?: 'active' | 'inactive' | 'archived';
    createdAt?: string;
    updatedAt?: string;
    notes?: string;
}

export interface FarmerFormData extends Omit<Farmer, 'id' | 'createdAt' | 'updatedAt'> {
    // Form-specific fields
}

// ============================================================================
// Visit Types
// ============================================================================

export type VisitStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type VisitType = 'routine' | 'follow_up' | 'emergency' | 'training' | 'inspection';

export interface Visit {
    id: string;
    farmerId: string;
    farmerName: string;
    scheduledDate: string;
    scheduledAt?: string; // Backend field
    status: VisitStatus;
    visitType: VisitType;
    notes?: string;
    location?: string;
    duration?: number;
    completedAt?: string;
    officerId?: string;
    officerName?: string;
    createdAt?: string;
    updatedAt?: string;
    synthesis?: VisitSynthesis;
}

export interface VisitFormData extends Omit<Visit, 'id' | 'createdAt' | 'updatedAt'> {
    farmer_id?: string;
}

export interface VisitSynthesis {
    id: string;
    visitId: string;
    summary: string;
    recommendations: string[];
    aiGenerated: boolean;
    createdAt?: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'alert';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
    id: string;
    type: NotificationType;
    priority?: NotificationPriority;
    title?: string;
    message: string;
    timestamp: number;
    read: boolean;
    actionLabel?: string;
    onAction?: () => void;
    metadata?: Record<string, any>;
}

// ============================================================================
// Subscription & Billing Types
// ============================================================================

export interface Subscription {
    id: string;
    userId: string;
    plan: SubscriptionPlan;
    status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string;
    endedAt?: string;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    description?: string;
    amount: number;
    currency: string;
    interval: 'month' | 'year';
    features: string[];
    usageLimits?: UsageLimit[];
}

export interface UsageLimit {
    type: string;
    label: string;
    current: number;
    limit: number;
    unit?: string;
}

export interface Transaction {
    id: string;
    transactionId: string;
    userId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    method: string;
    description?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface Invoice {
    id: string;
    invoiceId: string;
    subscriptionId: string;
    userId: string;
    amount: number;
    currency: string;
    status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
    dueDate?: string;
    paidAt?: string;
    hostedInvoiceUrl?: string;
    invoicePdf?: string;
    createdAt: string;
}

// ============================================================================
// Chat & Conversation Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'officer' | 'system';
export type ConversationMode = 'ai' | 'farmer' | 'officer';

export interface ChatMessage {
    id?: string;
    role: MessageRole;
    content: string;
    timestamp: string;
    conversationId?: string;
    attachments?: Attachment[];
    metadata?: {
        latency?: number;
        model?: string;
        tokens?: number;
    };
}

export interface Conversation {
    id: string;
    title: string;
    farmerId?: string;
    farmerName?: string;
    lastMessage?: string;
    updatedAt: string;
    startedAt: string;
    mode?: ConversationMode;
    messageCount?: number;
}

// ============================================================================
// Report Types
// ============================================================================

export type ReportType = 'synthesis' | 'analytics' | 'performance' | 'custom';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface Report {
    id: string;
    title: string;
    type: ReportType;
    status: ReportStatus;
    content?: string;
    summary?: string;
    generatedAt: string;
    generatedBy?: string;
    metadata?: {
        region?: string;
        period?: string;
        farmers?: number;
        visits?: number;
    };
    downloadUrl?: string;
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

export interface KnowledgeArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    tags?: string[];
    language?: string;
    author?: string;
    publishedAt?: string;
    updatedAt?: string;
    views?: number;
    helpful?: number;
}

export interface KnowledgeSearchResult {
    article: KnowledgeArticle;
    score: number;
    highlights?: string[];
}

// ============================================================================
// AI & Analysis Types
// ============================================================================

export interface AIAnalysis {
    id: string;
    type: 'weather' | 'crop' | 'market' | 'soil' | 'disease';
    region: string;
    findings: string[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    dataSources: string[];
    generatedAt: string;
    metadata?: Record<string, any>;
}

export interface WeatherData {
    temperature: number;
    humidity: number;
    precipitation: number;
    windSpeed: number;
    conditions: string;
    forecast?: WeatherForecast[];
}

export interface WeatherForecast {
    date: string;
    temperatureMin: number;
    temperatureMax: number;
    precipitation: number;
    conditions: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: ApiError;
    message?: string;
    pagination?: Pagination;
}

export interface ApiError {
    code: string;
    message: string;
    details?: any;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardOverview {
    totalFarmers: number;
    activeConversations: number;
    visitsThisMonth: number;
    avgSatisfaction: number;
    avgConversationsPerFarmer: number;
}

export interface DashboardTrends {
    farmersGrowth: number;
    conversationsGrowth: number;
    visitsGrowth: number;
    satisfactionChange: number;
}

export interface DashboardData {
    overview: DashboardOverview;
    trends: DashboardTrends;
    recentActivity?: any[];
}

// ============================================================================
// UI Component Types
// ============================================================================

export interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    roles: UserRole[];
    badge?: number;
    disabled?: boolean;
}

export interface BreadcrumbItem {
    label: string;
    href?: string;
    icon?: React.ElementType;
}

export interface TableColumn<T = any> {
    key: keyof T | string;
    label: string;
    sortable?: boolean;
    render?: (value: any, item: T, index: number) => React.ReactNode;
    width?: string | number;
}

// ============================================================================
// Form Types
// ============================================================================

export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'file' | 'checkbox' | 'date' | 'tel';
    placeholder?: string;
    required?: boolean;
    validation?: ValidationRule[];
    options?: { value: string; label: string }[];
    defaultValue?: any;
}

export interface ValidationRule {
    type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
    value?: any;
    message: string;
}

// ============================================================================
// File & Upload Types
// ============================================================================

export interface Attachment {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    thumbnailUrl?: string;
    uploadedAt: string;
}

export interface UploadProgress {
    fileName: string;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
}

// ============================================================================
// Offline & Sync Types
// ============================================================================

export interface SyncQueueItem {
    id: string;
    type: 'create' | 'update' | 'delete';
    entityType: string;
    entityId: string;
    data: any;
    timestamp: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retryCount: number;
}

export interface SyncStatus {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
}

// ============================================================================
// Theme Types
// ============================================================================

export type ThemeName = 'forest' | 'ocean' | 'sunset' | 'minimal' | 'cyber';

export interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
}

// ============================================================================
// Alert & Disease Types
// ============================================================================

export interface DiseaseAlert {
    id: string;
    disease: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    region: string;
    affectedArea: number;
    recommendations: string[];
    detectedAt: string;
    expiresAt?: string;
}

export interface MarketAlert {
    id: string;
    crop: string;
    priceChange: number;
    currentPrice: number;
    trend: 'up' | 'down' | 'stable';
    region: string;
    detectedAt: string;
}

// ============================================================================
// Feature Flag Types
// ============================================================================

export interface FeatureFlag {
    id: string;
    name: string;
    enabled: boolean;
    description?: string;
    rolloutPercentage?: number;
    userSegments?: string[];
}