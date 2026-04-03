import { useDesign } from '@/hooks/useDesignVariant';
import { CreditCard, Download, Receipt, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface Transaction {
  id: string;
  amount: string;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  method: string;
  date: string;
  description: string;
}

interface BillingDashboardProps {
  transactions: Transaction[];
  currentPlan: string;
  usagePercent: number;
}

const CurrentBillingDashboard: React.FC<BillingDashboardProps> = ({ transactions }) => (
  <div className="p-4">
    <div className="text-lg font-semibold text-gray-900 mb-4">Billing</div>
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="p-4 bg-gray-100 rounded">
        <div className="text-xs text-gray-500">Total Spent</div>
        <div className="text-xl font-bold">$124.99</div>
      </div>
      <div className="p-4 bg-gray-100 rounded">
        <div className="text-xs text-gray-500">This Month</div>
        <div className="text-xl font-bold">$49.99</div>
      </div>
      <div className="p-4 bg-gray-100 rounded">
        <div className="text-xs text-gray-500">Remaining</div>
        <div className="text-xl font-bold">$75.01</div>
      </div>
    </div>
    <div className="bg-white border border-gray-200 rounded">
      <div className="p-3 border-b border-gray-200 font-medium">Recent Transactions</div>
      {transactions.map((tx) => (
        <div key={tx.id} className="p-3 border-b border-gray-100 flex justify-between">
          <div className="text-sm">{tx.description}</div>
          <div className="text-sm font-medium">{tx.amount}</div>
        </div>
      ))}
    </div>
  </div>
);

const NewBillingDashboard: React.FC<BillingDashboardProps> = ({ transactions, currentPlan, usagePercent }) => (
  <div className="p-6 bg-gray-50 dark:bg-gray-900">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Subscription</h1>
        <p className="text-sm text-gray-500">Manage your plan and payment methods</p>
      </div>
      <button className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-green-500/25">
        <CreditCard className="w-4 h-4" />
        Upgrade Plan
      </button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg shadow-black/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
            <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Plan</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{currentPlan}</p>
          </div>
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${usagePercent}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-2">{usagePercent}% of monthly limit used</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg shadow-black/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">This Month</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">$49.99</p>
          </div>
        </div>
        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          12% less than last month
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg shadow-black/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Next Payment</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">May 1, 2026</p>
          </div>
        </div>
        <p className="text-xs text-gray-500">Auto-renewal enabled</p>
      </div>
    </div>

    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-black/5 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
        <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {transactions.map((tx) => (
          <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                tx.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                tx.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              }`}>
                {tx.status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                 tx.status === 'pending' ? <Clock className="w-5 h-5 text-yellow-600" /> :
                 <AlertCircle className="w-5 h-5 text-red-600" />}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{tx.description}</p>
                <p className="text-xs text-gray-500">{tx.date} • {tx.method}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900 dark:text-white">{tx.amount} {tx.currency}</p>
              <p className={`text-xs font-medium capitalize ${
                tx.status === 'completed' ? 'text-green-600' :
                tx.status === 'pending' ? 'text-yellow-600' :
                'text-red-600'
              }`}>{tx.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const BillingDashboardAB: React.FC<BillingDashboardProps> = (props) => {
  const Billing = useDesign({
    current: CurrentBillingDashboard,
    new: NewBillingDashboard,
  });
  return <Billing {...props} />;
};

export default BillingDashboardAB;
