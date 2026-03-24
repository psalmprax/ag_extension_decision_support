import { UserRole } from '@/middleware/authorize';
import { ContextMenu, ContextMenuItem, ContextMenuSection } from '@/types.d';
import { logger } from '@/utils/logger';
import { query } from './databaseService';

export interface UserPermissions {
    userId: string;
    role: UserRole;
    permissions: string[];
}

class ContextMenuService {
    private async checkEntityOwnership(entityType: string, entityId: string, userId: string): Promise<boolean> {
        try {
            let sql: string;
            let params: any[];

            switch (entityType) {
                case 'farmer':
                    sql = 'SELECT id FROM farmers WHERE id = $1 AND created_by = $2';
                    params = [entityId, userId];
                    break;
                case 'visit':
                    sql = 'SELECT id FROM visits WHERE id = $1 AND officer_id = $2';
                    params = [entityId, userId];
                    break;
                case 'report':
                    sql = 'SELECT id FROM reports WHERE id = $1 AND created_by = $2';
                    params = [entityId, userId];
                    break;
                case 'knowledge':
                    sql = 'SELECT id FROM knowledge_articles WHERE id = $1 AND created_by = $2';
                    params = [entityId, userId];
                    break;
                case 'user':
                    sql = 'SELECT id FROM users WHERE id = $1';
                    params = [entityId];
                    break;
                default:
                    return false;
            }

            const result = await query(sql, params);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error checking entity ownership:', error);
            return false;
        }
    }

    private hasPermission(userPermissions: UserPermissions, requiredPermissions?: string[]): boolean {
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        // Admin has all permissions
        if (userPermissions.role === 'admin') {
            return true;
        }

        // Check if user has any of the required permissions
        return requiredPermissions.some(permission => userPermissions.permissions.includes(permission));
    }

    private filterMenuItems(items: ContextMenuItem[], userPermissions: UserPermissions, isOwner: boolean): ContextMenuItem[] {
        return items.filter(item => {
            // Check permissions
            if (item.permissions && !this.hasPermission(userPermissions, item.permissions)) {
                return false;
            }

            // Owner-only actions
            if (item.action.includes('delete') || item.action.includes('edit')) {
                return isOwner || userPermissions.role === 'admin' || userPermissions.role === 'regional_manager';
            }

            // Process children recursively
            if (item.children) {
                item.children = this.filterMenuItems(item.children, userPermissions, isOwner);
                // Keep parent if it has visible children
                return item.children.length > 0;
            }

            return true;
        });
    }

    private getFarmerMenuItems(): ContextMenuItem[] {
        return [
            { id: 'view', label: 'View Farmer Profile', icon: 'eye', action: 'view_farmer' },
            { id: 'edit', label: 'Edit Farmer', icon: 'edit', action: 'edit_farmer', permissions: ['manage_farmers'] },
            { id: 'schedule_visit', label: 'Schedule Visit', icon: 'calendar', action: 'schedule_visit', permissions: ['schedule_visits'] },
            { id: 'view_visits', label: 'View Visit History', icon: 'history', action: 'view_visits' },
            { id: 'separator1', label: '', action: '', separator: true },
            { id: 'share', label: 'Share Profile', icon: 'share', action: 'share_farmer' },
            { id: 'export', label: 'Export Data', icon: 'download', action: 'export_farmer' },
            { id: 'separator2', label: '', action: '', separator: true },
            { id: 'delete', label: 'Delete Farmer', icon: 'trash', action: 'delete_farmer', permissions: ['delete_farmers'] }
        ];
    }

    private getVisitMenuItems(): ContextMenuItem[] {
        return [
            { id: 'view', label: 'View Visit Details', icon: 'eye', action: 'view_visit' },
            { id: 'edit', label: 'Edit Visit', icon: 'edit', action: 'edit_visit', permissions: ['manage_visits'] },
            { id: 'update_status', label: 'Update Status', icon: 'refresh', action: 'update_visit_status', permissions: ['manage_visits'] },
            { id: 'add_notes', label: 'Add Notes', icon: 'note', action: 'add_visit_notes', permissions: ['manage_visits'] },
            { id: 'separator1', label: '', action: '', separator: true },
            { id: 'share', label: 'Share Visit Report', icon: 'share', action: 'share_visit' },
            { id: 'export', label: 'Export Report', icon: 'download', action: 'export_visit' },
            { id: 'separator2', label: '', action: '', separator: true },
            { id: 'delete', label: 'Delete Visit', icon: 'trash', action: 'delete_visit', permissions: ['delete_visits'] }
        ];
    }

    private getReportMenuItems(): ContextMenuItem[] {
        return [
            { id: 'view', label: 'View Report', icon: 'eye', action: 'view_report' },
            { id: 'edit', label: 'Edit Report', icon: 'edit', action: 'edit_report', permissions: ['manage_reports'] },
            { id: 'regenerate', label: 'Regenerate Report', icon: 'refresh', action: 'regenerate_report', permissions: ['manage_reports'] },
            { id: 'separator1', label: '', action: '', separator: true },
            { id: 'share', label: 'Share Report', icon: 'share', action: 'share_report' },
            { id: 'export', label: 'Export Report', icon: 'download', action: 'export_report' },
            { id: 'separator2', label: '', action: '', separator: true },
            { id: 'delete', label: 'Delete Report', icon: 'trash', action: 'delete_report', permissions: ['delete_reports'] }
        ];
    }

    private getKnowledgeMenuItems(): ContextMenuItem[] {
        return [
            { id: 'view', label: 'View Article', icon: 'eye', action: 'view_knowledge' },
            { id: 'edit', label: 'Edit Article', icon: 'edit', action: 'edit_knowledge', permissions: ['manage_knowledge'] },
            { id: 'publish', label: 'Publish/Unpublish', icon: 'globe', action: 'toggle_publish_knowledge', permissions: ['publish_knowledge'] },
            { id: 'separator1', label: '', action: '', separator: true },
            { id: 'share', label: 'Share Article', icon: 'share', action: 'share_knowledge' },
            { id: 'export', label: 'Export Article', icon: 'download', action: 'export_knowledge' },
            { id: 'separator2', label: '', action: '', separator: true },
            { id: 'delete', label: 'Delete Article', icon: 'trash', action: 'delete_knowledge', permissions: ['delete_knowledge'] }
        ];
    }

    private getUserMenuItems(): ContextMenuItem[] {
        return [
            { id: 'view', label: 'View Profile', icon: 'eye', action: 'view_user' },
            { id: 'edit', label: 'Edit User', icon: 'edit', action: 'edit_user', permissions: ['manage_users'] },
            { id: 'reset_password', label: 'Reset Password', icon: 'key', action: 'reset_user_password', permissions: ['manage_users'] },
            { id: 'change_role', label: 'Change Role', icon: 'user-cog', action: 'change_user_role', permissions: ['manage_users'] },
            { id: 'separator1', label: '', action: '', separator: true },
            { id: 'deactivate', label: 'Deactivate User', icon: 'user-x', action: 'deactivate_user', permissions: ['manage_users'] },
            { id: 'delete', label: 'Delete User', icon: 'trash', action: 'delete_user', permissions: ['delete_users'] }
        ];
    }

    private getBulkActionMenuItems(entityType: string): ContextMenuItem[] {
        const actions: ContextMenuItem[] = [
            { id: 'select_all', label: 'Select All', icon: 'check-square', action: 'select_all' },
            { id: 'clear_selection', label: 'Clear Selection', icon: 'square', action: 'clear_selection' },
            { id: 'separator1', label: '', action: '', separator: true }
        ];

        switch (entityType) {
            case 'farmer':
                actions.push(
                    { id: 'bulk_export', label: 'Export Selected', icon: 'download', action: 'bulk_export_farmers', permissions: ['export_data'] },
                    { id: 'bulk_share', label: 'Share Selected', icon: 'share', action: 'bulk_share_farmers' },
                    { id: 'bulk_delete', label: 'Delete Selected', icon: 'trash', action: 'bulk_delete_farmers', permissions: ['delete_farmers'] }
                );
                break;
            case 'visit':
                actions.push(
                    { id: 'bulk_export', label: 'Export Reports', icon: 'download', action: 'bulk_export_visits', permissions: ['export_data'] },
                    { id: 'bulk_update_status', label: 'Update Status', icon: 'refresh', action: 'bulk_update_visit_status', permissions: ['manage_visits'] },
                    { id: 'bulk_delete', label: 'Delete Selected', icon: 'trash', action: 'bulk_delete_visits', permissions: ['delete_visits'] }
                );
                break;
            case 'report':
                actions.push(
                    { id: 'bulk_export', label: 'Export Reports', icon: 'download', action: 'bulk_export_reports', permissions: ['export_data'] },
                    { id: 'bulk_delete', label: 'Delete Selected', icon: 'trash', action: 'bulk_delete_reports', permissions: ['delete_reports'] }
                );
                break;
            case 'knowledge':
                actions.push(
                    { id: 'bulk_export', label: 'Export Articles', icon: 'download', action: 'bulk_export_knowledge', permissions: ['export_data'] },
                    { id: 'bulk_publish', label: 'Publish Selected', icon: 'globe', action: 'bulk_publish_knowledge', permissions: ['publish_knowledge'] },
                    { id: 'bulk_delete', label: 'Delete Selected', icon: 'trash', action: 'bulk_delete_knowledge', permissions: ['delete_knowledge'] }
                );
                break;
        }

        return actions;
    }

    async generateContextMenu(
        entityType: 'farmer' | 'visit' | 'report' | 'knowledge' | 'user',
        entityId: string | null,
        userPermissions: UserPermissions,
        isBulk: boolean = false
    ): Promise<ContextMenu> {
        try {
            let sections: ContextMenuSection[] = [];
            let isOwner = false;

            // Check ownership for single entity operations
            if (entityId && !isBulk) {
                isOwner = await this.checkEntityOwnership(entityType, entityId, userPermissions.userId);
            }

            if (isBulk) {
                // Bulk operations menu
                sections = [
                    {
                        id: 'bulk_actions',
                        title: 'Bulk Actions',
                        items: this.filterMenuItems(this.getBulkActionMenuItems(entityType), userPermissions, false)
                    }
                ];
            } else {
                // Single entity menu
                let items: ContextMenuItem[] = [];

                switch (entityType) {
                    case 'farmer':
                        items = this.getFarmerMenuItems();
                        break;
                    case 'visit':
                        items = this.getVisitMenuItems();
                        break;
                    case 'report':
                        items = this.getReportMenuItems();
                        break;
                    case 'knowledge':
                        items = this.getKnowledgeMenuItems();
                        break;
                    case 'user':
                        items = this.getUserMenuItems();
                        break;
                }

                // Filter items based on permissions and ownership
                items = this.filterMenuItems(items, userPermissions, isOwner);

                sections = [
                    {
                        id: 'actions',
                        items: items
                    }
                ];
            }

            return {
                entityType,
                entityId: entityId || undefined,
                sections
            };
        } catch (error) {
            logger.error('Error generating context menu:', error);
            throw new Error('Failed to generate context menu');
        }
    }

    async executeAction(action: string, entityType: string, entityId: string, userId: string, data?: any): Promise<any> {
        try {
            // This would integrate with existing services
            // For now, return a placeholder response
            logger.info(`Executing action: ${action} on ${entityType}:${entityId} by user ${userId}`);

            switch (action) {
                case 'view_farmer':
                case 'view_visit':
                case 'view_report':
                case 'view_knowledge':
                case 'view_user':
                    return { success: true, action: 'redirect', target: `/${entityType}s/${entityId}` };

                case 'edit_farmer':
                case 'edit_visit':
                case 'edit_report':
                case 'edit_knowledge':
                case 'edit_user':
                    return { success: true, action: 'redirect', target: `/${entityType}s/${entityId}/edit` };

                case 'delete_farmer':
                case 'delete_visit':
                case 'delete_report':
                case 'delete_knowledge':
                case 'delete_user':
                    return { success: true, action: 'delete', entityId };

                case 'share_farmer':
                case 'share_visit':
                case 'share_report':
                case 'share_knowledge':
                    // Would integrate with shareService
                    return { success: true, action: 'share', entityId };

                case 'export_farmer':
                case 'export_visit':
                case 'export_report':
                case 'export_knowledge':
                    return { success: true, action: 'export', entityId, format: data?.format || 'pdf' };

                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            logger.error('Error executing context menu action:', error);
            throw error;
        }
    }
}

export const contextMenuService = new ContextMenuService();