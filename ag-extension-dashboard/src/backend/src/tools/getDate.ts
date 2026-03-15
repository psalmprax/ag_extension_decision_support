
import { z } from 'zod';
import { Tool } from './types';

// Define the schema for the arguments. In this case, there are no arguments.
const GetDateSchema = z.object({});

/**
 * A tool that returns the current date.
 */
export const getDateTool: Tool<typeof GetDateSchema> = {
  name: 'get_current_date',
  description: 'Returns the current date in YYYY-MM-DD format.',
  schema: GetDateSchema,
  execute: async () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  },
};
