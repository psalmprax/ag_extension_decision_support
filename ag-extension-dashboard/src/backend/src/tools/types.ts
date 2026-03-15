
import { z } from 'zod';

export interface Tool<T extends z.ZodType<any, any>> {
  name: string;
  description: string;
  schema: T;

  /**
   * The function to execute when the tool is called.
   * @param args The arguments for the tool, parsed and validated against the schema.
   * @returns A promise that resolves to the tool's output, which will be sent back to the LLM.
   */
  execute: (args: z.infer<T>) => Promise<string>;

  /**
   * An optional JSON schema representation of the tool's parameters, 
   * used for compatibility with LLM providers that require it.
   */
  jsonSchema?: Record<string, any>;
}
