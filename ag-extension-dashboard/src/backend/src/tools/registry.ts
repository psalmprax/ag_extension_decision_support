
import { Tool } from './types';
import { z } from 'zod';
// Import your tools here
import { getDateTool } from './getDate';
import { weatherTool } from './weatherTool';
import { scheduleVisitTool } from './scheduleVisit';

/**
 * A registry of all available tools for the AI agent.
 * Add new tools to this array to make them available to the agent.
 */
export const toolRegistry: Tool<any>[] = [
  getDateTool as Tool<any>,
  weatherTool as Tool<any>,
  scheduleVisitTool as Tool<any>,
];

/**
 * A map of tool names to their definitions for quick lookup.
 */
export const toolMap = new Map(toolRegistry.map(tool => [tool.name, tool]));
