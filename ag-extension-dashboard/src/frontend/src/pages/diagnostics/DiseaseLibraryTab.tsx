import React, { useState } from 'react';
import { Search, Loader2, Leaf } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  allDiseases: string[];
  radiusClass: string;
  onViewDiseaseInfo: (disease: string) => void;
}

export function DiseaseLibraryTab({ allDiseases, radiusClass, onViewDiseaseInfo }: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="card p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Disease Encyclopedia
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Browse or search our comprehensive database of crop diseases.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search diseases..."
            className={`w-full md:w-64 pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
          />
        </div>
      </div>

      {allDiseases.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allDiseases
            .filter(disease => disease.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((disease, index) => (
              <motion.div
                key={disease}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onViewDiseaseInfo(disease)}
                className={`p-4 border border-gray-200 dark:border-gray-700 ${radiusClass} hover:border-primary-500 hover:shadow-md transition-all cursor-pointer bg-gray-50 dark:bg-gray-800/50`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                    <Leaf className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                    {disease}
                  </h4>
                </div>
              </motion.div>
            ))}
          {allDiseases.filter(disease => disease.toLowerCase().includes(searchQuery.toLowerCase()))
            .length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No diseases match your search query.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      )}
    </div>
  );
}
