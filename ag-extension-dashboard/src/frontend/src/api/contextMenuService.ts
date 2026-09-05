import apiClient from './client';
import { isDemoId } from '@/demo/demoIds';

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

export const getDefaultContextMenu = (
  entityType: string,
  entityId?: string,
  isBulk = false
): ContextMenuData => {
  if (isBulk) {
    return {
      entityType,
      entityId,
      sections: [
        {
          id: 'bulk_actions',
          title: 'Bulk Operations',
          items: [
            { id: 'export_bulk', label: 'Export Selected (CSV)', icon: 'download', action: 'export_bulk' },
            { id: 'delete_bulk', label: 'Delete Selected', icon: 'trash', action: 'delete_bulk', separator: true },
          ],
        },
      ],
    };
  }

  switch (entityType) {
    case 'farmer':
      return {
        entityType,
        entityId,
        sections: [
          {
            id: 'quick_actions',
            title: 'Quick Actions',
            items: [
              { id: 'view_farmer', label: 'View Profile', icon: 'eye', action: 'view_farmer' },
              { id: 'schedule_visit', label: 'Schedule Visit', icon: 'calendar', action: 'schedule_visit' },
            ],
          },
          {
            id: 'sharing',
            title: 'Share & Export',
            items: [
              { id: 'share_farmer', label: 'Share Profile', icon: 'share', action: 'share_farmer' },
              { id: 'export_farmer', label: 'Export Data (CSV)', icon: 'download', action: 'export_farmer' },
            ],
          },
          {
            id: 'danger',
            title: 'Danger Zone',
            items: [
              { id: 'delete_farmer', label: 'Delete Farmer', icon: 'trash', action: 'delete_farmer', separator: true },
            ],
          },
        ],
      };

    case 'visit':
      return {
        entityType,
        entityId,
        sections: [
          {
            id: 'visit_actions',
            title: 'Visit Actions',
            items: [
              { id: 'view_visit', label: 'View Visit Details', icon: 'eye', action: 'view_visit' },
              { id: 'share_visit', label: 'Share Visit', icon: 'share', action: 'share_visit' },
              { id: 'delete_visit', label: 'Delete Record', icon: 'trash', action: 'delete_visit', separator: true },
            ],
          },
        ],
      };

    case 'report':
      return {
        entityType,
        entityId,
        sections: [
          {
            id: 'report_actions',
            title: 'Report Actions',
            items: [
              { id: 'view_report', label: 'View Report', icon: 'eye', action: 'view_report' },
              { id: 'export_report', label: 'Download Report', icon: 'download', action: 'export_report' },
              { id: 'share_report', label: 'Share Report', icon: 'share', action: 'share_report' },
            ],
          },
        ],
      };

    case 'knowledge':
      return {
        entityType,
        entityId,
        sections: [
          {
            id: 'knowledge_actions',
            title: 'Article Actions',
            items: [
              { id: 'view_knowledge', label: 'Read Article', icon: 'note', action: 'view_knowledge' },
              { id: 'share_knowledge', label: 'Share Article', icon: 'share', action: 'share_knowledge' },
            ],
          },
        ],
      };

    default:
      return {
        entityType,
        entityId,
        sections: [
          {
            id: 'default_actions',
            items: [
              { id: `view_${entityType}`, label: 'View Details', icon: 'eye', action: `view_${entityType}` },
              { id: `share_${entityType}`, label: 'Share', icon: 'share', action: `share_${entityType}` },
            ],
          },
        ],
      };
  }
};

export const fetchContextMenu = async (
  entityType: string,
  entityId?: string,
  isBulk = false
): Promise<{ success: boolean; data: ContextMenuData }> => {
  // If entity is a synthetic demo entity, return default client-side menu immediately without calling API
  if (isDemoId(entityId)) {
    return {
      success: true,
      data: getDefaultContextMenu(entityType, entityId, isBulk),
    };
  }

  try {
    const url = isBulk
      ? `/context-menus/bulk/${entityType}`
      : `/context-menus/${entityType}/${entityId}`;
    const { data } = await apiClient.get(url);
    if (data?.success && data?.data) {
      return data;
    }
    return {
      success: true,
      data: getDefaultContextMenu(entityType, entityId, isBulk),
    };
  } catch {
    return {
      success: true,
      data: getDefaultContextMenu(entityType, entityId, isBulk),
    };
  }
};

export const getUnavailableMenu = (entityType: string): ContextMenuData => {
  return getDefaultContextMenu(entityType);
};
