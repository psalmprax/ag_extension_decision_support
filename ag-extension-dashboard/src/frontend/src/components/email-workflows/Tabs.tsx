import React from 'react';

export function EmailWorkflowsTabs({
  activeTab,
  onChange,
  templatesCount,
  approvalsCount,
  radiusClass,
}: {
  activeTab: 'templates' | 'approvals';
  onChange: (tab: 'templates' | 'approvals') => void;
  templatesCount: number;
  approvalsCount: number;
  radiusClass: string;
}) {
  const tabClass = (selected: boolean) =>
    `flex-1 py-2 px-4 ${radiusClass} font-medium text-sm transition-all ${
      selected
        ? 'bg-primary-600 text-white shadow-lg'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;
  return (
    <div className="card p-1">
      <div className="flex space-x-1">
        <button
          onClick={() => onChange('templates')}
          className={tabClass(activeTab === 'templates')}
        >
          Templates ({templatesCount})
        </button>
        <button
          onClick={() => onChange('approvals')}
          className={tabClass(activeTab === 'approvals')}
        >
          Pending Approvals ({approvalsCount})
        </button>
      </div>
    </div>
  );
}
