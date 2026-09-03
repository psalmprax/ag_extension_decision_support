import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { fetchSMSHistory, sendSMS, sendBulkSMS, translateMessage } from '../api/smsService';
import { fetchFarmers } from '../api/farmerService';
import { fetchUsage } from '../api/billingService';
import { ChannelOnboardingModal } from '../components/channels/ChannelOnboardingModal';
import { GoalModeCampaignModal } from '../components/campaigns/GoalModeCampaignModal';
import toast from 'react-hot-toast';
import type { Contact, SMSMessage } from './sms/types';
import { SMSComposerPanel } from './sms/ComposerPanel';
import { SMSContactsPanel } from './sms/ContactsPanel';
import { SMSRightPanel } from './sms/RightPanel';

export function SMSPage() {
  const { t, language } = useLanguage();
  const { pendingSMS, setPendingSMS } = useAppStore();
  const radiusClass = 'rounded-lg';

  // UI State
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [sendMode, setSendMode] = useState<'single' | 'bulk'>('single');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);

  const templates = [
    {
      id: '1',
      title: t('sms_template_greeting'),
      content: 'Hello, this is your GPExts officer. How is your crop doing?',
      icon: Sparkles,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      id: '2',
      title: t('sms_template_visit'),
      content: 'I will be visiting your farm tomorrow at 10 AM. Please be available.',
      icon: MapPin,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      id: '3',
      title: t('sms_template_alert'),
      content: 'URGENT: Heavy rain expected. Please take necessary precautions for your harvest.',
      icon: AlertTriangle,
      color: 'bg-rose-100 text-rose-600',
    },
  ];

  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);

  // Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isGatewaysOpen, setIsGatewaysOpen] = useState(false);
  const [isGoalModeOpen, setIsGoalModeOpen] = useState(false);

  // Status State

  const [response, setResponse] = useState<{ message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SMSMessage[]>([]);

  // Quota State - fetched from billing API
  const [quota, setQuota] = useState<{ current: number; limit: number; sent: number; failed: number } | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);

  // Fetch History
  const loadHistory = async () => {
    try {
      const data = await fetchSMSHistory();
      if (!data.success) throw new Error('SMS history request failed');
      setHistory(
        data.data.map(msg => ({
          id: msg.id,
          to: msg.recipient_phone,
          message: msg.message,
          status: msg.status === 'sent' ? 'success' : msg.status === 'failed' ? 'failed' : 'pending',
          timestamp: new Date(msg.created_at),
        }))
      );
    } catch (err) {
      console.error('Failed to fetch SMS history:', err);
      setHistory([]);
      toast.error('SMS history is unavailable');
    }
  };

  const loadContacts = async () => {
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
  };

  const loadQuota = async () => {
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
  };

  useEffect(() => {
    loadHistory();
    loadContacts();
    loadQuota();
  }, []);

  // Check for pending SMS on mount
  useEffect(() => {
    if (pendingSMS) {
      setPhoneNumber(pendingSMS.phone);
      setSendMode('single'); // Ensure we are in single mode to see the number
      setPendingSMS(null); // Clear it after consuming
    }
  }, [pendingSMS, setPendingSMS]);

  // Handle Translation
  const handleTranslate = async () => {
    if (!message) return;
    setIsTranslating(true);
    try {
      const res = await translateMessage({ text: message, targetLanguage: language });
      if (res.success) {
        setMessage(res.data.translatedText);
      }
    } catch (err) {
      console.error('Translation failed:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    setResponse(null);

    try {
      let res;
      if (sendMode === 'single') {
        res = await sendSMS({ to: phoneNumber, message, farmerId: selectedContact?.id });
      } else {
        const recipientList = recipients
          .split(',')
          .map(r => r.trim())
          .filter(r => r);
        res = await sendBulkSMS({ recipients: recipientList, message });
      }

      if (res.success) {
        setResponse({ message: t('sms_sent_success') || 'Message sent successfully!' });
        setPhoneNumber('');
        setRecipients('');
        setMessage('');
        loadHistory();
      } else {
        setError(res.error || 'Failed to send message');
      }
    } catch (err: unknown) {
      const e = err as
        | { response?: { data?: { message?: string } }; message?: string }
        | null
        | undefined;
      setError(e?.response?.data?.message || e?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const applyTemplate = (content: string) => {
    setMessage(content);
  };

  const selectContact = (contact: Contact) => {
    if (sendMode === 'bulk') {
      setBulkSelectedIds(prev =>
        prev.includes(contact.id) ? prev.filter(id => id !== contact.id) : [...prev, contact.id]
      );
    } else {
      setSelectedContact(contact);
      setPhoneNumber(contact.phone);
    }
  };

  const handleBulkSelectAll = () => {
    if (bulkSelectedIds.length === recentContacts.length) {
      setBulkSelectedIds([]);
    } else {
      setBulkSelectedIds(recentContacts.map(c => c.id));
    }
  };

  useEffect(() => {
    if (sendMode === 'bulk') {
      const selectedPhones = recentContacts
        .filter(c => bulkSelectedIds.includes(c.id))
        .map(c => c.phone)
        .join(', ');
      setRecipients(selectedPhones);
    }
  }, [bulkSelectedIds, sendMode, recentContacts]);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] overflow-y-auto lg:overflow-hidden gap-4 p-3.5 sm:p-4 lg:p-6 bg-slate-50 dark:bg-slate-950 pb-28 md:pb-6">
      {/* LEFT PANEL: Contacts & Search */}
      <SMSContactsPanel
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sendMode={sendMode}
        recentContacts={recentContacts}
        isLoadingContacts={isLoadingContacts}
        selectedContact={selectedContact}
        bulkSelectedIds={bulkSelectedIds}
        handleBulkSelectAll={handleBulkSelectAll}
        selectContact={selectContact}
        onAddRecipient={phone => setPhoneNumber(phone)}
        radiusClass={radiusClass}
      />

      {/* MIDDLE PANEL: Composer */}
      <SMSComposerPanel
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sendMode={sendMode}
        setSendMode={setSendMode}
        showRightPanel={showRightPanel}
        setShowRightPanel={setShowRightPanel}
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        recipients={recipients}
        setRecipients={setRecipients}
        message={message}
        setMessage={setMessage}
        isTranslating={isTranslating}
        handleTranslate={handleTranslate}
        response={response}
        error={error}
        isSending={isSending}
        handleSend={handleSend}
        history={history}
        radiusClass={radiusClass}
        onOpenGateways={() => setIsGatewaysOpen(true)}
        onOpenGoalMode={() => setIsGoalModeOpen(true)}
      />

      {/* RIGHT PANEL: Analytics & Utilities */}
      {showRightPanel && (
        <SMSRightPanel
          quota={quota || { current: 0, limit: 0, sent: 0, failed: 0 }}
          isLoadingQuota={isLoadingQuota}
          history={history}
          templates={templates}
          applyTemplate={applyTemplate}
          onClose={() => setShowRightPanel(false)}
          radiusClass={radiusClass}
        />
      )}

      {/* Channel Gateways & Farmer Onboarding Modal */}
      <ChannelOnboardingModal
        isOpen={isGatewaysOpen}
        onClose={() => setIsGatewaysOpen(false)}
      />

      {/* Goal Mode Autonomous Campaigns & Closed Loop Skills Modal */}
      <GoalModeCampaignModal
        isOpen={isGoalModeOpen}
        onClose={() => setIsGoalModeOpen(false)}
      />
    </div>
  );
}

export default SMSPage;
