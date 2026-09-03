export interface SMSHistoryRecord {
  id: string;
  sender_id?: string | null;
  recipient_phone: string;
  farmer_id?: string | null;
  message: string;
  status: string | null;
  provider?: string | null;
  created_at: string | null;
}

export interface SMSMessage {
  id: string;
  to: string;
  message: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  lastSeen?: string;
}
