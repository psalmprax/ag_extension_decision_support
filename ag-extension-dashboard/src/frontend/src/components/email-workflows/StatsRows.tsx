import React from 'react';
import { Mail, Clock, Filter, AlertTriangle } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import type { EmailTemplate, EmailApproval } from '@/api/emailWorkflowService';

export function EmailWorkflowsStatsRows({
    templates,
    approvals,
    categories,
    t,
}: {
    templates: EmailTemplate[];
    approvals: EmailApproval[];
    categories: string[];
    t: (key: string) => string;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
                title={t('email_workflows_templates')}
                value={templates.length}
                icon={Mail}
                color="blue"
            />
            <MetricCard
                title={t('email_workflows_pending_approvals')}
                value={approvals.length}
                icon={Clock}
                color="yellow"
            />
            <MetricCard
                title={t('email_workflows_categories')}
                value={categories.length}
                icon={Filter}
                color="green"
            />
            <MetricCard
                title={t('email_workflows_total_variables')}
                value={templates.reduce((acc, item) => acc + item.variables.length, 0)}
                icon={AlertTriangle}
                color="purple"
            />
        </div>
    );
}
