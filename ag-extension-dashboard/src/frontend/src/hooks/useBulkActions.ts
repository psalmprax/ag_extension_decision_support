import { useState } from 'react';
import { Farmer } from '../types/dashboard';
import { sendBulkSMS } from '@/api/smsService';
import { createFarmer, fetchFarmers, updateFarmers } from '@/api/farmerService';
import { saveBlob } from '@/lib/saveBlob';

interface ConfirmModalData {
  title: string;
  message: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
}

interface NotificationData {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface BulkActionsOptions {
  effectiveFarmers: Farmer[];
  selectedFarmers: Set<string>;
  setSelectedFarmers: (selected: Set<string>) => void;
  addNotification: (notif: NotificationData) => void;
  setActiveTab: (tab: string) => void;
  setShowBulkSmsComposer: (open: boolean) => void;
  setConfirmModal: (modal: ConfirmModalData | null) => void;
  setIsUpdatingBulk: (updating: boolean) => void;
  setIsBulkUpdateModalOpen: (open: boolean) => void;
  removeFarmers: (ids: string[]) => Promise<void>;
  setFarmerList: (farmers: Farmer[]) => void;
}

export const useBulkActions = (options: BulkActionsOptions) => {
  const {
    effectiveFarmers,
    selectedFarmers,
    setSelectedFarmers,
    addNotification,
    setActiveTab,
    setShowBulkSmsComposer,
    setConfirmModal,
    setIsUpdatingBulk,
    setIsBulkUpdateModalOpen,
    removeFarmers,
    setFarmerList,
  } = options;

  const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);

  const handleSelectFarmer = (farmerId: string, checked: boolean) => {
    const newSelected = new Set(selectedFarmers);
    if (checked) {
      newSelected.add(farmerId);
    } else {
      newSelected.delete(farmerId);
    }
    setSelectedFarmers(newSelected);
  };

  const handleSelectAllFarmers = (checked: boolean) => {
    if (checked && effectiveFarmers) {
      setSelectedFarmers(new Set(effectiveFarmers.map(f => f.id)));
    } else {
      setSelectedFarmers(new Set());
    }
  };

  const handleBulkSMS = () => {
    if (selectedFarmers.size > 0) {
      setShowBulkSmsComposer(true);
    }
  };

  const onBulkSmsSend = async (message: string) => {
    const selectedFarmersList = effectiveFarmers?.filter(f => selectedFarmers.has(f.id)) || [];
    if (selectedFarmersList.length > 0) {
      // Only farmers with a phone number can be messaged; count and report those.
      const recipients = selectedFarmersList.map(f => f.phone?.trim()).filter((p): p is string => Boolean(p));
      const skipped = selectedFarmersList.length - recipients.length;
      if (recipients.length === 0) {
        addNotification({ type: 'warning', message: 'None of the selected farmers has a phone number. No SMS was sent.' });
        return;
      }
      setIsSendingBulkSms(true);
      try {
        await sendBulkSMS({ recipients, message });
        setActiveTab('sms');
        setSelectedFarmers(new Set());
        setShowBulkSmsComposer(false);
        addNotification({
          type: 'success',
          message:
            `Bulk SMS sent to ${recipients.length} farmer${recipients.length === 1 ? '' : 's'}.` +
            (skipped > 0 ? ` ${skipped} without a phone number ${skipped === 1 ? 'was' : 'were'} skipped.` : ''),
        });
      } catch (error) {
        console.error('Bulk SMS error:', error);
        addNotification({
          type: 'error',
          message: 'Error connecting to SMS service.',
        });
      } finally {
        setIsSendingBulkSms(false);
      }
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedFarmers);
    if (ids.length === 0) return;

    setConfirmModal({
      title: 'Delete Farmers',
      message: `Are you sure you want to delete ${ids.length} farmers? This action cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete All',
      onConfirm: async () => {
        setConfirmModal(null);
        const farmersToRestore = effectiveFarmers?.filter(f => selectedFarmers.has(f.id)) || [];

        try {
          await removeFarmers(ids);
          setSelectedFarmers(new Set());

          addNotification({
            type: 'success',
            message: `Deleted ${ids.length} farmers.`,
            actionLabel: 'Undo',
            onAction: async () => {
              for (const farmer of farmersToRestore) {
                await createFarmer(farmer);
              }
              const refreshed = await fetchFarmers();
              setFarmerList(refreshed.data.farmers || []);
              setSelectedFarmers(new Set());
            },
          });
        } catch (error) {
          console.error('Bulk delete error:', error);
          addNotification({
            type: 'error',
            message: 'Failed to delete some farmers.',
          });
        }
      },
    });
  };

  const onBulkUpdateFarmers = async (updates: Partial<Farmer>) => {
    const ids = Array.from(selectedFarmers);
    if (ids.length > 0) {
      setIsUpdatingBulk(true);
      try {
        await updateFarmers(ids, updates);
        setSelectedFarmers(new Set());
        setIsBulkUpdateModalOpen(false);
        addNotification({
          type: 'success',
          message: `Bulk update applied to ${ids.length} farmers.`,
        });
      } catch (error) {
        console.error('Bulk update error:', error);
        addNotification({
          type: 'error',
          message: 'Error applying bulk update.',
        });
      } finally {
        setIsUpdatingBulk(false);
      }
    }
  };

  /** Export the selected farmers, or everyone listed when nothing is selected. */
  const handleBulkExport = () => {
    const selectedFarmersList = effectiveFarmers?.filter(f => selectedFarmers.has(f.id)) || [];
    const list = selectedFarmersList.length > 0 ? selectedFarmersList : effectiveFarmers || [];
    if (list.length === 0) return;
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csvContent = [
      ['Name', 'Phone', 'Region', 'Village', 'Crops', 'Farm size (ha)'],
      ...list.map(f => [
        `${f.firstName} ${f.lastName}`,
        f.phone || '',
        f.region || '',
        f.village || '',
        f.crops?.join(', ') || '',
        f.farmSize?.toString() || '',
      ]),
    ]
      .map(row => row.map(cell).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    saveBlob(blob, `farmers_export_${new Date().toISOString().split('T')[0]}.csv`);
    setSelectedFarmers(new Set());
    addNotification({ type: 'success', message: `Exported ${list.length} farmers to CSV` });
  };

  return {
    isSendingBulkSms,
    handleSelectFarmer,
    handleSelectAllFarmers,
    handleBulkSMS,
    onBulkSmsSend,
    handleBulkDelete,
    onBulkUpdateFarmers,
    handleBulkExport,
  };
};
