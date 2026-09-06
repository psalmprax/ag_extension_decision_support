import React from 'react';
import { Users, CheckCircle, Loader2, Search, Plus } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import toast from 'react-hot-toast';
import type { Contact } from './types';
import { ContactListItem } from './ContactListItem';

export function SMSContactsPanel({
  searchQuery,
  setSearchQuery,
  sendMode,
  recentContacts,
  isLoadingContacts,
  selectedContact,
  bulkSelectedIds,
  handleBulkSelectAll,
  selectContact,
  onAddRecipient,
  radiusClass,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sendMode: 'single' | 'bulk';
  recentContacts: Contact[];
  isLoadingContacts: boolean;
  selectedContact: Contact | null;
  bulkSelectedIds: string[];
  handleBulkSelectAll: () => void;
  selectContact: (c: Contact) => void;
  onAddRecipient: (phone: string) => void;
  radiusClass: string;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="w-full lg:w-1/4 backdrop-blur-xl bg-slate-900/60 rounded-xl border border-white/10 flex flex-col shadow-xl"
    >
      <div className="p-4 border-b border-white/5">
        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          {t('sms_recent_recipients') || 'Recipients & Cohorts'}
        </h2>
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input
              type="text"
              placeholder={t('farmer_search_placeholder') || 'Search recipients...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white/[0.03] border border-white/10 rounded-xl focus:ring-1 focus:ring-emerald-400 text-xs text-white placeholder-white/30 outline-none"
            />
          </div>
          {sendMode === 'bulk' && (
            <button
              onClick={handleBulkSelectAll}
              className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
              title="Select All"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 max-h-60 lg:max-h-none overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {isLoadingContacts ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          </div>
        ) : (
          recentContacts
            .filter(
              c =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.phone.includes(searchQuery)
            )
            .map(contact => (
              <ContactListItem
                key={contact.id}
                contact={contact}
                isSelected={
                  (sendMode === 'single' && selectedContact?.id === contact.id) ||
                  (sendMode === 'bulk' && bulkSelectedIds.includes(contact.id))
                }
                onClick={() => selectContact(contact)}
                radiusClass={radiusClass}
              />
            ))
        )}
        {!isLoadingContacts && recentContacts.length === 0 && (
          <div className="text-center py-10 text-white/30 text-xs uppercase font-bold tracking-widest">
            No contacts found
          </div>
        )}
      </div>

      <div className="p-3.5 border-t border-white/5">
        <button
          onClick={() => {
            if (selectedContact) {
              onAddRecipient(selectedContact.phone);
              toast.success(`Added ${selectedContact.name} as recipient`);
            } else {
              toast.error('Select a contact first');
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-white/[0.04] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-white/80 hover:text-emerald-300 rounded-xl text-xs font-bold transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('common_add') || 'Add Recipient'}
        </button>
      </div>
    </div>
  );
}
