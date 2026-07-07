import apiClient from './client';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const fetchMCPTools = async (): Promise<{ success: boolean; data: MCPTool[] }> => {
  const response = await apiClient.get('/mcp/tools');
  return response.data;
};

export const callMCPTool = async (
  name: string,
  args?: Record<string, unknown>
): Promise<{
  success: boolean;
  data: { content: Array<{ type: string; text: string }>; isError?: boolean };
}> => {
  const response = await apiClient.post('/mcp/tools/call', { name, arguments: args });
  return response.data;
};

export const fetchMCPHealth = async (): Promise<{
  success: boolean;
  data: {
    status: string;
    protocol: string;
    version: string;
    toolsAvailable: number;
    tools: string[];
  };
}> => {
  const response = await apiClient.get('/mcp/health');
  return response.data;
};
