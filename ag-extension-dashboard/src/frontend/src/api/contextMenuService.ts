import apiClient from './client';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: string;
  separator?: boolean;
}

export interface ContextMenuSection {
  id: string;
  title?: string;
  items: ContextMenuItem[];
}

export interface ContextMenuData {
  entityType: string;
  entityId?: string;
  sections: ContextMenuSection[];
}

export const fetchContextMenu = async (
  entityType: string,
  entityId?: string,
  isBulk = false
): Promise<{ success: boolean; data: ContextMenuData }> => {
  const url = isBulk
    ? `/context-menus/bulk/${entityType}`
    : `/context-menus/${entityType}/${entityId}`;
  const { data } = await apiClient.get(url);
  return data;
};

export const getStaticFallbackMenu = (entityType: string): ContextMenuData => {
  const fallbackMenus: Record<string, ContextMenuData> = {
    farmer: {
      entityType: 'farmer',
      sections: [
        {
          id: 'primary',
          title: 'Actions',
          items: [
            { id: 'view', label: 'View Details', icon: 'eye', action: 'view_farmer' },
            { id: 'edit', label: 'Edit', icon: 'edit', action: 'edit_farmer' },
            { id: 'share', label: 'Share', icon: 'share', action: 'share_farmer' },
            { id: 'export', label: 'Export CSV', icon: 'download', action: 'export_farmer' },
          ],
        },
        {
          id: 'danger',
          items: [{ id: 'delete', label: 'Delete', icon: 'trash', action: 'delete_farmer' }],
        },
      ],
    },
    visit: {
      entityType: 'visit',
      sections: [
        {
          id: 'primary',
          title: 'Actions',
          items: [
            { id: 'view', label: 'View Details', icon: 'eye', action: 'view_visit' },
            { id: 'reschedule', label: 'Reschedule', icon: 'calendar', action: 'reschedule_visit' },
            {
              id: 'complete',
              label: 'Mark Complete',
              icon: 'check-square',
              action: 'complete_visit',
            },
          ],
        },
      ],
    },
    report: {
      entityType: 'report',
      sections: [
        {
          id: 'primary',
          title: 'Actions',
          items: [
            { id: 'view', label: 'View Report', icon: 'eye', action: 'view_report' },
            { id: 'download', label: 'Download', icon: 'download', action: 'download_report' },
          ],
        },
      ],
    },
  };

  return (
    fallbackMenus[entityType] || {
      entityType,
      sections: [
        {
          id: 'default',
          items: [{ id: 'view', label: 'View', icon: 'eye', action: `view_${entityType}` }],
        },
      ],
    }
  );
};
