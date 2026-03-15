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
