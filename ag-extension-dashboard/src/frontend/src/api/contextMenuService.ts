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
  return {
    entityType,
    sections: [
      {
        id: 'unavailable',
        items: [
          { id: 'unavailable', label: 'Menu unavailable — refresh to retry', icon: 'alert-circle', action: 'unavailable' },
        ],
      },
    ],
  };
};
