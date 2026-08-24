/* eslint-disable @typescript-eslint/no-explicit-any */
// Type declarations for modules without types

declare module 'pg' {
    export interface PoolConfig {
        host?: string;
        port?: number;
        database?: string;
        user?: string;
        password?: string;
        ssl?: boolean | object;
        max?: number;
        idleTimeoutMillis?: number;
        connectionTimeoutMillis?: number;
        connectionString?: string;
    }

    export class Pool {
        constructor(config?: PoolConfig | string);
        query(text: string, values?: any[]): Promise<QueryResult>;
        end(): Promise<void>;
        connect(): Promise<any>;
    }

    export interface QueryResult {
        rows: any[];
        rowCount: number;
        fields: FieldDef[];
    }

    export interface FieldDef {
        name: string;
        dataTypeID: number;
    }
}

declare module 'json-schema-faker' {
    const jsonSchemaFaker: any;
    export default jsonSchemaFaker;
}

export type UserRole = 'admin' | 'regional_manager' | 'extension_officer' | 'farmer';

declare global {
    namespace Express {
        export interface Request {
            user?: {
                userId: string;
                email: string;
                role: UserRole;
                [key: string]: any;
            };
            language?: string;
            rawBody?: Buffer;
            i18n?: {
                language: string;
                isRTL: boolean;
                originalPath: string;
                canonicalPath: string;
                [key: string]: any;
            };
            _i18nTranslatedPath?: string;
            _originalPath?: string;
        }
    }
}

// Context Menu Types
export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    action: string;
    permissions?: string[];
    separator?: boolean;
    disabled?: boolean;
    children?: ContextMenuItem[];
}

export interface ContextMenuSection {
    id: string;
    title?: string;
    items: ContextMenuItem[];
}

export interface ContextMenu {
    entityType: 'farmer' | 'visit' | 'report' | 'knowledge' | 'user';
    entityId?: string;
    sections: ContextMenuSection[];
}

export interface ContextMenuAction {
    action: string;
    entityType: string;
    entityId: string;
    data?: any;
}

// Breadcrumb Types
export interface Breadcrumb {
    label: string;
    url?: string;
    active?: boolean;
}
