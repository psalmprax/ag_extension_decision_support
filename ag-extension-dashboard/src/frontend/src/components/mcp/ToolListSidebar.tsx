import React from 'react';
import { motion } from 'framer-motion';
import { Code } from 'lucide-react';
import type { MCPTool } from '@/api/mcpService';

export function MCPToolsToolListSidebar({
    tools,
    selectedTool,
    onSelect,
    radiusClass,
    t,
}: {
    tools: MCPTool[];
    selectedTool: MCPTool | null;
    onSelect: (tool: MCPTool) => void;
    radiusClass: string;
    t: (key: string) => string;
}) {
    return (
        <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('mcp_tools_available_tools')}</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {tools.map((tool) => {
                    const isSelected = selectedTool?.name === tool.name;
                    return (
                        <motion.div
                            key={tool.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-4 border ${radiusClass} cursor-pointer transition-all ${
                                isSelected
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                            }`}
                            onClick={() => onSelect(tool)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">{tool.name}</h4>
                                <Code className="w-5 h-5 text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{tool.description}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {tool.inputSchema.properties ? Object.keys(tool.inputSchema.properties).length : 0} parameters
                                </span>
                                {tool.inputSchema.required && tool.inputSchema.required.length > 0 && (
                                    <span className="text-xs bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 px-2 py-1 rounded">
                                        {tool.inputSchema.required.length} required
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
