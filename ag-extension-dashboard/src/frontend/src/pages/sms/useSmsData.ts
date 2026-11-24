import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchSMSHistory } from '@/api/smsService';
import { fetchFarmers } from '@/api/farmerService';
import { fetchUsage } from '@/api/billingService';
import type { Contact, SMSHistoryRecord, SMSMessage } from './types';

const normalizeSmsHistory = (msg: SMSHistoryRecord): SMSMessage => ({
  id: msg.id,
  to: msg.recipient_phone,
  message: msg.message,
  status:
    msg.status === 'sent' || msg.status === 'delivered'
      ? 'success'
      : msg.status === 'failed'
        ? 'failed'
        : 'pending',
  timestamp: new Date(msg.created_at || Date.now()),
});

/** What the SMS page shows: sent messages, the farmers to text, and this month's SMS quota. */
export function useSmsData() {
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [history, setHistory] = useState<SMSMessage[]>([]);

  // Quota, fetched from the billing API
  const [quota, setQuota] = useState<{
    current: number;
    limit: number;
    sent: number;
    failed: number;
  } | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);

  // Fetch History
  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchSMSHistory();
      if (!data.success) throw new Error('SMS history request failed');
      setHistory(data.data.map(normalizeSmsHistory));
    } catch (err) {
      console.error('Failed to fetch SMS history:', err);
      setHistory([]);
      toast.error('SMS history is unavailable');
    }
  }, []);


  const loadContacts = useCallback(async () => {
    setIsLoadingContacts(true);
    try {
      const res = await fetchFarmers();
      if (!res.success) throw new Error('Farmer contacts request failed');
      setRecentContacts(
        res.data.farmers.map(f => ({
          id: f.id,
          name: `${f.firstName} ${f.lastName}`,
          phone: f.phone || '',
        }))
      );
    } catch (err) {
      console.error('Failed to fetch farmers for SMS contacts:', err);
      setRecentContacts([]);
      toast.error('Farmer contacts are unavailable');
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  const loadQuota = useCallback(async () => {
    setIsLoadingQuota(true);
    try {
      const data = await fetchUsage();
      const usageData = data?.success ? data.data : null;
      const smsUsage = Array.isArray(usageData)
        ? usageData.find((u: { type: string }) => u.type === 'sms' || u.type === 'SMS')
        : usageData;
      if (!smsUsage) {
        setQuota(null);
        return;
      }
      setQuota({
        current: typeof smsUsage.current === 'number' ? smsUsage.current : 0,
        limit: typeof smsUsage.limit === 'number' ? smsUsage.limit : 0,
        sent: typeof smsUsage.sent === 'number' ? smsUsage.sent : 0,
        failed: typeof smsUsage.failed === 'number' ? smsUsage.failed : 0,
      });
    } catch (err) {
      console.error('Failed to fetch SMS quota:', err);
      setQuota(null);
      toast.error('SMS quota is unavailable');
    } finally {
      setIsLoadingQuota(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadContacts();
    loadQuota();
  }, [loadHistory, loadContacts, loadQuota]);

  return { history, loadHistory, recentContacts, isLoadingContacts, quota, isLoadingQuota };
}
