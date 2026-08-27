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
import { useLanguage } from '../lib/LanguageContext';
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

export function CropsFields() {
  const { t: _t } = useLanguage();
  const { radiusClass, btnClass, cardClass } = useThemeClasses();
  const { addNotification, user } = useAppStore();
  const { isDemo } = useDemoMode();

  const isFarmer = user?.role === 'farmer';

  // State
  const [fields, setFields] = useState<Field[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'cycles'>('overview');

  // Modals
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

  // Form state - Crop Cycle
  const [cycleForm, setCycleForm] = useState({
    cropName: '',
    variety: '',
    plantingDate: new Date().toISOString().split('T')[0],
    expectedHarvestDate: '',
    notes: '',
  });

  // Form state - Harvest
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
            setSelectedFarmerId(demoFarmers[0]?.id || '');
            return;
          }

          const res = await fetchFarmers();
          if (res.success && res.data?.farmers && res.data.farmers.length > 0) {
            setFarmers(res.data.farmers);
            setSelectedFarmerId(res.data.farmers[0].id);
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

  // Field Actions
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
      areaHectares: field.areaHectares.toString(),
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
      areaHectares: parseFloat(fieldForm.areaHectares),
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
      {/* ── Top Bento Header: Fields & Geospatial Parcels ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0">
              <Map className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Fields & Geospatial Parcels</h1>
                <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Sprout className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Growth Cycles Active
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                {isFarmer
                  ? 'Manage farm sectors, track soil pH profiles, and monitor growth timelines.'
                  : 'Monitor agronomic fields and crop lifecycle performance for registered farmers.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            {!isFarmer && farmers.length > 0 && (
              <div className="flex items-center gap-2 bg-white/[0.04] backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shadow-sm w-full sm:w-auto">
                <User className="w-4 h-4 text-emerald-400 shrink-0" />
                <select
                  value={selectedFarmerId}
                  onChange={e => setSelectedFarmerId(e.target.value)}
                  className="bg-transparent border-0 text-xs font-semibold text-white focus:ring-0 focus:outline-none cursor-pointer pr-4 w-full sm:w-auto"
                >
                  {farmers.map(farmer => (
                    <option key={farmer.id} value={farmer.id} className="bg-slate-950 text-white">
                      {farmer.firstName} {farmer.lastName} ({farmer.region || 'No Region'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleOpenAddField}
              disabled={!isFarmer && !selectedFarmerId}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Field Sector</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Statistics Bento Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="backdrop-blur-xl bg-slate-900/60 border border-blue-500/20 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xxs font-bold text-blue-400 uppercase tracking-wider">Total Sectors</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Map className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-white font-mono">{totalFieldsCount}</p>
        </div>

        <div className="backdrop-blur-xl bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xxs font-bold text-emerald-400 uppercase tracking-wider">Total Cultivated Area</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-400 font-mono">{(Number(totalAreaHectares) || 0).toFixed(1)} ha</p>
        </div>

        <div className="backdrop-blur-xl bg-slate-900/60 border border-teal-500/20 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xxs font-bold text-teal-400 uppercase tracking-wider">Active Timelines</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-teal-300 font-mono">{activeCycles.length}</p>
        </div>

        <div className="backdrop-blur-xl bg-slate-900/60 border border-purple-500/20 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xxs font-bold text-purple-400 uppercase tracking-wider">Harvested Yield</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-purple-300 font-mono">{((Number(totalYieldKg) || 0) / 1000).toFixed(1)} tons</p>
        </div>
      </div>

      {/* ── Main Tabs Navigation ── */}
      <div className="flex border-b border-white/5 gap-4">
        {[
          { id: 'overview', label: 'Field Sectors', icon: Map },
          { id: 'cycles', label: 'Growth Timelines', icon: Sprout },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'cycles')}
              className={`flex items-center gap-2 pb-4 font-bold text-sm tracking-wide transition-all border-b-2 uppercase ${
                isActive
                  ? 'text-primary-400 border-primary-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
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
          <p className="text-slate-400 text-sm font-semibold tracking-wide">
            Retrieving Agronomic Data...
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
