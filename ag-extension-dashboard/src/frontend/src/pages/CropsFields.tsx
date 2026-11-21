import React, { useState, useEffect, useCallback } from 'react';
import {
  Sprout,
  Map,
  Plus,
  TrendingUp,
  Sliders,
  User,
  Loader2,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import {
  fetchFields,
  createField,
  updateField,
  deleteField,
  createCropCycle,
  updateCropCycle,
  deleteCropCycle,
  type Field,
  type CropCycle,
} from '../api/fieldService';
import { fetchFarmers } from '../api/farmerService';
import type { Farmer } from '../types/dashboard';
import { DEMO_FARMERS, isDemoFarmerId, buildDemoFields, useDemoMode } from '@/demo';
import { CropsOverviewTab } from '@/components/crops/CropsOverviewTab';
import { CropCyclesTable } from '@/components/crops/CropCyclesTable';
import { FieldModal } from '@/components/crops/FieldModal';
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

  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showHarvestModal, setShowHarvestModal] = useState(false);

  const [editingField, setEditingField] = useState<Field | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<CropCycle | null>(null);

  // Form state - Field
  const [fieldForm, setFieldForm] = useState({
    name: '',
    areaHectares: '',
    soilType: '',
    soilPh: '',
    latitude: '',
    longitude: '',
  });

  const [cycleForm, setCycleForm] = useState({
    cropName: '',
    variety: '',
    plantingDate: new Date().toISOString().split('T')[0],
    expectedHarvestDate: '',
    notes: '',
  });

  const [harvestForm, setHarvestForm] = useState({
    status: 'harvested' as 'harvested' | 'failed',
    actualHarvestDate: new Date().toISOString().split('T')[0],
    yieldKg: '',
    notes: '',
  });

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

  const handleOpenAddField = () => {
    setEditingField(null);
    setFieldForm({
      name: '',
      areaHectares: '',
      soilType: 'loam',
      soilPh: '6.5',
      latitude: '',
      longitude: '',
    });
    setShowFieldModal(true);
  };

  const handleOpenEditField = (field: Field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      // The form shows the person's unit (hectares or acres); it is saved in hectares.
      areaHectares: String(Math.round(units.fromHectares(Number(field.areaHectares)) * 100) / 100),
      soilType: field.soilType || 'loam',
      soilPh: field.soilPh?.toString() || '6.5',
      latitude: field.latitude?.toString() || '',
      longitude: field.longitude?.toString() || '',
    });
    setShowFieldModal(true);
  };

  const handleSaveField = async () => {
    if (!fieldForm.name || !fieldForm.areaHectares) {
      addNotification({ type: 'warning', message: 'Name and Area are required' });
      return;
    }

    const data = {
      farmerId: isFarmer ? undefined : selectedFarmerId,
      name: fieldForm.name,
      areaHectares: units.toHectares(parseFloat(fieldForm.areaHectares)),
      soilType: fieldForm.soilType || undefined,
      soilPh: fieldForm.soilPh ? parseFloat(fieldForm.soilPh) : undefined,
      latitude: fieldForm.latitude ? parseFloat(fieldForm.latitude) : undefined,
      longitude: fieldForm.longitude ? parseFloat(fieldForm.longitude) : undefined,
    };

    try {
      let res;
      if (editingField) {
        res = await updateField(editingField.id, data);
        addNotification({ type: 'success', message: 'Field updated successfully' });
      } else {
        res = await createField(data);
        addNotification({ type: 'success', message: 'Field created successfully' });
      }

      if (res.success) {
        setShowFieldModal(false);
        loadFieldsData();
      }
    } catch (error) {
      console.error('Failed to save field:', error);
      addNotification({ type: 'error', message: 'Failed to save field record' });
    }
  };

  const handleDeleteField = async (id: string) => {
    if (
      !confirm('Are you sure you want to delete this field? This will delete all its crop cycles.')
    )
      return;

    try {
      const res = await deleteField(id);
      if (res.success) {
        addNotification({ type: 'success', message: 'Field deleted successfully' });
        loadFieldsData();
      }
    } catch (error) {
      console.error('Failed to delete field:', error);
      addNotification({ type: 'error', message: 'Failed to delete field' });
    }
  };

  // Crop Cycle Actions
  const handleOpenStartCycle = (field: Field) => {
    setSelectedField(field);
    setCycleForm({
      cropName: '',
      variety: '',
      plantingDate: new Date().toISOString().split('T')[0],
      expectedHarvestDate: '',
      notes: '',
    });
    setShowCycleModal(true);
  };

  const handleStartCycle = async () => {
    if (!selectedField || !cycleForm.cropName || !cycleForm.plantingDate) {
      addNotification({ type: 'warning', message: 'Crop Name and Planting Date are required' });
      return;
    }

    const data = {
      cropName: cycleForm.cropName,
      variety: cycleForm.variety || undefined,
      status: 'growing' as const,
      plantingDate: new Date(cycleForm.plantingDate).toISOString(),
      expectedHarvestDate: cycleForm.expectedHarvestDate
        ? new Date(cycleForm.expectedHarvestDate).toISOString()
        : undefined,
      notes: cycleForm.notes || undefined,
    };

    try {
      const res = await createCropCycle(selectedField.id, data);
      if (res.success) {
        addNotification({
          type: 'success',
          message: `Started growing ${data.cropName} on ${selectedField.name}`,
        });
        setShowCycleModal(false);
        loadFieldsData();
      }
    } catch (error) {
      console.error('Failed to start cycle:', error);
      addNotification({ type: 'error', message: 'Failed to start crop cycle' });
    }
  };

  const handleOpenHarvest = (field: Field, cycle: CropCycle) => {
    setSelectedField(field);
    setSelectedCycle(cycle);
    setHarvestForm({
      status: 'harvested',
      actualHarvestDate: new Date().toISOString().split('T')[0],
      yieldKg: '',
      notes: '',
    });
    setShowHarvestModal(true);
  };

  const handleHarvestCycle = async () => {
    if (!selectedField || !selectedCycle) return;

    const data = {
      status: harvestForm.status,
      actualHarvestDate: new Date(harvestForm.actualHarvestDate).toISOString(),
      yieldKg: harvestForm.yieldKg ? parseFloat(harvestForm.yieldKg) : undefined,
      notes: harvestForm.notes || undefined,
    };

    try {
      const res = await updateCropCycle(selectedField.id, selectedCycle.id, data);
      if (res.success) {
        addNotification({
          type: 'success',
          message:
            harvestForm.status === 'harvested'
              ? `Harvest recorded! Yield: ${data.yieldKg || 0} kg`
              : `Crop cycle marked as ${harvestForm.status}`,
        });
        setShowHarvestModal(false);
        loadFieldsData();
      }
    } catch (error) {
      console.error('Failed to record harvest:', error);
      addNotification({ type: 'error', message: 'Failed to update crop cycle' });
    }
  };

  const handleDeleteCycle = async (fieldId: string, cycleId: string) => {
    if (!confirm('Are you sure you want to delete this crop cycle?')) return;

    try {
      const res = await deleteCropCycle(fieldId, cycleId);
      if (res.success) {
        addNotification({ type: 'success', message: 'Crop cycle deleted' });
        loadFieldsData();
      }
    } catch (error) {
      console.error('Failed to delete cycle:', error);
      addNotification({ type: 'error', message: 'Failed to delete cycle' });
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
                    <option key={farmer.id} value={farmer.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
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
                  : 'text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content renders */}
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
              handleOpenStartCycle={handleOpenStartCycle}
              handleOpenHarvest={handleOpenHarvest}
              handleOpenAddField={handleOpenAddField}
            />
          )}

          {activeTab === 'cycles' && (
            <CropCyclesTable
              fields={fields}
              handleDeleteCycle={handleDeleteCycle}
            />
          )}
        </AnimatePresence>
      )}

      {/* Modals */}
      <FieldModal
        showFieldModal={showFieldModal}
        setShowFieldModal={setShowFieldModal}
        editingField={editingField}
        fieldForm={fieldForm}
        setFieldForm={setFieldForm}
        handleSaveField={handleSaveField}
        radiusClass={radiusClass}
      />

      <GrowthCycleModal
        showCycleModal={showCycleModal}
        setShowCycleModal={setShowCycleModal}
        selectedField={selectedField}
        cycleForm={cycleForm}
        setCycleForm={setCycleForm}
        handleStartCycle={handleStartCycle}
        radiusClass={radiusClass}
      />

      <HarvestModal
        showHarvestModal={showHarvestModal}
        setShowHarvestModal={setShowHarvestModal}
        selectedField={selectedField}
        selectedCycle={selectedCycle}
        harvestForm={harvestForm}
        setHarvestForm={setHarvestForm}
        handleHarvestCycle={handleHarvestCycle}
        radiusClass={radiusClass}
      />
    </div>
  );
}

export default CropsFields;
