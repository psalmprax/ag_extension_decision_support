import { useState } from 'react';
import type { Report } from '@/api/reportService';

export interface ConfirmModalData {
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    confirmText?: string;
}

export function useModalState() {
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
    const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
    const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportContent, setReportContent] = useState<string | null>(null);

    return {
        isNotificationPanelOpen, setIsNotificationPanelOpen,
        isProfileMenuOpen, setIsProfileMenuOpen,
        showProfileModal, setShowProfileModal,
        showSettingsPanel, setShowSettingsPanel,
        showHelpCenter, setShowHelpCenter,
        isDetailPanelOpen, setIsDetailPanelOpen,
        showVisitModal, setShowVisitModal,
        showFarmerModal, setShowFarmerModal,
        viewingReport, setViewingReport,
        showBulkSmsComposer, setShowBulkSmsComposer,
        bulkSmsMessage, setBulkSmsMessage,
        confirmModal, setConfirmModal,
        isBulkUpdateModalOpen, setIsBulkUpdateModalOpen,
        isUpdatingBulk, setIsUpdatingBulk,
        isLoadingReport, setIsLoadingReport,
        reportContent, setReportContent,
    };
}
