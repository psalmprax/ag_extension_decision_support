import { Search, Filter, Download, Plus } from 'lucide-react';
import { useDesignSystemMode } from '@/hooks/useDesignSystemMode';

interface FarmerTableProps {
  farmers: Array<{
    id: string;
    name: string;
    phone: string;
    region: string;
    crops: string;
  }>;
  onSelect?: (id: string) => void;
}

const CurrentFarmerTable: React.FC<FarmerTableProps> = ({ farmers }) => {
  const { radiusClass, btnClass } = useDesignSystemMode();
  return (
  <div className={`bg-white ${radiusClass} border border-gray-200`}>
    <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
      <div className={`w-48 h-8 bg-white border border-gray-300 ${radiusClass}`} />
      <div className="flex gap-2">
        <div className={`w-20 h-8 bg-gray-300 ${radiusClass}`} />
        <div className={`w-20 h-8 bg-gray-300 ${radiusClass}`} />
      </div>
    </div>
    <table className="w-full">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="p-3">Farmer</th>
          <th className="p-3">Contact</th>
          <th className="p-3">Region</th>
          <th className="p-3">Crops</th>
        </tr>
      </thead>
      <tbody>
        {farmers.map((farmer) => (
          <tr key={farmer.id} className="border-t border-gray-100 hover:bg-gray-50">
            <td className="p-3 text-sm text-gray-900">{farmer.name}</td>
            <td className="p-3 text-sm text-gray-500">{farmer.phone}</td>
            <td className="p-3 text-sm text-gray-500">{farmer.region}</td>
            <td className="p-3 text-sm text-gray-500">{farmer.crops}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

const NewFarmerTable: React.FC<FarmerTableProps> = ({ farmers }) => {
  const { radiusClass, btnClass } = useDesignSystemMode();
  return (
  <div className={`bg-white dark:bg-gray-800 ${radiusClass} shadow-lg shadow-black/5 overflow-hidden`}>
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-100 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`w-64 h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${radiusClass} px-4 flex items-center gap-2`}>
          <Search className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Search farmers...</span>
        </div>
        <button className={`p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 ${btnClass}`}>
          <Filter className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="flex gap-2">
        <button className={`flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 ${btnClass} text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600`}>
          <Download className="w-4 h-4" />
          Export
        </button>
        <button className={`flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 ${btnClass} text-sm font-semibold text-white shadow-lg shadow-green-500/25`}>
          <Plus className="w-4 h-4" />
          Add Farmer
        </button>
      </div>
    </div>
    <table className="w-full">
      <thead>
        <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50/50 dark:bg-gray-900/50">
          <th className="p-4 w-12">
            <div className={`w-5 h-5 bg-gray-100 dark:bg-gray-700 ${radiusClass}`} />
          </th>
          <th className="p-4">Farmer</th>
          <th className="p-4">Contact</th>
          <th className="p-4">Region</th>
          <th className="p-4">Farming</th>
          <th className="p-4">Actions</th>
        </tr>
      </thead>
      <tbody>
        {farmers.map((farmer) => (
          <tr key={farmer.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors">
            <td className="p-4">
              <div className={`w-5 h-5 bg-gray-100 dark:bg-gray-700 ${radiusClass}`} />
            </td>
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                    {farmer.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white">{farmer.name}</span>
              </div>
            </td>
            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{farmer.phone}</td>
            <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{farmer.region}</td>
            <td className="p-4">
              <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                {farmer.crops}
              </span>
            </td>
            <td className="p-4">
              <div className="flex gap-1">
                <div className={`w-8 h-8 bg-gray-100 dark:bg-gray-700 ${radiusClass}`} />
                <div className={`w-8 h-8 bg-gray-100 dark:bg-gray-700 ${radiusClass}`} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

export const FarmerTable: React.FC<FarmerTableProps> = (props) => {
  const { isModern } = useDesignSystemMode();
  return isModern ? <NewFarmerTable {...props} /> : <CurrentFarmerTable {...props} />;
};

export default FarmerTable;
