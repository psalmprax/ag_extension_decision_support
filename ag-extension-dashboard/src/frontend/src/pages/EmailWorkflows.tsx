import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import {
    fetchEmailTemplates,
    fetchPendingApprovals,
    approveEmail,
    rejectEmail,
    type EmailTemplate,
    type EmailApproval,
} from '../api/emailWorkflowService';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';

import { EmailWorkflowsHeader } from '@/components/email-workflows/Header';
import { EmailWorkflowsStatsRows } from '@/components/email-workflows/StatsRows';
import { EmailWorkflowsTabs } from '@/components/email-workflows/Tabs';
import { EmailWorkflowsCategoryFilter } from '@/components/email-workflows/CategoryFilter';
import { EmailWorkflowsTemplateGrid } from '@/components/email-workflows/TemplateGrid';
import { EmailWorkflowsApprovalQueue } from '@/components/email-workflows/ApprovalQueue';
import { EmailWorkflowsApprovalModal } from '@/components/email-workflows/ApprovalModal';
import { EmailWorkflowsPreviewModal } from '@/components/email-workflows/PreviewModal';
import { EmailWorkflowsEditModal } from '@/components/email-workflows/EditModal';
import type { EditForm } from '@/types/emailWorkflows';

export function EmailWorkflows() {
    const { t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass } = useThemeClasses();
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
    const [editForm, setEditForm] = useState<EditForm>({
        subject: '',
        body: '',
        category: '',
        variables: [],
    });

    const categories = [...new Set(templates.map(template => template.category))];

    const loadData = useCallback(async (showRefresh = false) => {
        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const [templatesRes, approvalsRes] = await Promise.all([
                fetchEmailTemplates(selectedCategory === 'all' ? undefined : selectedCategory),
                fetchPendingApprovals(),
            ]);

            if (templatesRes.success) setTemplates(templatesRes.data);
            if (approvalsRes.success) setApprovals(approvalsRes.data);
        } catch (error) {
            console.error('Failed to load email workflow data:', error);
            addNotification({
                type: 'error',
                message: t('email_workflows_failed_load'),
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [selectedCategory, addNotification, t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefresh = () => loadData(true);

    const handleApproveEmail = async () => {
        if (!showApprovalModal) return;
        setIsProcessingApproval(true);
        try {
            const res = await approveEmail(showApprovalModal.id, approvalComment || undefined);
            if (res.success) {
                addNotification({ type: 'success', message: t('email_workflows_approved') });
                setShowApprovalModal(null);
                setApprovalComment('');
                loadData();
            }
        } catch (error) {
            console.error('Failed to approve email:', error);
            addNotification({ type: 'error', message: 'Failed to approve email' });
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
                addNotification({ type: 'success', message: t('email_workflows_rejected') });
                setShowApprovalModal(null);
                setApprovalComment('');
                loadData();
            }
        } catch (error) {
            console.error('Failed to reject email:', error);
            addNotification({ type: 'error', message: t('email_workflows_failed_reject') });
        } finally {
            setIsProcessingApproval(false);
        }
    };

    const handlePreviewTemplate = (template: EmailTemplate) => setShowPreviewModal(template);

    const handleEditTemplate = (template: EmailTemplate) => {
        setShowEditModal(template);
        setEditForm({
            subject: template.subject,
            body: template.body,
            category: template.category,
            variables: template.variables,
        });
    };

    const handleSaveTemplate = () => {
        addNotification({
            type: 'info',
            message: 'Template editing functionality will be implemented in the next update',
        });
        setShowEditModal(null);
    };

    const closeApprovalModal = () => {
        setShowApprovalModal(null);
        setApprovalComment('');
    };

    if (isLoading) {
        return <LoadingHeaderSkeleton title="Email Workflow Manager" description="Manage email templates and approval workflows" />;
    }

    return (
        <div className="space-y-6">
            <EmailWorkflowsHeader
                isModern={isModern}
                headingClass={headingClass}
                subtitle={t('email_workflows_subtitle')}
                isRefreshing={isRefreshing}
                onRefresh={handleRefresh}
                btnClass={btnClass}
            />

            <EmailWorkflowsStatsRows
                templates={templates}
                approvals={approvals}
                categories={categories}
                t={t}
            />

            <EmailWorkflowsTabs
                activeTab={activeTab}
                onChange={setActiveTab}
                templatesCount={templates.length}
                approvalsCount={approvals.length}
                radiusClass={radiusClass}
            />

            {activeTab === 'templates' && (
                <>
                    <EmailWorkflowsCategoryFilter
                        categories={categories}
                        selected={selectedCategory}
                        onChange={setSelectedCategory}
                        radiusClass={radiusClass}
                    />
                    <EmailWorkflowsTemplateGrid
                        templates={templates}
                        selectedCategory={selectedCategory}
                        onPreview={handlePreviewTemplate}
                        onEdit={handleEditTemplate}
                        btnClass={btnClass}
                        t={t}
                    />
                </>
            )}

            {activeTab === 'approvals' && (
                <EmailWorkflowsApprovalQueue
                    approvals={approvals}
                    onReview={setShowApprovalModal}
                    btnClass={btnClass}
                    t={t}
                    radiusClass={radiusClass}
                />
            )}

            {showApprovalModal && (
                <EmailWorkflowsApprovalModal
                    approval={showApprovalModal}
                    comment={approvalComment}
                    isProcessing={isProcessingApproval}
                    onCommentChange={setApprovalComment}
                    onClose={closeApprovalModal}
                    onApprove={handleApproveEmail}
                    onReject={handleRejectEmail}
                    t={t}
                />
            )}

            {showPreviewModal && (
                <EmailWorkflowsPreviewModal
                    template={showPreviewModal}
                    onClose={() => setShowPreviewModal(null)}
                />
            )}

            {showEditModal && (
                <EmailWorkflowsEditModal
                    template={showEditModal}
                    editForm={editForm}
                    onChange={setEditForm}
                    onSave={handleSaveTemplate}
                    onClose={() => setShowEditModal(null)}
                />
            )}
        </div>
    );
}

export default EmailWorkflows;
