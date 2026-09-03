// Shared SMS types moved verbatim from pages/SMS.tsx (pure move).

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
