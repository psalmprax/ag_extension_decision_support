import { useDesign } from '@/hooks/useDesignVariant';
import { Phone, MapPin, Wheat, Calendar, Edit, Trash2, MessageSquare, MoreVertical } from 'lucide-react';

interface FarmerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  region: string;
  village: string;
  farmSize: number;
  crops: string[];
  yieldAmount?: number;
  joinDate: string;
}

interface FarmerDetailPanelProps {
  farmer: FarmerDetail;
  onEdit?: () => void;
  onDelete?: () => void;
  onMessage?: () => void;
}

const CurrentFarmerDetailPanel: React.FC<FarmerDetailPanelProps> = ({ farmer, onEdit, onDelete, onMessage }) => (
  <div className="w-96 bg-white border-l border-gray-200 h-full p-4">
    <div className="flex justify-between items-center mb-4">
      <div className="text-lg font-semibold">Farmer Details</div>
      <button className="p-2 hover:bg-gray-100 rounded">
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-full" />
        <div>
          <div className="font-medium">{farmer.name}</div>
          <div className="text-xs text-gray-500">Farmer</div>
        </div>
      </div>
      <div className="text-sm text-gray-600">{farmer.phone}</div>
      <div className="text-sm text-gray-600">{farmer.region}</div>
      <div className="text-sm text-gray-600">{farmer.farmSize} ha</div>
    </div>
    <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
      <button onClick={onEdit} className="flex-1 py-2 bg-gray-100 rounded text-sm">Edit</button>
      <button onClick={onMessage} className="flex-1 py-2 bg-green-500 text-white rounded text-sm">Message</button>
    </div>
  </div>
);

const NewFarmerDetailPanel: React.FC<FarmerDetailPanelProps> = ({ farmer, onEdit, onDelete, onMessage }) => (
  <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 h-full flex flex-col">
    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Farmer Profile</h2>
      <button className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
        <MoreVertical className="w-5 h-5 text-gray-500" />
      </button>
    </div>
    
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
          <span className="text-xl font-bold text-white">
            {farmer.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{farmer.name}</h3>
          <p className="text-sm text-gray-500">Extension Farmer</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{farmer.phone}</span>
          </div>
          {farmer.email && (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 mt-2">
              <span className="text-sm">{farmer.email}</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{farmer.region}, {farmer.village}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <Wheat className="w-5 h-5 text-green-600 mb-2" />
            <p className="text-xs text-gray-500">Farm Size</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{farmer.farmSize} ha</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <Calendar className="w-5 h-5 text-green-600 mb-2" />
            <p className="text-xs text-gray-500">Member Since</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{farmer.joinDate}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Crops</p>
          <div className="flex flex-wrap gap-2">
            {farmer.crops.map((crop) => (
              <span key={crop} className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                {crop}
              </span>
            ))}
          </div>
        </div>

        {farmer.yieldAmount && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Last Yield</p>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{farmer.yieldAmount} tons</p>
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
      <button
        onClick={onEdit}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors"
      >
        <Edit className="w-4 h-4" />
        Edit
      </button>
      <button
        onClick={onMessage}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition-all hover:scale-[1.02]"
      >
        <MessageSquare className="w-4 h-4" />
        Message
      </button>
    </div>
  </div>
);

export const FarmerDetailPanelAB: React.FC<FarmerDetailPanelProps> = (props) => {
  const Panel = useDesign({
    current: CurrentFarmerDetailPanel,
    new: NewFarmerDetailPanel,
  });
  return <Panel {...props} />;
};

export default FarmerDetailPanelAB;
