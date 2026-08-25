import { z } from 'zod';

/**
 * JSON Schema document shape (subset) used to describe tool parameters
 * for LLM providers that require JSON Schema instead of a Zod schema.
 */
export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema | { [key: string]: unknown }>;
  required?: string[];
  items?: JsonSchema | { [key: string]: unknown };
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchema;
}

export interface Tool<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: T;

  /**
   * The function to execute when the tool is called.
   * @param args The arguments for the tool, parsed and validated against the schema.
   * @returns A promise that resolves to the tool's output, which will be sent back to the LLM.
   */
  execute(args: z.infer<T>): Promise<string>;

  /**
   * An optional JSON schema representation of the tool's parameters,
   * used for compatibility with LLM providers that require it.
   */
  jsonSchema?: JsonSchema;
}

/**
 * Registry-facing view of a tool where the concrete Zod schema is erased.
 * Kept alongside `Tool` so heterogeneous tool arrays typecheck without casts.
 */
export interface AnyTool {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  execute(args: unknown): Promise<string>;
  jsonSchema?: JsonSchema;
}