import { useAppStore } from '@/store/useAppStore';
import { useAppModalState } from './useAppModalState';

export function useAppMenuActions() {
    const {
        farmers: storeFarmers,
        addNotification,
        showShareModal,
        removeFarmer,
    } = useAppStore();

    const { setShowVisitModal, setConfirmModal } = useAppModalState();

    const handleShare = (action: string, entityId?: string) => {
        const type = action.split('_')[1];
        const entity = storeFarmers?.find(f => f.id === entityId);
        showShareModal({
            entityType: type, entityId: entityId || '',
            entityName: entity ? `${entity.firstName} ${entity.lastName}` : undefined
        });
    };

    const handleExport = (_action: string, entityId?: string) => {
        if (entityId) {
            const farmer = storeFarmers?.find(f => f.id === entityId);
            if (farmer) {
                const csvContent = [
                    ['Name', 'Phone', 'Region', 'Village', 'Crops', 'Farm Size (ha)'],
                    [`"${farmer.firstName} ${farmer.lastName}"`, `"${farmer.phone || ''}"`, `"${farmer.region || ''}"`, `"${farmer.village || ''}"`, `"${farmer.crops?.join(', ') || ''}"`, `"${farmer.farmSize?.toString() || ''}"`]
                ].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `farmer_${entityId}_export.csv`; a.click();
                URL.revokeObjectURL(url);
                addNotification({ type: 'success', message: 'Farmer data exported successfully' });
            }
        }
    };

    const handleDelete = (action: string, entityId?: string) => {
        setConfirmModal({
            title: 'Confirm Action', message: `Are you sure you want to perform this action: ${action}?`,
            variant: 'danger', confirmText: 'Delete',
            onConfirm: () => {
                setConfirmModal(null);
                if (action.startsWith('farmer') && entityId) {
                    removeFarmer(entityId);
                    addNotification({ type: 'success', message: 'Farmer record deleted successfully' });
                } else {
                    addNotification({ type: 'info', message: 'Action executed successfully' });
                }
            }
        });
    };

    const handleMenuAction = (action: string, entityId?: string) => {
        if (action.startsWith('share_')) {
            handleShare(action, entityId);
        } else if (action === 'schedule_visit') {
            setShowVisitModal(true);
        } else if (action === 'export_farmer' || action.startsWith('export_')) {
            handleExport(action, entityId);
        } else if (action.includes('delete')) {
            handleDelete(action, entityId);
        }
    };

    return { handleMenuAction };
}
