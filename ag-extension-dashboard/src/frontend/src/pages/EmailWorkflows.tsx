import React, { useState } from 'react';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useResourceLoader } from '@/hooks/useResourceLoader';
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
  const { headingClass, radiusClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();

  // Resource loader encapsulates the category-filter + parallel-fetch + refresh
  // state machine shared with Memory.tsx (see audit dup:73594d16).
  type EmailResources = { templates: EmailTemplate[]; approvals: EmailApproval[] };
  const loader = useResourceLoader<EmailResources>({
    load: async category => ({
      templates: await fetchEmailTemplates(category),
      approvals: await fetchPendingApprovals(),
    }),
    errorMessage: t('email_workflows_failed_load'),
  });
  const templates = loader.data.templates ?? [];
  const approvals = loader.data.approvals ?? [];
  const { selectedCategory, setSelectedCategory, isLoading, isRefreshing, reload, refresh } =
    loader;

  // Modal + per-row processing state (unrelated to loader).
  const [activeTab, setActiveTab] = useState<'templates' | 'approvals'>('templates');
  const [showApprovalModal, setShowApprovalModal] = useState<EmailApproval | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  // Tracks which approvals are mid-flight so the row disables its 3 action buttons
  // (Review / Quick Approve / Quick Reject) and prevents double-fire races.
  const [processingApprovals, setProcessingApprovals] = useState<Set<string>>(new Set());

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

  const dispatchApproval = async (
    approval: EmailApproval,
    action: 'approve' | 'reject',
    comment?: string
  ) => {
    setProcessingApprovals(prev => {
      const next = new Set(prev);
      next.add(approval.id);
      return next;
    });
    try {
      const res =
        action === 'approve'
          ? await approveEmail(approval.id, comment)
          : await rejectEmail(approval.id, comment);
      if (res.success) {
        addNotification({
          type: 'success',
          message:
            action === 'approve' ? t('email_workflows_approved') : t('email_workflows_rejected'),
        });
        // If the user happened to have the modal open for this approval, close it
        // so the list refresh doesn't leave a stale modal pointing at a row that
        // is now resolved.
        if (showApprovalModal?.id === approval.id) {
          setShowApprovalModal(null);
          setApprovalComment('');
        }
        reload();
      } else {
        addNotification({
          type: 'error',
          message:
            action === 'approve' ? 'Failed to approve email' : t('email_workflows_failed_reject'),
        });
      }
    } catch (error) {
      console.error(`Failed to ${action} email:`, error);
      addNotification({
        type: 'error',
        message:
          action === 'approve' ? 'Failed to approve email' : t('email_workflows_failed_reject'),
      });
    } finally {
      setProcessingApprovals(prev => {
        const next = new Set(prev);
        next.delete(approval.id);
        return next;
      });
      if (showApprovalModal?.id === approval.id) {
        setIsProcessingApproval(false);
      }
    }
  };

  const handleApproveEmail = () => {
    if (!showApprovalModal) return;
    setIsProcessingApproval(true);
    dispatchApproval(showApprovalModal, 'approve', approvalComment || undefined);
  };

  const handleRejectEmail = () => {
    if (!showApprovalModal) return;
    setIsProcessingApproval(true);
    dispatchApproval(showApprovalModal, 'reject', approvalComment || undefined);
  };

  const handleQuickApprove = (approval: EmailApproval) =>
    dispatchApproval(approval, 'approve', 'Quick approve');

  const handleQuickReject = (approval: EmailApproval) =>
    dispatchApproval(approval, 'reject', 'Quick reject');

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
    return (
      <LoadingHeaderSkeleton
        title="Email Workflow Manager"
        description="Manage email templates and approval workflows"
      />
    );
  }

  return (
    <div className="space-y-6">
      <EmailWorkflowsHeader
        headingClass={headingClass}
        subtitle={t('email_workflows_subtitle')}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
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
          onQuickApprove={handleQuickApprove}
          onQuickReject={handleQuickReject}
          processingApprovals={processingApprovals}
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
