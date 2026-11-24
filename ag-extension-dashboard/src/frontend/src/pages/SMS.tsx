import React, { useState, useEffect } from 'react';
import { MessageSquare, MapPin, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { sendSMS, sendBulkSMS, translateMessage } from '../api/smsService';
import { ChannelOnboardingModal } from '../components/channels/ChannelOnboardingModal';
import { GoalModeCampaignModal } from '../components/campaigns/GoalModeCampaignModal';
import toast from 'react-hot-toast';
import type { Contact } from './sms/types';
import { useSmsData } from './sms/useSmsData';
import { SMSComposerPanel } from './sms/ComposerPanel';
import { SMSContactsPanel } from './sms/ContactsPanel';
import { SMSRightPanel } from './sms/RightPanel';
import { PageHeader } from '@/components/ui/PageHeader';

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
      icon: MessageSquare,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      id: '2',
      title: t('sms_template_visit'),
      content: 'I will be visiting your farm tomorrow at 10 AM. Please be available.',
      icon: MapPin,
      color: 'bg-slate-100 text-slate-600',
    },
    {
      id: '3',
      title: t('sms_template_alert'),
      content: 'Heavy rain is forecast for your area. Please take precautions to protect your harvest.',
      icon: AlertTriangle,
      color: 'bg-rose-100 text-rose-600',
    },
  ];


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
  const { history, loadHistory, recentContacts, isLoadingContacts, quota, isLoadingQuota } = useSmsData();

  // Check for pending SMS on mount
  useEffect(() => {
    if (pendingSMS) {
      if (pendingSMS.phone) setPhoneNumber(pendingSMS.phone);
      if (pendingSMS.message) setMessage(pendingSMS.message);
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
      } else {
        toast.error(
          (res as { error?: string }).error || 'Translation was not accepted by the server'
        );
      }
    } catch (err) {
      console.error('Translation failed:', err);
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (err as Error)?.message ||
          'Translation failed'
      );
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
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] bg-slate-50 dark:bg-theme-bg-primary">
    <PageHeader className="px-3.5 sm:px-4 lg:px-6 pt-3.5 sm:pt-4 lg:pt-6" title={t('nav_sms', { defaultValue: 'SMS' })} description={t('sms_page_desc', { defaultValue: 'Send advice and alerts by text message to one farmer or many.' })} />
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden gap-4 p-3.5 sm:p-4 lg:p-6 pb-28 md:pb-6">
      <SMSContactsPanel searchQuery={searchQuery} setSearchQuery={setSearchQuery} sendMode={sendMode} recentContacts={recentContacts} isLoadingContacts={isLoadingContacts}
        selectedContact={selectedContact} bulkSelectedIds={bulkSelectedIds} handleBulkSelectAll={handleBulkSelectAll} selectContact={selectContact}
        onAddRecipient={phone => setPhoneNumber(phone)} radiusClass={radiusClass} />

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
      <ChannelOnboardingModal isOpen={isGatewaysOpen} onClose={() => setIsGatewaysOpen(false)} />

      {/* Goal Mode Autonomous Campaigns & Closed Loop Skills Modal */}
      <GoalModeCampaignModal isOpen={isGoalModeOpen} onClose={() => setIsGoalModeOpen(false)} />
    </div>
    </div>
  );
}

export default SMSPage;
