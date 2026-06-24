/**
 * Shared MCP (Model Context Protocol) types.
 *
 * These are referenced by both the page composer `src/pages/MCPTools.tsx`
 * and each sub-component under `src/components/mcp/`, so they live in a
 * single module rather than being co-located with any one consumer.
 */

export interface MCPHealth {
    status: string;
    protocol: string;
    version: string;
    toolsAvailable: number;
    tools: string[];
}

export interface ExecutionResult {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
}

export interface ExecutionHistoryEntry {
    tool: string;
    args: Record<string, unknown>;
    result: { isError?: boolean; content?: Array<{ type: string; text: string }> } | null;
    timestamp: string;
}

export interface InputSchema {
    type?: string;
    description?: string;
}
