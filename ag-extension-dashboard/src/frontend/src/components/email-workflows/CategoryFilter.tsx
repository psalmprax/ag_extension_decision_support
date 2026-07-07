import React from 'react';
import { Filter } from 'lucide-react';

export function EmailWorkflowsCategoryFilter({
  categories,
  selected,
  onChange,
  radiusClass,
}: {
  categories: string[];
  selected: string;
  onChange: (value: string) => void;
  radiusClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Filter className="w-4 h-4 text-gray-400" />
      <select
        value={selected}
        onChange={e => onChange(e.target.value)}
        className={`px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
      >
        <option value="all">All Categories</option>
        {categories.map(category => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>
  );
}
