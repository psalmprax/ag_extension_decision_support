/* eslint-disable @typescript-eslint/no-explicit-any */
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
        // For Zod v3, shape is a function that returns the shape object
        if (zodSchema && zodSchema._def && zodSchema._def.shape) {
          if (typeof zodSchema._def.shape === 'function') {
            shape = zodSchema._def.shape();
          } else {
            // Fallback: if shape is already an object
            shape = zodSchema._def.shape;
          }
        }

        if (shape && typeof shape === 'object') {
          for (const [key, value] of Object.entries(shape)) {
            try {
              const zodDef = (value as any)?._def;
              const fieldType = this.getZodType(zodDef);
              const description = zodDef?.description || '';

              properties[key] = {
                type: fieldType,
                description: description,
              };

            // Check if field is required (not optional)
            const isOptional = this.isFieldOptional(zodDef);
            if (!isOptional) {
              required.push(key);
            }
            } catch (fieldError) {
              console.error(`Tool ${tool.name}, field ${key}: Error processing field:`, fieldError);
            }
          }
        }
      } catch (error) {
        console.error(`Tool ${tool.name}: Error extracting schema:`, error);
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

  private isFieldOptional(zodDef: any): boolean {
    if (!zodDef) return false;

    const typeName = zodDef.typeName;

    // Direct optional types
    if (typeName === 'ZodOptional') return true;

    // Default values make fields effectively optional
    if (typeName === 'ZodDefault') return true;

    // Check if the field has isOptional property (for some Zod versions)
    if (zodDef.isOptional === true) return true;

    // If it's a direct type (ZodString, ZodNumber, etc.) without optional wrapper, it's required
    // Only mark as optional if explicitly wrapped
    return false;
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
      case 'ZodDefault': return this.getZodType(zodDef.innerType?._def);
      default: return 'string';
    }
  }
}

export const mcpAdapter = MCPAdapter.getInstance();

export function createMCPRouter(): Router {
  const router = Router();

  router.post('/message', async (req: Request, res: Response) => {
    try {
      const { message, tools } = req.body;

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

  /**
   * @swagger
   * /api/v1/mcp/tools:
   *   get:
   *     summary: List available Model Context Protocol (MCP) tools
   *     description: Retrieve a list of registered MCP tools that AI agents can execute.
   *     tags:
   *       - AI Tools (MCP)
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: A list of registered MCP tools
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                       description:
   *                         type: string
   *                       inputSchema:
   *                         type: object
   */
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
