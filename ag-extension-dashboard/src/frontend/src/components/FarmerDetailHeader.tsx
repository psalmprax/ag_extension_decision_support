import React from 'react';
import { useAppStore } from '@/store/useAppStore';
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
import { useLanguage } from '@/lib/LanguageContext';

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
  const { t } = useLanguage();
  // Deleting a farmer is limited to admins and regional managers by the API.
  const canDelete = ['admin', 'regional_manager'].includes(useAppStore(s => s.user?.role) ?? '');
  return (
    <div className="relative h-60 flex-shrink-0 bg-white dark:bg-theme-bg-primary border-b border-emerald-500/30 overflow-hidden" onContextMenu={handleContextMenu}>
      {/* Background Neon Grid / Ambient Glow */}
      <div className="absolute inset-0 bg-white dark:bg-theme-bg-primary" />

      {/* Top Action Bar */}
      <div className="absolute top-4 end-4 flex items-center gap-1.5 z-20">
        <button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className={`p-2 rounded-[4px] text-slate-900 dark:text-theme-text-primary transition-all backdrop-blur-md ${
            isEditing
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-sm'
              : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white'
          }`}
          title={isEditing ? 'Save Changes' : 'Edit Farmer'}
        >
          {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
        </button>
        <button
          onClick={handleShare}
          className="p-2 rounded-[4px] text-slate-700 dark:text-theme-text-secondary hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-theme-bg-secondary hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-900/[0.08] dark:border-white/[0.08] transition-all backdrop-blur-md"
          title="Share Farmer Profile"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleContextMenu}
          className="p-2 rounded-[4px] text-slate-700 dark:text-theme-text-secondary hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-theme-bg-secondary hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-900/[0.08] dark:border-white/[0.08] transition-all backdrop-blur-md"
          title="More Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {canDelete && (
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 rounded-[4px] text-rose-700 dark:text-rose-400 hover:text-slate-900 dark:hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 transition-all backdrop-blur-md"
            title="Delete Farmer"
            aria-label="Delete farmer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 rounded-[4px] text-slate-600 dark:text-theme-text-muted hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-theme-bg-secondary hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-900/[0.08] dark:border-white/[0.08] transition-all backdrop-blur-md"
          title="Close Modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Profile Info */}
      <div data-scrim className="absolute bottom-0 start-0 end-0 p-6 pt-12 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
        <div className="flex items-end gap-5">
          {/* Avatar Box */}
          <div className="w-20 h-20 rounded-[4px] p-0.5 bg-slate-100 dark:bg-theme-bg-tertiary border border-slate-900/[0.08] dark:border-white/[0.08] shrink-0">
            <div className="w-full h-full rounded-[3px] flex items-center justify-center font-medium text-xl bg-slate-50 dark:bg-theme-bg-secondary text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              {farmer.firstName?.[0]}
              {farmer.lastName?.[0]}
            </div>
          </div>

          <div className="mb-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-[3px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                <Radio className="w-2.5 h-2.5" />
                {t('ui_farmer_detail_header_smallholder_profile')}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-medium text-slate-900 dark:text-theme-text-primary tracking-tight leading-tight truncate">
              {farmer.firstName} {farmer.lastName}
            </h2>

            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-theme-text-secondary">
                <MapPin className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                {isEditing ? (
                  <Input
                    type="text"
                    value={editData.region || ''}
                    onChange={e => setEditData({ ...editData, region: e.target.value })}
                    className="bg-white dark:bg-theme-bg-primary border-slate-900/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-theme-text-primary !h-5 !px-1.5 !py-0 !text-xxs !rounded"
                    placeholder="Region"
                  />
                ) : (
                  <span className="text-[11px]">{farmer.region || 'Unknown'}, {farmer.village || 'Ward'}</span>
                )}
              </div>

              <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-theme-text-secondary">
                <Maximize2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                {isEditing ? (
                  <Input
                    type="number"
                    value={editData.farmSize || 0}
                    onChange={e => setEditData({ ...editData, farmSize: Number(e.target.value) })}
                    className="bg-white dark:bg-theme-bg-primary border-slate-900/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-theme-text-primary !h-5 !px-1.5 !py-0 !text-xxs !rounded !w-14"
                  />
                ) : (
                  <span className="text-[11px] font-mono tabular-nums">{farmer.farmSize || 0} Ha</span>
                )}
              </div>

              <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-theme-text-secondary">
                <Phone className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                {isEditing ? (
                  <Input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    className="bg-white dark:bg-theme-bg-primary border-slate-900/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-theme-text-primary !h-5 !px-1.5 !py-0 !text-xxs !rounded !w-28"
                    placeholder="Phone"
                  />
                ) : (
                  <span className="text-[11px] font-mono tabular-nums">{farmer.phone || 'No phone'}</span>
                )}
              </div>

              {isEditing && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-theme-text-secondary">
                  <Activity className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  <Select
                    value={editData.status || 'active'}
                    onChange={e => setEditData({ ...editData, status: e.target.value })}
                    className="bg-white dark:bg-theme-bg-primary border-slate-900/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-theme-text-primary !h-5 !px-1.5 !py-0 !text-xxs !rounded"
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
