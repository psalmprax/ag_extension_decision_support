import { useState, useCallback } from 'react';
import { Report } from '@/api/reportService';

export interface ConfirmModalState {
  title: string;
  message: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
}

export function useAppModalState() {
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [showBulkSmsComposer, setShowBulkSmsComposer] = useState(false);
  const [bulkSmsMessage, setBulkSmsMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);

  const openFarmerDetail = useCallback(() => setIsDetailPanelOpen(true), []);
  const closeFarmerDetail = useCallback(() => setIsDetailPanelOpen(false), []);

  return {
    isNotificationPanelOpen,
    setIsNotificationPanelOpen,
    isProfileMenuOpen,
    setIsProfileMenuOpen,
    showProfileModal,
    setShowProfileModal,
    showSettingsPanel,
    setShowSettingsPanel,
    showHelpCenter,
    setShowHelpCenter,
    isDetailPanelOpen,
    setIsDetailPanelOpen,
    showVisitModal,
    setShowVisitModal,
    showFarmerModal,
    setShowFarmerModal,
    viewingReport,
    setViewingReport,
    showBulkSmsComposer,
    setShowBulkSmsComposer,
    bulkSmsMessage,
    setBulkSmsMessage,
    confirmModal,
    setConfirmModal,
    openFarmerDetail,
    closeFarmerDetail,
  };
}
