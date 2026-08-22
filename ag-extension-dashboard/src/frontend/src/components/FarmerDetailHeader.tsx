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
  Radio,
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
  radiusClass: _radiusClass,
  isCyber: _isCyber,
}) => {
  return (
    <div className="relative h-60 flex-shrink-0 bg-slate-950 border-b border-emerald-500/30 overflow-hidden" onContextMenu={handleContextMenu}>
      {/* Background Neon Grid / Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-slate-950/80 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]" />

      {/* Top Action Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20">
        <button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className={`p-2 rounded-[4px] text-white transition-all backdrop-blur-md ${
            isEditing
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950'
              : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white'
          }`}
          title={isEditing ? 'Save Changes' : 'Edit Farmer'}
        >
          {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
        </button>
        <button
          onClick={handleShare}
          className="p-2 rounded-[4px] text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all backdrop-blur-md"
          title="Share Farmer Profile"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleContextMenu}
          className="p-2 rounded-[4px] text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all backdrop-blur-md"
          title="More Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="p-2 rounded-[4px] text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 transition-all backdrop-blur-md"
          title="Delete Farmer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-[4px] text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all backdrop-blur-md"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Profile Info */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-12 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
        <div className="flex items-end gap-5">
          {/* Avatar Box with Glowing Rim */}
          <div className="w-20 h-20 rounded-[4px] p-0.5 shadow-2xl bg-gradient-to-br from-emerald-500 to-slate-800 shrink-0">
            <div className="w-full h-full rounded-[3px] flex items-center justify-center font-black text-2xl bg-slate-900 text-emerald-400 border border-emerald-500/30">
              {farmer.firstName?.[0]}
              {farmer.lastName?.[0]}
            </div>
          </div>

          <div className="mb-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-[3px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                SMALLHOLDER PROFILE
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight leading-tight truncate">
              {farmer.firstName} {farmer.lastName}
            </h2>

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-900/80 border border-slate-800 text-slate-300">
                <MapPin className="w-3 h-3 text-emerald-400" />
                {isEditing ? (
                  <Input
                    type="text"
                    value={editData.region || ''}
                    onChange={e => setEditData({ ...editData, region: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-white !h-5 !px-1.5 !py-0 !text-xxs !rounded"
                    placeholder="Region"
                  />
                ) : (
                  <span className="text-[11px]">{farmer.region || 'Unknown'}, {farmer.village || 'Ward'}</span>
                )}
              </div>

              <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-900/80 border border-slate-800 text-slate-300">
                <Maximize2 className="w-3 h-3 text-emerald-400" />
                {isEditing ? (
                  <Input
                    type="number"
                    value={editData.farmSize || 0}
                    onChange={e => setEditData({ ...editData, farmSize: Number(e.target.value) })}
                    className="bg-slate-950 border-slate-700 text-white !h-5 !px-1.5 !py-0 !text-xxs !rounded !w-14"
                  />
                ) : (
                  <span className="text-[11px] font-mono">{farmer.farmSize || 0} Ha</span>
                )}
              </div>

              <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-900/80 border border-slate-800 text-slate-300">
                <Phone className="w-3 h-3 text-emerald-400" />
                {isEditing ? (
                  <Input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-white !h-5 !px-1.5 !py-0 !text-xxs !rounded !w-28"
                    placeholder="Phone"
                  />
                ) : (
                  <span className="text-[11px] font-mono">{farmer.phone || 'No phone'}</span>
                )}
              </div>

              {isEditing && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-900/80 border border-slate-800 text-slate-300">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <Select
                    value={editData.status || 'active'}
                    onChange={e => setEditData({ ...editData, status: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-white !h-5 !px-1.5 !py-0 !text-xxs !rounded"
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
