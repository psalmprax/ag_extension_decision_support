import React from 'react';
import { UserCheck, UserX } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Modal } from '@/components/Modal';
import type { EmailApproval } from '@/api/emailWorkflowService';

export function EmailWorkflowsApprovalModal({
  approval,
  comment,
  isProcessing,
  onCommentChange,
  onClose,
  onApprove,
  onReject,
  t,
}: {
  approval: EmailApproval;
  comment: string;
  isProcessing: boolean;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  t: (key: string) => string;
}) {
  return (
    <Modal title={t('email_workflows_review_email')} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('email_workflows_subject')}
          </label>
          <p className="text-gray-900 dark:text-white font-medium">{approval.emailData.subject}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('email_workflows_recipients')}
          </label>
          <p className="text-gray-900 dark:text-white">{approval.emailData.to.join(', ')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('email_workflows_content')}
          </label>
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-60 overflow-y-auto">
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(approval.emailData.html) }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('email_workflows_review_comment')}
          </label>
          <textarea
            value={comment}
            onChange={e => onCommentChange(e.target.value)}
            placeholder={t('email_workflows_add_comment')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4" />
            {isProcessing ? t('email_workflows_approving') : t('email_workflows_approve_send')}
          </button>
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <UserX className="w-4 h-4" />
            {isProcessing ? t('email_workflows_rejecting') : t('email_workflows_reject')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
