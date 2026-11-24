import React, { useState, useEffect, useCallback } from 'react';
import { Sprout, Map, Plus, TrendingUp, Sliders, User, Loader2, CloudOff } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import { fetchFields, deleteField, type Field } from '../api/fieldService';
import { fetchFarmers } from '../api/farmerService';
import type { Farmer } from '../types/dashboard';
import { DEMO_FARMERS, isDemoFarmerId, buildDemoFields, useDemoMode } from '@/demo';
import { CropsOverviewTab } from '@/components/crops/CropsOverviewTab';
import { CropCyclesTable } from '@/components/crops/CropCyclesTable';
import { FieldModal } from '@/components/crops/FieldModal';
import { useFieldEditor } from '@/components/crops/useFieldEditor';
import { useCropCycleActions, useSavedNotice } from '@/components/crops/useCropCycleActions';
import { useQueueDrained } from '@/hooks/useQueueDrained';
import { GrowthCycleModal } from '@/components/crops/GrowthCycleModal';
import { HarvestModal } from '@/components/crops/HarvestModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRIMARY_BUTTON } from '@/components/ui/controlStyles';
import { StatTile } from '@/components/ui/StatTile';
import { useLanguage } from '@/lib/LanguageContext';
import { useUnits } from '@/hooks/useUnits';

export function CropsFields() {
  const { t } = useLanguage();
  const units = useUnits();
  const { radiusClass, btnClass, cardClass } = useThemeClasses();
  const { addNotification, user } = useAppStore();
  const { isDemo } = useDemoMode();

  const isFarmer = user?.role === 'farmer';

  const [fields, setFields] = useState<Field[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'cycles'>('overview');

  const [offline, setOffline] = useState(false);

  // Load farmers if user is officer/admin
  useEffect(() => {
    if (!isFarmer) {
      const loadFarmersList = async () => {
        try {
          if (isDemo) {
            const demoFarmers: Farmer[] = DEMO_FARMERS.map(f => ({
              id: f.id,
              firstName: f.firstName,
              lastName: f.lastName,
              region: f.region,
            }));
            setFarmers(demoFarmers);
            setSelectedFarmerId(previous => previous || demoFarmers[0]?.id || '');
            return;
          }

          const res = await fetchFarmers();
          if (res.success && res.data?.farmers && res.data.farmers.length > 0) {
            const list = res.data.farmers;
            setFarmers(list);
            // A reload of the list keeps the farmer the person already chose.
            setSelectedFarmerId(previous => (previous && list.some(f => f.id === previous) ? previous : list[0].id));
          } else {
            setFarmers([]);
            setSelectedFarmerId('');
          }
        } catch (error) {
          console.error('Failed to load farmers:', error);
          setFarmers([]);
          setSelectedFarmerId('');
          addNotification({
            type: 'error',
            message: 'Farmer records are unavailable. Refresh to retry.',
          });
        }
      };
      loadFarmersList();
    }
  }, [addNotification, isFarmer, isDemo]);

  // Load fields when selected farmer changes
  const loadFieldsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const targetId = isFarmer ? undefined : selectedFarmerId;
      if (!isFarmer && !selectedFarmerId) {
        setFields([]);
        setIsLoading(false);
        return;
      }

      if (targetId && isDemoFarmerId(targetId)) {
        setFields(buildDemoFields(targetId, true));
        setIsLoading(false);
        return;
      }

      const res = await fetchFields(targetId);
      setOffline(Boolean(res.offline));
      if (res.success) {
        setFields(res.data || []);
      } else {
        setFields([]);
        addNotification({
          type: 'error',
          message: 'Field records are unavailable. Refresh to retry.',
        });
      }
    } catch (error) {
      console.error('Failed to load fields:', error);
      setFields([]);
      addNotification({
        type: 'error',
        message: 'Field records are unavailable. Refresh to retry.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, isFarmer, selectedFarmerId]);

  useEffect(() => {
    loadFieldsData();
  }, [loadFieldsData]);

  // Writes saved here while offline reach the server later; show the server's copy once they do.
  useQueueDrained(loadFieldsData);

  const fieldEditor = useFieldEditor({ farmerId: isFarmer ? undefined : selectedFarmerId, notify: addNotification, onSaved: loadFieldsData });
  const { handleOpenAddField, handleOpenEditField } = fieldEditor;
  const cycles = useCropCycleActions({ notify: addNotification, onSaved: loadFieldsData });
  const savedNotice = useSavedNotice();

  const handleDeleteField = async (id: string) => {
    if (
      !confirm('Are you sure you want to delete this field? This will delete all its crop cycles.')
    )
      return;

    try {
      const res = await deleteField(id, fields.find(field => field.id === id)?.name);
      if (res.success) {
        addNotification({ type: 'success', message: savedNotice(res.queued, 'Field deleted successfully') });
        loadFieldsData();
      }
    } catch (error) {
      console.error('Failed to delete field:', error);
      addNotification({ type: 'error', message: 'Failed to delete field' });
    }
  };

  // Aggregate statistics
  const totalFieldsCount = fields.length;
  const totalAreaHectares = fields.reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);
  const activeCycles = fields.flatMap(f => f.cropCycles || []).filter(c => c.status === 'growing');
  const totalYieldKg = fields
    .flatMap(f => f.cropCycles || [])
    .filter(c => c.status === 'harvested')
    .reduce((sum, c) => sum + (c.yieldKg || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={t('ui_crops_fields_fields_geospatial_parcels')}
        description={
          isFarmer
            ? t('crops_fields_desc_farmer', { defaultValue: 'Your fields, their soil and what is growing on each.' })
            : t('crops_fields_desc_officer', { defaultValue: 'Fields and crop cycles for each farmer you advise.' })
        }
        actions={
          <>
            {!isFarmer && farmers.length > 0 && (
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.14] w-full sm:w-auto">
                <User className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                <select
                  value={selectedFarmerId}
                  onChange={e => setSelectedFarmerId(e.target.value)}
                  className="bg-transparent border-0 text-sm text-slate-900 dark:text-white focus:ring-0 focus:outline-none cursor-pointer pe-4 w-full sm:w-auto"
                  aria-label={t('crops_fields_choose_farmer', { defaultValue: 'Farmer' })}
                >
                  {farmers.map(farmer => (
                    <option key={farmer.id} value={farmer.id} className="bg-white dark:bg-theme-bg-primary text-slate-900 dark:text-white">
                      {farmer.firstName} {farmer.lastName} ({farmer.region || 'No Region'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleOpenAddField}
              disabled={!isFarmer && !selectedFarmerId}
              className={PRIMARY_BUTTON}
            >
              <Plus className="w-4 h-4" />
              <span>{t('ui_crops_fields_add_field_sector')}</span>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('ui_crops_fields_total_sectors')} icon={Map} value={totalFieldsCount} />
        <StatTile label={t('ui_crops_fields_total_cultivated_area')} icon={Sliders} value={units.area(totalAreaHectares)} />
        <StatTile label={t('ui_crops_fields_active_timelines')} icon={Sprout} value={activeCycles.length} />
        <StatTile
          label={t('ui_crops_fields_harvested_yield')}
          icon={TrendingUp}
          value={`${((Number(totalYieldKg) || 0) / 1000).toFixed(1)} ${t('ui_crops_fields_tons')}`}
        />
      </div>

      {/* ── Main Tabs Navigation ── */}
      <div className="flex border-b border-slate-200 dark:border-white/5 gap-4">
        {[
          { id: 'overview', label: t('crops_fields_tab_fields', { defaultValue: 'Fields' }), icon: Map },
          { id: 'cycles', label: t('crops_fields_tab_cycles', { defaultValue: 'Crop cycles' }), icon: Sprout },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'cycles')}
              className={`flex items-center gap-2 pb-3 font-medium text-sm transition-colors border-b-2 ${
                isActive
                  ? 'text-emerald-800 dark:text-emerald-300 border-emerald-700'
                  : 'text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-theme-text-secondary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {offline && (
        <p role="status" className="flex items-start gap-2 text-sm text-slate-700 dark:text-theme-text-secondary">
          <CloudOff className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {t('fields_offline_note', { defaultValue: 'No connection. These are the fields kept on this device; changes you make sync when you are back online.' })}
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary-400" />
          <p className="text-slate-400 text-sm font-medium">
            {t('ui_crops_fields_retrieving_agronomic_data')}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <CropsOverviewTab
              fields={fields}
              isFarmer={isFarmer}
              selectedFarmerId={selectedFarmerId}
              cardClass={cardClass}
              btnClass={btnClass}
              handleOpenEditField={handleOpenEditField}
              handleDeleteField={handleDeleteField}
              handleOpenStartCycle={cycles.handleOpenStartCycle}
              handleOpenHarvest={cycles.handleOpenHarvest}
              handleOpenAddField={handleOpenAddField}
            />
          )}

          {activeTab === 'cycles' && (
            <CropCyclesTable fields={fields} handleDeleteCycle={cycles.handleDeleteCycle} />
          )}
        </AnimatePresence>
      )}

      {/* Modals */}
      <FieldModal {...fieldEditor} radiusClass={radiusClass} />

      <GrowthCycleModal {...cycles} radiusClass={radiusClass} />
      <HarvestModal {...cycles} radiusClass={radiusClass} />
    </div>
  );
}

export default CropsFields;
