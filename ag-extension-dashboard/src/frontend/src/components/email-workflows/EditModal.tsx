import React from 'react';
import { motion } from 'framer-motion';
import type { EmailTemplate } from '@/api/emailWorkflowService';
import type { EditForm } from '@/types/emailWorkflows';

export function EmailWorkflowsEditModal({
    template,
    editForm,
    onChange,
    onSave,
    onClose,
}: {
    template: EmailTemplate;
    editForm: EditForm;
    onChange: (next: EditForm) => void;
    onSave: () => void;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Edit Template: {template.displayName || template.name}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Category
                            </label>
                            <select
                                value={editForm.category}
                                onChange={(e) => onChange({ ...editForm, category: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                <option value="visits">Visits</option>
                                <option value="alerts">Alerts</option>
                                <option value="market">Market</option>
                                <option value="weather">Weather</option>
                                <option value="training">Training</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={editForm.subject}
                                onChange={(e) => onChange({ ...editForm, subject: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="Email subject line"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Body
                            </label>
                            <textarea
                                value={editForm.body}
                                onChange={(e) => onChange({ ...editForm, body: e.target.value })}
                                rows={12}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
                                placeholder="Email body content"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Variables (comma-separated)
                            </label>
                            <input
                                type="text"
                                value={editForm.variables.join(', ')}
                                onChange={(e) => onChange({
                                    ...editForm,
                                    variables: e.target.value.split(',').map(v => v.trim()).filter(v => v),
                                })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                placeholder="farmerName, location, visitDate"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSave}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
