import React from 'react';
import { Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { MCPTool } from '@/api/mcpService';
import type { ExecutionResult, InputSchema } from '@/types/mcp';

const SCHEMA_BOOLEAN_TRUE = 'true';

export function MCPToolsToolExecutionForm({
    tool,
    args,
    isExecuting,
    executionResult,
    onArgsChange,
    onExecute,
    t,
    radiusClass,
    btnClass,
}: {
    tool: MCPTool;
    args: Record<string, unknown>;
    isExecuting: boolean;
    executionResult: ExecutionResult | null;
    onArgsChange: (next: Record<string, unknown>) => void;
    onExecute: () => void;
    t: (key: string) => string;
    radiusClass: string;
    btnClass: string;
}) {
    const renderInputField = (propertyName: string, schema: InputSchema) => {
        const rawValue = args[propertyName];
        const value = typeof rawValue === 'object' ? JSON.stringify(rawValue ?? '') : String(rawValue ?? '');

        switch (schema.type) {
            case 'string':
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onArgsChange({ ...args, [propertyName]: e.target.value })}
                        placeholder={schema.description || `Enter ${propertyName}`}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                    />
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => onArgsChange({ ...args, [propertyName]: parseFloat(e.target.value) || 0 })}
                        placeholder={schema.description || `Enter ${propertyName}`}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                    />
                );
            case 'boolean':
                return (
                    <select
                        value={value.toString()}
                        onChange={(e) => onArgsChange({ ...args, [propertyName]: e.target.value === SCHEMA_BOOLEAN_TRUE })}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                    >
                        <option value="false">False</option>
                        <option value="true">True</option>
                    </select>
                );
            default:
                return (
                    <textarea
                        value={value}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                onArgsChange({ ...args, [propertyName]: parsed });
                            } catch {
                                onArgsChange({ ...args, [propertyName]: e.target.value });
                            }
                        }}
                        placeholder={schema.description || `Enter ${propertyName} (JSON)`}
                        rows={3}
                        className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm resize-none`}
                    />
                );
        }
    };

    const propertyEntries = tool.inputSchema.properties
        ? (Object.entries(tool.inputSchema.properties) as Array<[string, InputSchema]>)
        : [];

    return (
        <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('mcp_tools_tool_execution')}</h3>
            <div className="space-y-6">
                <div className={`p-4 bg-gray-50 dark:bg-gray-800/50 ${radiusClass}`}>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{tool.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
                </div>

                {propertyEntries.length > 0 && (
                    <div className="space-y-4">
                        <h5 className="font-medium text-gray-900 dark:text-white">Parameters</h5>
                        {propertyEntries.map(([propName, propSchema]) => (
                            <div key={propName}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {propName}
                                    {tool.inputSchema.required?.includes(propName) && (
                                        <span className="text-red-500 ml-1">*</span>
                                    )}
                                </label>
                                {renderInputField(propName, propSchema)}
                                {propSchema.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{propSchema.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <button
                    onClick={onExecute}
                    disabled={isExecuting}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
                >
                    {isExecuting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('mcp_tools_executing')}
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4" />
                            {t('mcp_tools_execute')}
                        </>
                    )}
                </button>

                {executionResult && (
                    <div className={`p-4 ${radiusClass} ${
                        executionResult.isError
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    }`}>
                        <div className="flex items-center gap-2 mb-2">
                            {executionResult.isError ? (
                                <XCircle className="w-5 h-5 text-red-600" />
                            ) : (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            <h5 className="font-medium text-gray-900 dark:text-white">
                                {executionResult.isError ? 'Execution Failed' : 'Execution Successful'}
                            </h5>
                        </div>
                        <div className="space-y-2">
                            {executionResult.content.map((item, index) => (
                                <div key={index} className="text-sm">
                                    {item.type === 'text' && (
                                        <pre className={`whitespace-pre-wrap font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 border ${radiusClass}`}>
                                            {item.text}
                                        </pre>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
