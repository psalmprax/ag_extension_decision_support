import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { toolRegistry, toolMap } from '@/tools/registry';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';
import { aegisShield } from '@/services/security/aegisShield';

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

class MCPAdapter {
  private static instance: MCPAdapter;

  static getInstance(): MCPAdapter {
    if (!MCPAdapter.instance) {
      MCPAdapter.instance = new MCPAdapter();
    }
    return MCPAdapter.instance;
  }

  convertToMCPTools(): MCPTool[] {
    return toolRegistry.map(tool => {
      let properties: Record<string, unknown> = {};
      let required: string[] = [];

      try {
        const schema = z.toJSONSchema(tool.schema, { target: 'draft-07', io: 'input' });
        if (schema.type === 'object') {
          properties = schema.properties ?? {};
          required = schema.required ?? [];
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
      const sanitized = aegisShield.sanitizeToolResult(typeof result === 'string' ? result : JSON.stringify(result));
      if (!sanitized.clean) {
        logger.warn(`[MCP] Tool "${name}" output contained potential prompt injection or threat; sanitized before return. Threats: ${sanitized.threats.join(', ')}`);
      }
      return {
        content: [{ type: 'text', text: sanitized.sanitizedInput }],
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
}

const mcpAdapter = MCPAdapter.getInstance();

export { mcpAdapter };

/**
 * MCP auth: accept either an authenticated dashboard user (admin / regional
 * manager / extension officer — set by `optionalAuth`) or a service-to-service
 * shared secret (`MCP_API_TOKEN`) used by the Python agent containers. Anything
 * else is rejected. `/health` stays public for liveness probes.
 */
function mcpAuth(req: Request, res: Response, next: () => void): void {
  const role = req.user?.role;
  if (role === 'admin' || role === 'regional_manager' || role === 'extension_officer') {
    return next();
  }
  const serviceToken = process.env.MCP_API_TOKEN;
  const header = req.headers.authorization;
  if (serviceToken && header === `Bearer ${serviceToken}`) {
    return next();
  }
  res.status(401).json({ success: false, error: 'MCP access requires an authenticated officer session or a valid MCP_API_TOKEN' });
}

export function createMCPRouter(): Router {
  const router = Router();

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

  router.use(mcpAuth);

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

  return router;
}
