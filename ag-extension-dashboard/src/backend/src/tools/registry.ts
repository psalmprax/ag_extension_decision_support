
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Tool } from './types';

// Import your tools here
import { getDateTool } from './getDate';
import { weatherTool } from './weatherTool';
import { scheduleVisitTool } from './scheduleVisit';
import { marketPriceTool } from './marketPriceTool';
import { diseaseAlertTool } from './diseaseAlertTool';
import { researchTool } from './researchTool';
import { registerAlertTool } from './registerAlertTool';
import { cropYieldForecastTool } from './cropYieldForecastTool';
import { deepResearchTool } from './deepResearchTool';
import { satelliteNDVITool } from './satelliteNDVITool';
import { memoryStoreTool, memoryRecallTool, memoryForgetTool } from './memoryTools';
import { dispatchTaskTool, handoffTaskTool, taskStatusTool } from './agentOrchestrationTools';
import { apiBudgetTool } from './apiBudgetTool';
import { translationTool } from './translationTool';
import { diagnoseFromSymptomsTool, analyzePlantImageTool, getDiseaseInfoTool } from './plantDiseaseTools';
import { nasaPowerTool } from './nasaPowerTool';

/**
 * A registry of all available tools for the AI agent.
 * Add new tools to this array to make them available to the agent.
 */
export const toolRegistry: Tool<any>[] = [
  getDateTool as Tool<any>,
  nasaPowerTool as Tool<any>,
  weatherTool as Tool<any>,
  scheduleVisitTool as Tool<any>,
  marketPriceTool as Tool<any>,
  diseaseAlertTool as Tool<any>,
  researchTool as Tool<any>,
  registerAlertTool as Tool<any>,
  cropYieldForecastTool as Tool<any>,
  deepResearchTool as Tool<any>,
  satelliteNDVITool as Tool<any>,
  memoryStoreTool as Tool<any>,
  memoryRecallTool as Tool<any>,
  memoryForgetTool as Tool<any>,
  dispatchTaskTool as Tool<any>,
  handoffTaskTool as Tool<any>,
  taskStatusTool as Tool<any>,
  apiBudgetTool as Tool<any>,
  translationTool as Tool<any>,
  diagnoseFromSymptomsTool as Tool<any>,
  analyzePlantImageTool as Tool<any>,
  getDiseaseInfoTool as Tool<any>,
];

/**
 * A map of tool names to their definitions for quick lookup.
 */
export const toolMap = new Map(toolRegistry.map(tool => [tool.name, tool]));
