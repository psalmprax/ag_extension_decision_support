import apiClient from './client';

export interface EmailTemplate {
  id: string;
  name: string;
  displayName?: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  createdBy?: string;
  createdAt?: string;
}

export interface EmailApproval {
  id: string;
  emailData: {
    to: string[];
    subject: string;
    html: string;
    templateId?: string;
  };
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
}

export const fetchEmailTemplates = async (
  category?: string
): Promise<{ success: boolean; data: EmailTemplate[] }> => {
  const url = category ? `/email/templates?category=${category}` : '/email/templates';
  const response = await apiClient.get(url);
  return response.data;
};

export const fetchPendingApprovals = async (): Promise<{
  success: boolean;
  data: EmailApproval[];
}> => {
  const response = await apiClient.get('/email/approvals/pending');
  return response.data;
};

export const approveEmail = async (
  approvalId: string,
  comment?: string
): Promise<{ success: boolean }> => {
  const response = await apiClient.post(`/email/approvals/${approvalId}/approve`, { comment });
  return response.data;
};

export const rejectEmail = async (
  approvalId: string,
  comment?: string
): Promise<{ success: boolean }> => {
  const response = await apiClient.post(`/email/approvals/${approvalId}/reject`, { comment });
  return response.data;
};
