import apiClient from './client';

/** An alert waiting for the officer before farmers hear (crop stress seen from space, a possible outbreak). */
export interface AlertToReview {
  id: string;
  type: 'crop_stress' | 'outbreak';
  severity: string | null;
  title: string;
  description: string | null;
  triggered_at: string;
  /** How many of the farmers named are the officer's own (all of them, for an administrator). */
  my_farmers: number;
}

export interface SentReview {
  alertId: string;
  farmers: number;
  /** False while texting farmers is switched off on the server (FARMER_ALERTS_ENABLED). */
  textingOn: boolean;
}

export const REVIEW_MESSAGE_MAX = 300;

export const alertReviewService = {
  async list(): Promise<AlertToReview[]> {
    const { data } = await apiClient.get('/v1/alerts/review');
    return data.data;
  },

  async send(alertId: string, message: string): Promise<SentReview> {
    const { data } = await apiClient.post(`/v1/alerts/${alertId}/send-to-farmers`, { message });
    return data.data;
  },

  async dismiss(alertId: string): Promise<void> {
    await apiClient.patch(`/v1/alerts/${alertId}/resolve`);
  },
};
