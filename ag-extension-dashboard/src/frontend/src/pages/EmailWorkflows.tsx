import React, { useState, useEffect } from 'react';
import {
    Mail, Plus, Send, CheckCircle, XCircle,
    Clock, Eye, Edit, Trash2, Filter,
    AlertTriangle, RefreshCw, UserCheck, UserX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useDesignSystemMode } from '@/hooks/useDesignSystemMode';
import { useAppStore } from '../store/useAppStore';
import {
    fetchEmailTemplates,
    fetchPendingApprovals,
    approveEmail,
    rejectEmail,
    type EmailTemplate,
    type EmailApproval
} from '../api/emailWorkflowService';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

export function EmailWorkflows() {
    const { t } = useLanguage();
    const { headingClass } = useDesignSystemMode();
    const { addNotification } = useAppStore();

    // State
    const [activeTab, setActiveTab] = useState<'templates' | 'approvals'>('templates');
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [approvals, setApprovals] = useState<EmailApproval[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [showApprovalModal, setShowApprovalModal] = useState<EmailApproval | null>(null);
    const [approvalComment, setApprovalComment] = useState('');
    const [isProcessingApproval, setIsProcessingApproval] = useState(false);

    // Preview and Edit modals
    const [showPreviewModal, setShowPreviewModal] = useState<EmailTemplate | null>(null);
    const [showEditModal, setShowEditModal] = useState<EmailTemplate | null>(null);
    const [editForm, setEditForm] = useState({
        subject: '',
        body: '',
        category: '',
        variables: [] as string[]
    });

    // Load data
    const loadData = async (showRefresh = false) => {
        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const [templatesRes, approvalsRes] = await Promise.all([
                fetchEmailTemplates(selectedCategory === 'all' ? undefined : selectedCategory),
                fetchPendingApprovals()
            ]);

            if (templatesRes.success) {
                setTemplates(templatesRes.data);
            }
            if (approvalsRes.success) {
                setApprovals(approvalsRes.data);
            }
        } catch (error) {
            console.error('Failed to load email workflow data:', error);
            addNotification({
                type: 'error',
                message: t('email_workflows_failed_load')
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedCategory]);

    const handleRefresh = () => {
        loadData(true);
    };

    const handleApproveEmail = async () => {
        if (!showApprovalModal) return;

        setIsProcessingApproval(true);
        try {
            const res = await approveEmail(showApprovalModal.id, approvalComment || undefined);
            if (res.success) {
                addNotification({
                    type: 'success',
                    message: t('email_workflows_approved')
                });
                setShowApprovalModal(null);
                setApprovalComment('');
                loadData();
            }
        } catch (error) {
            console.error('Failed to approve email:', error);
            addNotification({
                type: 'error',
                message: 'Failed to approve email'
            });
        } finally {
            setIsProcessingApproval(false);
        }
    };

    const handleRejectEmail = async () => {
        if (!showApprovalModal) return;

        setIsProcessingApproval(true);
        try {
            const res = await rejectEmail(showApprovalModal.id, approvalComment || undefined);
            if (res.success) {
                addNotification({
                    type: 'success',
                    message: t('email_workflows_rejected')
                });
                setShowApprovalModal(null);
                setApprovalComment('');
                loadData();
            }
        } catch (error) {
            console.error('Failed to reject email:', error);
            addNotification({
                type: 'error',
                message: t('email_workflows_failed_reject')
            });
        } finally {
            setIsProcessingApproval(false);
        }
    };

    const handlePreviewTemplate = (template: EmailTemplate) => {
        setShowPreviewModal(template);
    };

    const handleEditTemplate = (template: EmailTemplate) => {
        setShowEditModal(template);
        setEditForm({
            subject: template.subject,
            body: template.body,
            category: template.category,
            variables: template.variables
        });
    };

    const handleSaveTemplate = () => {
        // TODO: Implement template update functionality
        addNotification({
            type: 'info',
            message: 'Template editing functionality will be implemented in the next update'
        });
        setShowEditModal(null);
    };

    const renderTemplatePreview = (template: EmailTemplate) => {
        // Create sample data for preview
        const sampleData: Record<string, string> = {
            farmerName: 'John Doe',
            officerName: 'Dr. Sarah Johnson',
            location: 'Kampala District',
            visitDate: '2026-04-15',
            visitTime: '10:00 AM',
            purpose: 'Crop disease assessment',
            diseaseName: 'Late Blight',
            region: 'Central Region',
            affectedCrops: 'Tomatoes, Potatoes',
            severity: 'High',
            recommendations: 'Apply copper-based fungicide immediately',
            cropName: 'Tomatoes',
            price: '2500',
            unit: 'UGX/kg',
            priceTable: 'Tomatoes: 2500 UGX/kg\nPotatoes: 1800 UGX/kg',
            marketName: 'Kampala Market',
            date: '2026-04-06',
            dateRange: '2026-04-06 to 2026-04-10',
            weatherSummary: 'Heavy rainfall expected with winds up to 25 km/h',
            recipientName: 'Jane Smith',
            trainingTopic: 'Sustainable Farming Practices',
            time: '2:00 PM',
            trainerName: 'Prof. Michael Brown'
        };

        let previewSubject = template.subject;
        let previewBody = template.body;

        // Replace variables with sample data
        template.variables.forEach(variable => {
            const regex = new RegExp(`{{${variable}}}`, 'g');
            const sampleValue = sampleData[variable] || `[${variable}]`;
            previewSubject = previewSubject.replace(regex, sampleValue);
            previewBody = previewBody.replace(regex, sampleValue);
        });

        return { subject: previewSubject, body: previewBody };
    };

    const categories = [...new Set(templates.map(t => t.category))];

    const StatCard = ({ title, value, icon: Icon, color = 'blue' }: {
        title: string;
        value: string | number;
        icon: any;
        color?: string;
    }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 border-white/20 hover:scale-[1.02] transition-transform duration-300"
            style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-premium)' }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                </div>
                <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/30 rounded-xl`}>
                    <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
                </div>
            </div>
        </motion.div>
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Workflow Manager</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage email templates and approval workflows</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-6 animate-pulse">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                                </div>
                                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className={`text-2xl ${headingClass}`}>{t('email_workflows_title')}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('email_workflows_subtitle')}</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                        title={t('email_workflows_templates')}
                    value={templates.length}
                    icon={Mail}
                    color="blue"
                />
                <StatCard
                        title={t('email_workflows_pending_approvals')}
                    value={approvals.length}
                    icon={Clock}
                    color="yellow"
                />
                <StatCard
                        title={t('email_workflows_categories')}
                    value={categories.length}
                    icon={Filter}
                    color="green"
                />
                <StatCard
                        title={t('email_workflows_total_variables')}
                    value={templates.reduce((acc, t) => acc + t.variables.length, 0)}
                    icon={AlertTriangle}
                    color="purple"
                />
            </div>

            {/* Tab Navigation */}
            <div className="card p-1">
                <div className="flex space-x-1">
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeTab === 'templates'
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        Templates ({templates.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('approvals')}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                            activeTab === 'approvals'
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        Pending Approvals ({approvals.length})
                    </button>
                </div>
            </div>

            {/* Templates Tab */}
            {activeTab === 'templates' && (
                <div className="space-y-6">
                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>

                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map((template) => (
                            <motion.div
                                key={template.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="card p-6 border-white/20 hover:scale-[1.02] transition-transform duration-300"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Mail className="w-5 h-5 text-primary-600" />
                                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                                                {template.category}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{template.displayName || template.name}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{template.subject}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Variables:</span>
                                        <span className="font-medium">{template.variables.length}</span>
                                    </div>

                                    {template.variables.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {template.variables.slice(0, 3).map((variable, index) => (
                                                <span
                                                    key={index}
                                                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                                                >
                                                    {variable}
                                                </span>
                                            ))}
                                            {template.variables.length > 3 && (
                                                <span className="text-xs text-gray-500">+{template.variables.length - 3} more</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Created by {template.createdBy || 'System'} • {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Recently'}
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => handlePreviewTemplate(template)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => handleEditTemplate(template)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                                    >
                                        <Edit className="w-4 h-4" />
                                        {t('email_workflows_edit')}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {templates.length === 0 && (
                        <div className="text-center py-12">
                            <Mail className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('email_workflows_no_templates_found')}</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {selectedCategory !== 'all'
                                    ? t('email_workflows_no_templates_category')
                                    : t('email_workflows_create_first')
                                }
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Approvals Tab */}
            {activeTab === 'approvals' && (
                <div className="space-y-6">
                    {approvals.length > 0 ? (
                        <div className="space-y-4">
                            {approvals.map((approval) => (
                                <motion.div
                                    key={approval.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="card p-6 border-white/20"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Clock className="w-5 h-5 text-yellow-600" />
                                                <span className="text-sm font-medium text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
                                                    {t('email_workflows_pending_approval')}
                                                </span>
                                            </div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                {approval.emailData.subject}
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {t('email_workflows_to')} {approval.emailData.to.join(', ')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Requested by {approval.requestedBy}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {new Date(approval.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-4">
                                        <div
                                            className="text-sm text-gray-900 dark:text-white prose prose-sm max-w-none dark:prose-invert"
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(approval.emailData.html.length > 300
                                                    ? approval.emailData.html.substring(0, 300) + '...'
                                                    : approval.emailData.html)
                                            }}
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowApprovalModal(approval)}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Review
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                            <CheckCircle className="w-4 h-4" />
                                            Quick Approve
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                                            <XCircle className="w-4 h-4" />
                                            Quick Reject
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All caught up!</h3>
                            <p className="text-gray-600 dark:text-gray-400">No pending email approvals at this time</p>
                        </div>
                    )}
                </div>
            )}

            {/* Approval Modal */}
            {showApprovalModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{t('email_workflows_review_email')}</h3>
                                <button
                                    onClick={() => {
                                        setShowApprovalModal(null);
                                        setApprovalComment('');
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('email_workflows_subject')}
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">{showApprovalModal.emailData.subject}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('email_workflows_recipients')}
                                    </label>
                                    <p className="text-gray-900 dark:text-white">{showApprovalModal.emailData.to.join(', ')}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('email_workflows_content')}
                                    </label>
                                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-60 overflow-y-auto">
                                        <div
                                            className="prose prose-sm max-w-none dark:prose-invert"
                                            dangerouslySetInnerHTML={{ __html: showApprovalModal.emailData.html }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('email_workflows_review_comment')}
                                    </label>
                                    <textarea
                                        value={approvalComment}
                                        onChange={(e) => setApprovalComment(e.target.value)}
                                        placeholder={t('email_workflows_add_comment')}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={handleApproveEmail}
                                        disabled={isProcessingApproval}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        {isProcessingApproval ? t('email_workflows_approving') : t('email_workflows_approve_send')}
                                    </button>
                                    <button
                                        onClick={handleRejectEmail}
                                        disabled={isProcessingApproval}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    >
                                        <UserX className="w-4 h-4" />
                                        {isProcessingApproval ? t('email_workflows_rejecting') : t('email_workflows_reject')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Preview Template Modal */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Template Preview: {showPreviewModal.displayName || showPreviewModal.name}
                                </h3>
                                <button
                                    onClick={() => setShowPreviewModal(null)}
                                    className="text-gray-400 hover:text-gray-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            {(() => {
                                const preview = renderTemplatePreview(showPreviewModal);
                                return (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Subject
                                            </label>
                                            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border font-medium">
                                                {preview.subject}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Body
                                            </label>
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded border whitespace-pre-wrap font-mono text-sm">
                                                {preview.body}
                                            </div>
                                        </div>

                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            <strong>Note:</strong> Variables in {"{{"}brackets{"}"} have been replaced with sample data for preview.
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex justify-end mt-6">
                                <button
                                    onClick={() => setShowPreviewModal(null)}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Edit Template Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Edit Template: {showEditModal.displayName || showEditModal.name}
                                </h3>
                                <button
                                    onClick={() => setShowEditModal(null)}
                                    className="text-gray-400 hover:text-gray-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Category
                                    </label>
                                    <select
                                        value={editForm.category}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    >
                                        <option value="visits">Visits</option>
                                        <option value="alerts">Alerts</option>
                                        <option value="market">Market</option>
                                        <option value="weather">Weather</option>
                                        <option value="training">Training</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Subject
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.subject}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                        placeholder="Email subject line"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Body
                                    </label>
                                    <textarea
                                        value={editForm.body}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, body: e.target.value }))}
                                        rows={12}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
                                        placeholder="Email body content"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Variables (comma-separated)
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.variables.join(', ')}
                                        onChange={(e) => setEditForm(prev => ({
                                            ...prev,
                                            variables: e.target.value.split(',').map(v => v.trim()).filter(v => v)
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                        placeholder="farmerName, location, visitDate"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowEditModal(null)}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

export default EmailWorkflows;