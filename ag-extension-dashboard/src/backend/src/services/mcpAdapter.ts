import { Router, Request, Response } from 'express';
import { toolRegistry, toolMap } from '@/tools/registry';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPCallToolRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface MCPCallToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface MCPListToolsResponse {
  tools: MCPTool[];
}

export class MCPAdapter {
  private static instance: MCPAdapter;

  static getInstance(): MCPAdapter {
    if (!MCPAdapter.instance) {
      MCPAdapter.instance = new MCPAdapter();
    }
    return MCPAdapter.instance;
  }

  convertToMCPTools(): MCPTool[] {
    return toolRegistry.map(tool => {
      const zodSchema = tool.schema;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      // Try to extract shape from Zod schema
      let shape: any = null;

      try {
        console.log(`Tool ${tool.name}: Raw schema:`, zodSchema);
        console.log(`Tool ${tool.name}: Schema _def:`, zodSchema?._def);

        // For Zod v3, try different ways to access the shape
        if (zodSchema && zodSchema._def) {
          shape = zodSchema._def.shape;
          console.log(`Tool ${tool.name}: Found shape via _def.shape:`, shape);
        }

        // Alternative access methods
        if (!shape && zodSchema && (zodSchema as any).shape) {
          shape = (zodSchema as any).shape;
          console.log(`Tool ${tool.name}: Found shape via direct property:`, shape);
        }

        console.log(`Tool ${tool.name}: Schema type:`, zodSchema?.constructor?.name);
      } catch (error) {
        console.error(`Tool ${tool.name}: Error extracting schema:`, error);
      }

      if (shape) {
        console.log(`Tool ${tool.name}: Shape keys:`, Object.keys(shape));
        console.log(`Tool ${tool.name}: Shape entries count:`, Object.entries(shape).length);

        for (const [key, value] of Object.entries(shape)) {
          try {
            const zodDef = (value as any)?._def;
            properties[key] = {
              type: this.getZodType(zodDef),
              description: zodDef?.description || '',
            };

            // Check if field is required (not optional)
            const isOptional = zodDef?.typeName === 'ZodOptional' || zodDef?.isOptional;
            if (!isOptional) {
              required.push(key);
            }

            console.log(`Tool ${tool.name}, field ${key}: isOptional=${isOptional}, type=${zodDef?.typeName}, required=${!isOptional}`);
          } catch (fieldError) {
            console.error(`Tool ${tool.name}, field ${key}: Error processing field:`, fieldError);
          }
        }
      } else {
        console.warn(`Tool ${tool.name}: No shape found in schema`);
      }

      return {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      };
    });
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<MCPCallToolResponse> {
    const tool = toolMap.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" not found` }],
        isError: true,
      };
    }

    try {
      const validatedArgs = tool.schema.parse(args || {});
      const result = await tool.execute(validatedArgs);
      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error executing tool "${name}": ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }

  private getZodType(zodDef: any): string {
    if (!zodDef) return 'string';
    const typeName = zodDef.typeName;
    switch (typeName) {
      case 'ZodString': return 'string';
      case 'ZodNumber': return 'number';
      case 'ZodBoolean': return 'boolean';
      case 'ZodArray': return 'array';
      case 'ZodObject': return 'object';
      case 'ZodEnum': return 'string';
      case 'ZodOptional': return this.getZodType(zodDef.innerType?._def);
      default: return 'string';
    }
  }
}

export const mcpAdapter = MCPAdapter.getInstance();

export function createMCPRouter(): Router {
  const router = Router();

  router.post('/message', async (req: Request, res: Response) => {
    try {
      const { message, tools, model, stream } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      const provider = await AIProviderFactory.getProvider('groq');

      const messages = [
        { role: 'system', content: 'You are an agricultural AI assistant with access to tools. Use tools when appropriate to provide accurate, data-driven responses.' },
        { role: 'user', content: message }
      ];

      const availableTools = tools ? toolRegistry.filter(t => tools.includes(t.name)) : toolRegistry;
      const toolDefinitions = availableTools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.jsonSchema || {},
        },
      }));

      const response = await provider.generateText(messages, {
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
      });

      res.json({
        response: response.text,
        toolCalls: response.toolCalls,
        model: response.model,
        usage: response.usage,
      });
    } catch (error) {
      logger.error('MCP message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/tools', (_req: Request, res: Response) => {
    const mcpTools = mcpAdapter.convertToMCPTools();
    res.json({ success: true, data: mcpTools });
  });

  router.post('/tools/call', async (req: Request, res: Response) => {
    try {
      const { name, arguments: args } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'tool name is required' });
      }

      const result = await mcpAdapter.callTool(name, args);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('MCP tool call error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        protocol: 'MCP',
        version: '1.0.0',
        toolsAvailable: toolRegistry.length,
        tools: toolRegistry.map(t => t.name),
      }
    });
  });

  return router;
}
