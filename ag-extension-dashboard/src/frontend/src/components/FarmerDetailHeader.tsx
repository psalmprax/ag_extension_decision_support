import React from 'react';
import { Farmer } from '@/types/dashboard';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import {
  X,
  MapPin,
  Maximize2,
  Phone,
  Activity,
  Edit2,
  Save,
  Share2,
  Trash2,
  MoreVertical,
} from 'lucide-react';

interface FarmerDetailHeaderProps {
  farmer: Farmer;
  editData: Farmer;
  setEditData: (data: Farmer) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  handleSave: () => void;
  handleShare: () => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  setIsDeleteModalOpen: (v: boolean) => void;
  onClose: () => void;
  radiusClass: string;
  isCyber: boolean;
}

export const FarmerDetailHeader: React.FC<FarmerDetailHeaderProps> = ({
  farmer,
  editData,
  setEditData,
  isEditing,
  setIsEditing,
  handleSave,
  handleShare,
  handleContextMenu,
  setIsDeleteModalOpen,
  onClose,
  radiusClass,
  isCyber,
}) => {
  return (
    <div className="relative h-64 flex-shrink-0" onContextMenu={handleContextMenu}>
      <div
        className={`absolute inset-0 opacity-90 bg-gradient-to-br from-primary-600 to-secondary-700`}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary-800/40 to-secondary-900/40" />

      {isCyber && <div className="absolute inset-0 cyber-grid-premium opacity-20" />}

      <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
        <button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className={`p-2 backdrop-blur-md rounded-full text-white transition-all ${isEditing ? 'bg-primary-500/40 border border-primary-500/30' : 'bg-white/10 hover:bg-white/20'}`}
          title={isEditing ? 'Save Changes' : 'Edit Farmer'}
        >
          {isEditing ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
        </button>
        <button
          onClick={handleShare}
          className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-white/10 hover:bg-white/20"
          title="Share Farmer Information"
        >
          <Share2 className="w-5 h-5" />
        </button>
        <button
          onClick={handleContextMenu}
          className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-white/10 hover:bg-white/20"
          title="More Actions"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30"
          title="Delete Farmer"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 backdrop-blur-md rounded-full text-white transition-all bg-white/10 hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-end gap-6">
          <div className={`w-24 h-24 ${radiusClass} p-1 shadow-2xl bg-white`}>
            <div
              className={`w-full h-full ${radiusClass} flex items-center justify-center font-black text-4xl bg-primary-100 text-primary-600`}
            >
              {farmer.firstName?.[0]}
              {farmer.lastName?.[0]}
            </div>
          </div>
          <div className="mb-2">
            <h2 className={`text-3xl font-black leading-none mb-2 text-white`}>
              {farmer.firstName} {farmer.lastName}
            </h2>
            <div className="flex items-center gap-4 text-white/80 text-sm font-medium">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {isEditing ? (
                  <Input
                    type="text"
                    value={editData.region || ''}
                    onChange={e => setEditData({ ...editData, region: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder-white/40 !h-7 !px-2 !py-0.5 !text-xs !rounded"
                    placeholder="Region"
                  />
                ) : (
                  <span>
                    {farmer.region}, {farmer.village}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4" />
                {isEditing ? (
                  <Input
                    type="number"
                    value={editData.farmSize || 0}
                    onChange={e => setEditData({ ...editData, farmSize: Number(e.target.value) })}
                    className="bg-white/10 border-white/20 text-white !h-7 !px-2 !py-0.5 !text-xs !rounded !w-16"
                  />
                ) : (
                  <span>{farmer.farmSize} ha</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                {isEditing ? (
                  <Input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder-white/40 !h-7 !px-2 !py-0.5 !text-xs !rounded !w-32"
                    placeholder="Phone"
                  />
                ) : (
                  <span>{farmer.phone || 'No phone'}</span>
                )}
              </div>
              {isEditing && (
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  <Select
                    value={editData.status || 'active'}
                    onChange={e => setEditData({ ...editData, status: e.target.value })}
                    className="bg-white/10 border-white/20 text-white !h-7 !px-2 !py-0.5 !text-xs !rounded"
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'suspended', label: 'Suspended' },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
