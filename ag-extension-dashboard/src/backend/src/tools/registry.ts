
import { AnyTool } from './types';

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
/**
 * A registry of all available tools for the AI agent.
 * Add new tools to this array to make them available to the agent.
 */
export const toolRegistry: AnyTool[] = [
  getDateTool,
  nasaPowerTool,
  weatherTool,
  scheduleVisitTool,
  marketPriceTool,
  diseaseAlertTool,
  researchTool,
  registerAlertTool,
  cropYieldForecastTool,
  deepResearchTool,
  satelliteNDVITool,
  memoryStoreTool,
  memoryRecallTool,
  memoryForgetTool,
  dispatchTaskTool,
  handoffTaskTool,
  taskStatusTool,
  apiBudgetTool,
  translationTool,
  diagnoseFromSymptomsTool,
  analyzePlantImageTool,
  getDiseaseInfoTool,
];

/**
 * A map of tool names to their definitions for quick lookup.
 */
export const toolMap = new Map(toolRegistry.map(tool => [tool.name, tool]));
