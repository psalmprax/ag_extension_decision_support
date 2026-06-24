import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import DOMPurify from 'dompurify';
import type { EmailApproval } from '@/api/emailWorkflowService';

export function EmailWorkflowsApprovalQueue({
    approvals,
    onReview,
    onQuickApprove,
    onQuickReject,
    processingApprovals,
    btnClass,
    t,
    radiusClass,
}: {
    approvals: EmailApproval[];
    onReview: (approval: EmailApproval) => void;
    onQuickApprove: (approval: EmailApproval) => void;
    onQuickReject: (approval: EmailApproval) => void;
    processingApprovals: Set<string>;
    btnClass: string;
    t: (key: string) => string;
    radiusClass: string;
}) {
    return (
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

                            <div className={`bg-gray-50 dark:bg-gray-800/50 ${radiusClass} p-4 mb-4`}>
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
                                    onClick={() => onReview(approval)}
                                    disabled={processingApprovals.has(approval.id)}
                                    className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
                                >
                                    <Eye className="w-4 h-4" />
                                    Review
                                </button>
                                <button
                                    onClick={() => onQuickApprove(approval)}
                                    disabled={processingApprovals.has(approval.id)}
                                    className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white ${btnClass} hover:bg-green-700 disabled:opacity-50`}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Quick Approve
                                </button>
                                <button
                                    onClick={() => onQuickReject(approval)}
                                    disabled={processingApprovals.has(approval.id)}
                                    className={`flex items-center gap-2 px-4 py-2 bg-red-600 text-white ${btnClass} hover:bg-red-700 disabled:opacity-50`}
                                >
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
    );
}
