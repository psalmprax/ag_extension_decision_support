import React, { useState, useEffect } from 'react';
import {
    Wrench, Play, Code, Eye, RefreshCw,
    CheckCircle, XCircle, Loader2, Terminal,
    Settings, Zap, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { fetchMCPTools, callMCPTool, fetchMCPHealth, type MCPTool } from '../api/mcpService';
import toast from 'react-hot-toast';

export function MCPTools() {
    const { t } = useLanguage();
    const { addNotification } = useAppStore();

    // State
    const [tools, setTools] = useState<MCPTool[]>([]);
    const [health, setHealth] = useState<{
        status: string;
        protocol: string;
        version: string;
        toolsAvailable: number;
        tools: string[];
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
    const [toolArgs, setToolArgs] = useState<Record<string, any>>({});
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<{
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
    } | null>(null);
    const [executionHistory, setExecutionHistory] = useState<Array<{
        tool: string;
        args: Record<string, any>;
        result: any;
        timestamp: string;
    }>>([]);

    // Load data
    const loadData = async (showRefresh = false) => {
        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const [toolsRes, healthRes] = await Promise.all([
                fetchMCPTools(),
                fetchMCPHealth()
            ]);

            if (toolsRes.success) {
                setTools(toolsRes.data);
            }
            if (healthRes.success) {
                setHealth(healthRes.data);
            }
        } catch (error) {
            console.error('Failed to load MCP data:', error);
            addNotification({
                type: 'error',
                message: t('mcp_tools_failed_load')
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleRefresh = () => {
        loadData(true);
    };

    const handleExecuteTool = async () => {
        if (!selectedTool) return;

        // Validate required parameters
        const required = selectedTool.inputSchema.required || [];
        const missing = required.filter(param => !toolArgs[param] || toolArgs[param] === '');

        if (missing.length > 0) {
            addNotification({
                type: 'error',
                message: `Please fill in the required parameters: ${missing.join(', ')}`
            });
            return;
        }

        setIsExecuting(true);
        setExecutionResult(null);
        try {
            const res = await callMCPTool(selectedTool.name, Object.keys(toolArgs).length > 0 ? toolArgs : undefined);
            if (res.success) {
                setExecutionResult(res.data);
                // Add to history
                setExecutionHistory(prev => [{
                    tool: selectedTool.name,
                    args: toolArgs,
                    result: res.data,
                    timestamp: new Date().toISOString()
                }, ...prev.slice(0, 9)]); // Keep last 10

                if (res.data.isError) {
                    addNotification({
                        type: 'error',
                        message: t('mcp_tools_execution_failed')
                    });
                } else {
                    addNotification({
                        type: 'success',
                        message: t('mcp_tools_executed_success')
                    });
                }
            } else {
                addNotification({
                    type: 'error',
                    message: 'Failed to execute tool'
                });
            }
        } catch (error) {
            console.error('Tool execution error:', error);
            addNotification({
                type: 'error',
                message: 'Failed to execute tool'
            });
        } finally {
            setIsExecuting(false);
        }
    };

    const getDefaultArgs = (tool: MCPTool): Record<string, any> => {
        const defaults: Record<string, any> = {};

        // Set defaults for common parameters
        if (tool.inputSchema.properties) {
            for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
                const schemaTyped = schema as { type?: string };
                if (key === 'location' && !tool.inputSchema.required?.includes(key)) {
                    defaults[key] = 'Kampala, Uganda'; // Default location for agricultural context
                } else if (key === 'days' && schemaTyped.type === 'number') {
                    defaults[key] = 3; // Default 3 days forecast
                } else if (key === 'limit' && schemaTyped.type === 'number') {
                    defaults[key] = 10; // Default limit
                }
                // Add more defaults as needed for other tools
            }
        }

        return defaults;
    };

    const renderInputField = (propertyName: string, schema: any) => {
        const value = toolArgs[propertyName] || '';

        switch (schema.type) {
            case 'string':
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setToolArgs(prev => ({ ...prev, [propertyName]: e.target.value }))}
                        placeholder={schema.description || `Enter ${propertyName}`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => setToolArgs(prev => ({ ...prev, [propertyName]: parseFloat(e.target.value) || 0 }))}
                        placeholder={schema.description || `Enter ${propertyName}`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                );
            case 'boolean':
                return (
                    <select
                        value={value.toString()}
                        onChange={(e) => setToolArgs(prev => ({ ...prev, [propertyName]: e.target.value === 'true' }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="false">False</option>
                        <option value="true">True</option>
                    </select>
                );
            default:
                return (
                    <textarea
                        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                setToolArgs(prev => ({ ...prev, [propertyName]: parsed }));
                            } catch {
                                setToolArgs(prev => ({ ...prev, [propertyName]: e.target.value }));
                            }
                        }}
                        placeholder={schema.description || `Enter ${propertyName} (JSON)`}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
                    />
                );
        }
    };

    const StatCard = ({ title, value, icon: Icon, color = 'blue' }: {
        title: string;
        value: string | number;
        icon: any;
        color?: string;
    }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 border-white/20 hover:scale-[1.02] transition-transform duration-300"
            style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-premium)' }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                </div>
                <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/30 rounded-xl`}>
                    <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
                </div>
            </div>
        </motion.div>
    );

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MCP Tools Browser</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">Explore and execute Model Context Protocol tools</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-6 animate-pulse">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                                </div>
                                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('mcp_tools_title')}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{t('mcp_tools_subtitle')}</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Health Status */}
            {health && (
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('mcp_tools_server_status')}</h3>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            health.status === 'healthy'
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                            {health.status === 'healthy' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                            {health.status}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{health.toolsAvailable}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Tools Available</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">{health.protocol}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Protocol Version</div>
                        </div>
                        <div className="text-center">
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">{health.version}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Server Version</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                        title={t('mcp_tools_available_tools')}
                    value={tools.length}
                    icon={Wrench}
                    color="blue"
                />
                <StatCard
                        title={t('mcp_tools_executed_today')}
                    value={executionHistory.filter(h => new Date(h.timestamp).toDateString() === new Date().toDateString()).length}
                    icon={Play}
                    color="green"
                />
                <StatCard
                        title={t('mcp_tools_success_rate')}
                    value={executionHistory.length > 0
                        ? `${Math.round((executionHistory.filter(h => !h.result?.isError).length / executionHistory.length) * 100)}%`
                        : '100%'
                    }
                    icon={CheckCircle}
                    color="purple"
                />
                <StatCard
                        title={t('mcp_tools_total_executions')}
                    value={executionHistory.length}
                    icon={Terminal}
                    color="orange"
                />
            </div>

            {/* Tools Grid and Execution Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tools List */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('mcp_tools_available_tools')}</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {tools.map((tool) => (
                            <motion.div
                                key={tool.name}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                selectedTool?.name === tool.name
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                                }`}
                                onClick={() => {
                                    setSelectedTool(tool);
                                    setToolArgs(getDefaultArgs(tool));
                                    setExecutionResult(null);
                                }}
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
                        ))}
                    </div>
                </div>

                {/* Tool Execution Panel */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('mcp_tools_tool_execution')}</h3>

                    {selectedTool ? (
                        <div className="space-y-6">
                            {/* Tool Info */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{selectedTool.name}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedTool.description}</p>
                            </div>

                            {/* Parameters */}
                            {selectedTool.inputSchema.properties && Object.keys(selectedTool.inputSchema.properties).length > 0 && (
                                <div className="space-y-4">
                                    <h5 className="font-medium text-gray-900 dark:text-white">Parameters</h5>
                                    {Object.entries(selectedTool.inputSchema.properties).map(([propName, propSchema]: [string, any]) => (
                                        <div key={propName}>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                {propName}
                                                {selectedTool.inputSchema.required?.includes(propName) && (
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

                            {/* Execute Button */}
                            <button
                                onClick={handleExecuteTool}
                                disabled={isExecuting}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
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

                            {/* Execution Result */}
                            {executionResult && (
                                <div className={`p-4 rounded-lg ${
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
                                                    <pre className="whitespace-pre-wrap font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border">
                                                        {item.text}
                                                    </pre>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Wrench className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Tool</h3>
                            <p className="text-gray-600 dark:text-gray-400">Choose a tool from the list to execute</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Execution History */}
            {executionHistory.length > 0 && (
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('mcp_tools_recent_executions')}</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {executionHistory.map((execution, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    {execution.result?.isError ? (
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    ) : (
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{execution.tool}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {Object.keys(execution.args).length > 0
                                                ? `${Object.keys(execution.args).length} parameters`
                                                : 'No parameters'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(execution.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MCPTools;