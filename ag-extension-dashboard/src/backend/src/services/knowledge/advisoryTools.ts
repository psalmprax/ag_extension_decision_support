import { mcpAdapter, type MCPCallToolResponse } from '@/services/mcpAdapter';
import { aegisShield } from '@/services/security/aegisShield';
import { logger } from '@/utils/logger';
import { withAdvisoryTimeout } from './advisoryRuntime';

// Only public, read-only evidence tools audited for advisory use belong here.
const allowedTools = new Set(['get_current_date', 'get_weather_forecast', 'get_geospatial_weather']);

export function getAdvisoryTools() {
    return mcpAdapter.convertToMCPTools().filter(tool => allowedTools.has(tool.name));
}

export async function callAdvisoryTool(name: string, argumentsValue: unknown = {}): Promise<MCPCallToolResponse> {
    if (!allowedTools.has(name)) {
        logger.warn(`Advisory tool request denied: ${name}`);
        throw new Error('Tool is not permitted in agricultural advisory chat');
    }
    const args: unknown = typeof argumentsValue === 'string' ? JSON.parse(argumentsValue) : argumentsValue;
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('Advisory tool arguments must be a JSON object');
    }
    const result = await withAdvisoryTimeout(
        () => mcpAdapter.callTool(name, args as Record<string, unknown>), 8000, 'Advisory tool'
    );
    if (result.isError) throw new Error('Advisory evidence tool failed');
    const content = result.content.map(item => {
        const screened = aegisShield.sanitizeToolResult(item.text, 8000);
        if (screened.severity === 'high' || screened.severity === 'critical') {
            throw new Error('Advisory tool output failed the evidence safety screen');
        }
        return { ...item, text: screened.sanitizedInput };
    });
    return { ...result, content };
}
