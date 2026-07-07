import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Eye, Edit } from 'lucide-react';
import type { EmailTemplate } from '@/api/emailWorkflowService';

export function EmailWorkflowsTemplateGrid({
  templates,
  selectedCategory,
  onPreview,
  onEdit,
  btnClass,
  t,
}: {
  templates: EmailTemplate[];
  selectedCategory: string;
  onPreview: (template: EmailTemplate) => void;
  onEdit: (template: EmailTemplate) => void;
  btnClass: string;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-6">
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-6 border-white/20 hover:scale-[1.02] transition-transform duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-5 h-5 text-primary-600" />
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                      {template.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {template.displayName || template.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {template.subject}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Variables:</span>
                  <span className="font-medium">{template.variables.length}</span>
                </div>

                {template.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.variables.slice(0, 3).map((variable, index) => (
                      <span
                        key={index}
                        className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                      >
                        {variable}
                      </span>
                    ))}
                    {template.variables.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{template.variables.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Created by {template.createdBy || 'System'} •{' '}
                  {template.createdAt
                    ? new Date(template.createdAt).toLocaleDateString()
                    : 'Recently'}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => onPreview(template)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 text-sm`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => onEdit(template)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white ${btnClass} hover:bg-gray-700 text-sm`}
                >
                  <Edit className="w-4 h-4" />
                  {t('email_workflows_edit')}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Mail className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('email_workflows_no_templates_found')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedCategory !== 'all'
              ? t('email_workflows_no_templates_category')
              : t('email_workflows_create_first')}
          </p>
        </div>
      )}
    </div>
  );
}
