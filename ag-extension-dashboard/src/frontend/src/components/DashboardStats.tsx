import { useDesign } from '@/hooks/useDesignVariant';
import { useLanguage } from '@/lib/LanguageContext';
import { Users, Calendar, MessageSquare, TrendingUp } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
}

const CurrentStatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon }) => (
  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-gray-500" />
      <span className="text-xs text-gray-500 uppercase">{title}</span>
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    {change && <div className="text-xs text-gray-400">{change}</div>}
  </div>
);

const NewStatCard: React.FC<StatCardProps> = ({ title, value, change, icon: Icon }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10 transition-all">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        {change && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {change}
          </p>
        )}
      </div>
      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
        <Icon className="w-6 h-6 text-green-600 dark:text-green-400" />
      </div>
    </div>
  </div>
);

export const DashboardStats: React.FC = () => {
  const { t } = useLanguage();

  const stats = [
    { title: 'Total Farmers', value: '1,247', change: '+12% from last month', icon: Users },
    { title: 'Visits This Month', value: '89', change: '+5% from last month', icon: Calendar },
    { title: 'Active Chats', value: '342', change: '+8% from last month', icon: MessageSquare },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => {
        const StatCard = useDesign({
          current: CurrentStatCard,
          new: NewStatCard,
        });
        return <StatCard key={index} {...stat} />;
      })}
    </div>
  );
};

export default DashboardStats;
