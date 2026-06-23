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

const executeEscapeHandlers = (options: ShortcutOptions) => {
    const escapeHandlers = [
        { condition: options.isNotificationPanelOpen, action: () => options.setIsNotificationPanelOpen(false) },
        { condition: options.isProfileMenuOpen, action: () => options.setIsProfileMenuOpen(false) },
        { condition: options.showProfileModal, action: () => options.setShowProfileModal(false) },
        { condition: options.showSettingsPanel, action: () => options.setShowSettingsPanel(false) },
        { condition: options.showHelpCenter, action: () => options.setShowHelpCenter(false) },
        { condition: options.isDetailPanelOpen, action: () => options.setIsDetailPanelOpen(false) },
        { condition: options.showVisitModal, action: () => options.setShowVisitModal(false) },
        { condition: options.showFarmerModal, action: () => options.setShowFarmerModal(false) },
        { condition: options.showGlobalSearch, action: () => options.setShowGlobalSearch(false) },
        { condition: !!options.viewingReport, action: () => options.setViewingReport(null) },
        { condition: options.showBulkSmsComposer, action: () => options.setShowBulkSmsComposer(false) },
        { condition: !!options.confirmModal, action: () => options.setConfirmModal(null) },
    ];

    for (const handler of escapeHandlers) {
        if (handler.condition) {
            handler.action();
            break;
        }
    }
};

const handleAppKeyDown = (e: KeyboardEvent, options: ShortcutOptions) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            options.setShowGlobalSearch(true);
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        options.setSidebarOpen(!options.sidebarOpen);
        return;
    }

    if (e.key === 'Escape') {
        executeEscapeHandlers(options);
    }
};

export const useAppShortcuts = (options: ShortcutOptions) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => handleAppKeyDown(e, options);
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [options]);
};
