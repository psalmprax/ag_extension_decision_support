import { useEffect } from 'react';
import type { Report } from '@/api/reportService';
import type { ConfirmModalState } from './useAppModalState';

interface ShortcutOptions {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    isNotificationPanelOpen: boolean;
    setIsNotificationPanelOpen: (open: boolean) => void;
    isProfileMenuOpen: boolean;
    setIsProfileMenuOpen: (open: boolean) => void;
    showProfileModal: boolean;
    setShowProfileModal: (show: boolean) => void;
    showSettingsPanel: boolean;
    setShowSettingsPanel: (show: boolean) => void;
    showHelpCenter: boolean;
    setShowHelpCenter: (show: boolean) => void;
    isDetailPanelOpen: boolean;
    setIsDetailPanelOpen: (open: boolean) => void;
    showVisitModal: boolean;
    setShowVisitModal: (show: boolean) => void;
    showFarmerModal: boolean;
    setShowFarmerModal: (show: boolean) => void;
    showGlobalSearch: boolean;
    setShowGlobalSearch: (show: boolean) => void;
    viewingReport: Report | null;
    setViewingReport: (report: Report | null) => void;
    showBulkSmsComposer: boolean;
    setShowBulkSmsComposer: (open: boolean) => void;
    confirmModal: ConfirmModalState | null;
    setConfirmModal: (modal: ConfirmModalState | null) => void;
}

export const useAppShortcuts = (options: ShortcutOptions) => {
    const {
        sidebarOpen, setSidebarOpen,
        isNotificationPanelOpen, setIsNotificationPanelOpen,
        isProfileMenuOpen, setIsProfileMenuOpen,
        showProfileModal, setShowProfileModal,
        showSettingsPanel, setShowSettingsPanel,
        showHelpCenter, setShowHelpCenter,
        isDetailPanelOpen, setIsDetailPanelOpen,
        showVisitModal, setShowVisitModal,
        showFarmerModal, setShowFarmerModal,
        showGlobalSearch, setShowGlobalSearch,
        viewingReport, setViewingReport,
        showBulkSmsComposer, setShowBulkSmsComposer,
        confirmModal, setConfirmModal
    } = options;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                if (searchInput) {
                    searchInput.focus();
                    setShowGlobalSearch(true);
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                setSidebarOpen(!sidebarOpen);
            }
            if (e.key === 'Escape') {
                if (isNotificationPanelOpen) setIsNotificationPanelOpen(false);
                else if (isProfileMenuOpen) setIsProfileMenuOpen(false);
                else if (showProfileModal) setShowProfileModal(false);
                else if (showSettingsPanel) setShowSettingsPanel(false);
                else if (showHelpCenter) setShowHelpCenter(false);
                else if (isDetailPanelOpen) setIsDetailPanelOpen(false);
                else if (showVisitModal) setShowVisitModal(false);
                else if (showFarmerModal) setShowFarmerModal(false);
                else if (showGlobalSearch) setShowGlobalSearch(false);
                else if (viewingReport) setViewingReport(null);
                else if (showBulkSmsComposer) setShowBulkSmsComposer(false);
                else if (confirmModal) setConfirmModal(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        isNotificationPanelOpen, isProfileMenuOpen, showProfileModal, showSettingsPanel, showHelpCenter,
        isDetailPanelOpen, showVisitModal, showFarmerModal, showGlobalSearch, viewingReport,
        showBulkSmsComposer, confirmModal, sidebarOpen, setSidebarOpen, setShowGlobalSearch,
        setViewingReport, setShowBulkSmsComposer, setConfirmModal, setIsNotificationPanelOpen,
        setIsProfileMenuOpen, setShowProfileModal, setShowSettingsPanel, setShowHelpCenter,
        setIsDetailPanelOpen, setShowVisitModal, setShowFarmerModal
    ]);
};
