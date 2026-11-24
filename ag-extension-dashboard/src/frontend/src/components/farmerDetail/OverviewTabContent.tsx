import React from 'react';
import { Farmer, Visit } from '@/types/dashboard';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { FarmerYieldChart } from '../FarmerYieldChart';
import { ScoreMeter } from '@/components/charts/ScoreMeter';
import { FarmerVisitTimeline } from '../FarmerVisitTimeline';
import { MessageSquare, Phone, Video, Sprout, Activity, Mail } from 'lucide-react';
import { isActionEnter } from '@/lib/keyboard';


export const CropsSection = ({
  farmer,
  isEditing,
  editData,
  setEditData,
  radiusClass,
  t,
}: {
  farmer: Farmer;
  isEditing: boolean;
  editData: Record<string, unknown>;
  setEditData: (d: Record<string, unknown>) => void;
  radiusClass: string;
  t: (key: string) => string;
}) => (
  <section
    className={`p-6 ${radiusClass} border shadow-sm bg-theme-bg-card dark:bg-theme-bg-tertiary/80 border-gray-100 dark:border-white/[0.12]`}
  >
    <h3
      className={`text-xs font-medium mb-4 flex items-center gap-2 text-gray-400`}
    >
      <Sprout className={`w-4 h-4 text-green-500`} />
      {t('table_crops')}
    </h3>
    {isEditing ? (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {((editData.crops as string[]) || []).map((crop: string, i: number) => (
            <Badge key={i} variant="info" size="sm" className="flex items-center gap-1">
              {crop}
              <button
                type="button"
                onClick={() =>
                  setEditData({
                    ...editData,
                    crops: (editData.crops as string[])?.filter(
                      (_: string, idx: number) => idx !== i
                    ),
                  })
                }
                className="ms-1 text-red-700 dark:text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            size="sm"
            placeholder="Add crop..."
            onKeyDown={e => {
              if (!isActionEnter(e)) return;
              e.preventDefault();
              const input = e.target as HTMLInputElement;
              const val = input.value.trim();
              const crops = (editData.crops as string[]) || [];
              if (val && !crops.includes(val)) {
                setEditData({ ...editData, crops: [...crops, val] });
                input.value = '';
              }
            }}
          />
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap gap-2">
        {(farmer.crops || []).map((crop: string, i: number) => (
          <Badge key={`${crop}-${i}`} variant="info" size="sm">
            {crop}
          </Badge>
        ))}
      </div>
    )}
  </section>
);

export const VitalStatsSection = ({
  farmer,
  isEditing,
  editData,
  setEditData,
  radiusClass,
  t,
}: {
  farmer: Farmer;
  isEditing: boolean;
  editData: Record<string, unknown>;
  setEditData: (d: Record<string, unknown>) => void;
  radiusClass: string;
  t: (key: string) => string;
}) => (
  <section
    className={`p-6 ${radiusClass} border shadow-sm bg-theme-bg-card dark:bg-theme-bg-tertiary/80 border-gray-100 dark:border-white/[0.12]`}
  >
    <h3
      className={`text-xs font-medium mb-4 flex items-center gap-2 text-gray-400`}
    >
      <Activity className={`w-4 h-4 text-secondary-500`} />
      {t('farmer_vital_score')}
    </h3>
    <div className="text-3xl font-medium leading-none text-gray-900 dark:text-white">
      {Number.isFinite(farmer.vitalScore) ? <>{farmer.vitalScore}<span className="text-sm text-slate-600 dark:text-theme-text-muted">/100</span></> : <span className="text-sm font-normal text-slate-600 dark:text-theme-text-muted">{t('farmer_vital_score_none')}</span>}
    </div>
    <div className="mt-3"><ScoreMeter value={farmer.vitalScore} max={100} /></div>
    {isEditing && (
      <div className="mt-4">
        <label className="text-xs font-medium text-gray-400 block mb-1">
          Status
        </label>
        <Select
          value={(editData.status as string) || 'Active'}
          onChange={e => setEditData({ ...editData, status: e.target.value })}
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
            { value: 'High Priority', label: 'High Priority' },
            { value: 'Special Attention', label: 'Special Attention' },
          ]}
          size="sm"
        />
      </div>
    )}
  </section>
);

export const OverviewTabContent = ({
  farmer,
  isCyber,
  radiusClass,
  isEditing,
  editData,
  setEditData,
  visits = [],
  handleUpdateVisitStatus,
  handleAction,
  showContextMenu,
  t,
}: {
  farmer: Farmer;
  isCyber: boolean;
  radiusClass: string;
  isEditing: boolean;
  editData: Record<string, unknown>;
  setEditData: (d: Record<string, unknown>) => void;
  visits?: Visit[];
  handleUpdateVisitStatus: (id: string, st: string) => void;
  handleAction: (a: string) => void;
  showContextMenu: (e: React.MouseEvent) => void;
  t: (key: string) => string;
}) => (
  <>
    {/* Action Buttons */}
    <div className="grid grid-cols-4 gap-3">
      {[
        {
          id: 'chat',
          icon: MessageSquare,
          label: t('action_chat') || 'Chat',
          color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        },
        {
          id: 'sms',
          icon: Mail,
          label: t('action_sms') || 'SMS',
          color: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-theme-text-muted',
        },
        {
          id: 'call',
          icon: Phone,
          label: t('action_call') || 'Call',
          color: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-theme-text-muted',
        },
        {
          id: 'video',
          icon: Video,
          label: t('action_video') || 'Video',
          color: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-theme-text-muted',
        },
      ].map(action => (
        <button
          key={action.id}
          onClick={() => handleAction(action.id as 'chat' | 'sms' | 'call' | 'video')}
          onContextMenu={e => {
            e.preventDefault();
            (
              showContextMenu as unknown as (data: {
                x: number;
                y: number;
                entityType: string;
                entityId?: string;
              }) => void
            )({ x: e.clientX, y: e.clientY, entityType: 'farmer', entityId: farmer.id });
          }}
          className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-theme-bg-secondary hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-900/[0.08] dark:border-white/[0.08] hover:border-slate-700 transition-colors group text-center"
        >
          <div
            className={`w-10 h-10 rounded-md border ${action.color} flex items-center justify-center mb-2`}
          >
            <action.icon className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-theme-text-secondary">{action.label}</span>
        </button>
      ))}
    </div>
    {/* Yield Performance */}
    <FarmerYieldChart farmer={farmer} radiusClass={radiusClass} />{' '}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <CropsSection
        farmer={farmer}
        isEditing={isEditing}
        editData={editData as unknown as Record<string, unknown>}
        setEditData={setEditData as unknown as (d: Record<string, unknown>) => void}
        radiusClass={radiusClass}
        t={t}
      />
      <VitalStatsSection
        farmer={farmer}
        isEditing={isEditing}
        editData={editData as unknown as Record<string, unknown>}
        setEditData={setEditData as unknown as (d: Record<string, unknown>) => void}
        radiusClass={radiusClass}
        t={t}
      />
    </div>
    {/* Visit Timeline */}
    <FarmerVisitTimeline
      visits={visits}
      handleUpdateVisitStatus={
        handleUpdateVisitStatus as unknown as (id: string, st: string) => void
      }
      radiusClass={radiusClass}
      isCyber={isCyber}
    />
  </>
);
