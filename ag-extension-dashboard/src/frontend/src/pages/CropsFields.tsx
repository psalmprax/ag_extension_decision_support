import React, { useState, useEffect, useCallback } from 'react';
import {
    Sprout, Map, Plus, Edit, Trash2,
    TrendingUp, Sliders,
    CheckCircle, User,
    Info, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useAppStore } from '../store/useAppStore';
import {
    fetchFields, createField, updateField, deleteField,
    createCropCycle, updateCropCycle, deleteCropCycle,
    type Field, type CropCycle
} from '../api/fieldService';
import { fetchFarmers } from '../api/farmerService';
import type { Farmer } from '../types/dashboard';

export function CropsOverviewTab({
    fields,
    isFarmer,
    selectedFarmerId,
    cardClass,
    btnClass,
    handleOpenEditField,
    handleDeleteField,
    handleOpenStartCycle,
    handleOpenHarvest,
    handleOpenAddField,
}: {
    fields: Field[];
    isFarmer: boolean;
    selectedFarmerId: string;
    cardClass: string;
    btnClass: string;
    handleOpenEditField: (field: Field) => void;
    handleDeleteField: (id: string) => void;
    handleOpenStartCycle: (field: Field) => void;
    handleOpenHarvest: (field: Field, cycle: CropCycle) => void;
    handleOpenAddField: () => void;
}) {
    return (
        <motion.div
            key="overview-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
        >
            {fields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {fields.map(field => {
                        const currentCycle = field.cropCycles?.find(c => c.status === 'growing');
                        return (
                            <div
                                key={field.id}
                                className={`${cardClass} flex flex-col justify-between hover:shadow-2xl border-white/5 hover:border-white/10 transition-all duration-300`}
                            >
                                <div>
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white tracking-tight">{field.name}</h3>
                                            <p className="text-xs text-slate-500 font-mono mt-1">ID: {field.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenEditField(field)}
                                                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-cyan-400 rounded-lg transition-colors"
                                                title="Edit Field details"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteField(field.id)}
                                                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                                                title="Delete Field"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stats Indicators */}
                                    <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <span className="text-xxs font-black uppercase tracking-wider text-slate-500">Area size</span>
                                            <p className="text-sm font-bold text-slate-200 mt-0.5">{field.areaHectares} Hectares</p>
                                        </div>
                                        <div>
                                            <span className="text-xxs font-black uppercase tracking-wider text-slate-500">Soil type</span>
                                            <p className="text-sm font-bold text-slate-200 mt-0.5 capitalize">{field.soilType || 'Unspecified'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xxs font-black uppercase tracking-wider text-slate-500">Soil pH</span>
                                            <p className="text-sm font-bold text-slate-200 mt-0.5">
                                                {field.soilPh ? `${field.soilPh.toFixed(1)} pH` : 'Not Measured'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xxs font-black uppercase tracking-wider text-slate-500">Coordinates</span>
                                            <p className="text-sm font-bold text-slate-200 mt-0.5 truncate">
                                                {field.latitude && field.longitude 
                                                    ? `${field.latitude.toFixed(4)}, ${field.longitude.toFixed(4)}`
                                                    : 'No GPS Set'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Active Cycle Status Banner */}
                                    <div className="mt-4">
                                        {currentCycle ? (
                                            <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl flex items-start gap-3">
                                                <Sprout className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">Growing</span>
                                                        <span className="text-xxs font-medium text-slate-400">
                                                            Planted {new Date(currentCycle.plantingDate!).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-200 mt-1 truncate">{currentCycle.cropName} ({currentCycle.variety || 'Standard'})</h4>
                                                    {currentCycle.notes && <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">"{currentCycle.notes}"</p>}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-slate-900/30 border border-dashed border-white/10 p-4 rounded-xl text-center py-6">
                                                <Info className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                                                <p className="text-xs text-slate-400 font-semibold mb-3">No Active Crop Growth Cycles</p>
                                                <button
                                                    onClick={() => handleOpenStartCycle(field)}
                                                    className="text-xs font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 hover:bg-cyan-400/20 px-3 py-1.5 rounded-xl transition-all"
                                                >
                                                    Plant New Crop
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                {currentCycle && (
                                    <div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-2">
                                        <button
                                            onClick={() => handleOpenHarvest(field, currentCycle)}
                                            className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400/20 px-4 py-2 rounded-xl transition-all"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            Record Harvest
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-slate-900/10 border border-dashed border-white/5 rounded-3xl">
                    <Map className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-300">No Farm Sectors Found</h3>
                    <p className="text-slate-500 text-sm mt-1 mb-6">
                        {!isFarmer && !selectedFarmerId 
                            ? 'Please select a farmer to load their sectors.' 
                            : 'Start by provisioning your first agronomic field sector.'}
                    </p>
                    <button
                        onClick={handleOpenAddField}
                        disabled={!isFarmer && !selectedFarmerId}
                        className={`px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-all ${btnClass} disabled:opacity-50`}
                    >
                        Create First Sector
                    </button>
                </div>
            )}
        </motion.div>
    );
}

export function CropCycleRow({
    field,
    cycle,
    handleDeleteCycle,
}: {
    field: Field;
    cycle: CropCycle;
    handleDeleteCycle: (fieldId: string, cycleId: string) => void;
}) {
    return (
        <tr className="hover:bg-white/5 transition-colors group">
            <td className="p-4 pl-6 font-bold text-slate-200">{field.name}</td>
            <td className="p-4 font-semibold text-slate-100">{cycle.cropName}</td>
            <td className="p-4 text-slate-400 font-mono text-xs">{cycle.variety || 'N/A'}</td>
            <td className="p-4">
                <span className={`px-2.5 py-1 rounded-full text-xxs font-black uppercase tracking-widest ${
                    cycle.status === 'growing' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                    cycle.status === 'harvested' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    cycle.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-slate-800 text-slate-400'
                }`}>
                    {cycle.status}
                </span>
            </td>
            <td className="p-4 text-slate-400">
                {cycle.plantingDate ? new Date(cycle.plantingDate).toLocaleDateString() : 'N/A'}
            </td>
            <td className="p-4 text-slate-400">
                {cycle.actualHarvestDate 
                    ? new Date(cycle.actualHarvestDate).toLocaleDateString() 
                    : cycle.expectedHarvestDate
                        ? `Est: ${new Date(cycle.expectedHarvestDate).toLocaleDateString()}`
                        : 'N/A'}
            </td>
            <td className="p-4 text-right font-bold text-slate-200">
                {cycle.yieldKg !== undefined && cycle.yieldKg !== null 
                    ? `${cycle.yieldKg.toLocaleString()} kg` 
                    : '-'}
            </td>
            <td className="p-4 text-right pr-6">
                <button
                    onClick={() => handleDeleteCycle(field.id, cycle.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/5 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                    title="Delete cycle record"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
}

export function CropsCyclesTab({
    fields,
    cardClass,
    handleDeleteCycle,
}: {
    fields: Field[];
    cardClass: string;
    handleDeleteCycle: (fieldId: string, cycleId: string) => void;
}) {
    return (
        <motion.div
            key="cycles-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
        >
            {fields.flatMap(f => (f.cropCycles || []).map(c => ({ ...c, fieldName: f.name }))).length > 0 ? (
                <div className={`${cardClass} overflow-hidden border-white/5`}>
                    <div className="p-6 border-b border-white/5 bg-slate-900/20">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sprout className="w-5 h-5 text-cyan-400" />
                            Crop Growth Timeline & Performance History
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/40 text-xs font-black uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="p-4 pl-6">Sector / Field</th>
                                    <th className="p-4">Crop Name</th>
                                    <th className="p-4">Variety</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Planted</th>
                                    <th className="p-4">Harvested</th>
                                    <th className="p-4 text-right">Yield (kg)</th>
                                    <th className="p-4 text-right pr-6">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {fields.flatMap(field => (field.cropCycles || []).map(cycle => (
                                    <CropCycleRow 
                                        key={cycle.id}
                                        field={field} 
                                        cycle={cycle} 
                                        handleDeleteCycle={handleDeleteCycle} 
                                    />
                                )))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-slate-900/10 border border-dashed border-white/5 rounded-3xl">
                    <Sprout className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-300">No Crop Cycles Logged</h3>
                    <p className="text-slate-500 text-sm mt-1">
                        Active timelines will render here once you plant crops inside your farm sectors.
                    </p>
                </div>
            )}
        </motion.div>
    );
}

export function CropsFields() {
    const { t: _t } = useLanguage();
    const { headingClass, isModern, radiusClass, btnClass, cardClass } = useThemeClasses();
    const { addNotification, user } = useAppStore();

    const isFarmer = user?.role === 'farmer';

    // State
    const [fields, setFields] = useState<Field[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'cycles' | 'stats'>('overview');

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
        longitude: ''
    });

    // Form state - Crop Cycle
    const [cycleForm, setCycleForm] = useState({
        cropName: '',
        variety: '',
        plantingDate: new Date().toISOString().split('T')[0],
        expectedHarvestDate: '',
        notes: ''
    });

    // Form state - Harvest
    const [harvestForm, setHarvestForm] = useState({
        status: 'harvested' as 'harvested' | 'failed',
        actualHarvestDate: new Date().toISOString().split('T')[0],
        yieldKg: '',
        notes: ''
    });

    // Load farmers if user is officer/admin
    useEffect(() => {
        if (!isFarmer) {
            const loadFarmersList = async () => {
                try {
                    const res = await fetchFarmers();
                    if (res.success && res.data?.farmers) {
                        setFarmers(res.data.farmers);
                        if (res.data.farmers.length > 0) {
                            // Automatically select first farmer
                            setSelectedFarmerId(res.data.farmers[0].id);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load farmers:', error);
                    addNotification({ type: 'error', message: 'Failed to load farmers' });
                }
            };
            loadFarmersList();
        }
    }, [isFarmer, addNotification]);

    // Load fields when selected farmer changes (or on mount if farmer)
    const loadFieldsData = useCallback(async () => {
        try {
            setIsLoading(true);
            const targetId = isFarmer ? undefined : selectedFarmerId;
            if (!isFarmer && !selectedFarmerId) {
                setFields([]);
                setIsLoading(false);
                return;
            }

            const res = await fetchFields(targetId);
            if (res.success && res.data) {
                setFields(res.data);
            }
        } catch (error) {
            console.error('Failed to load fields:', error);
            addNotification({ type: 'error', message: 'Failed to load fields & crops data' });
        } finally {
            setIsLoading(false);
        }
    }, [isFarmer, selectedFarmerId, addNotification]);

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
            longitude: ''
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
            longitude: field.longitude?.toString() || ''
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
            longitude: fieldForm.longitude ? parseFloat(fieldForm.longitude) : undefined
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
        if (!confirm('Are you sure you want to delete this field? This will delete all its crop cycles.')) return;

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
            notes: ''
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
            expectedHarvestDate: cycleForm.expectedHarvestDate ? new Date(cycleForm.expectedHarvestDate).toISOString() : undefined,
            notes: cycleForm.notes || undefined
        };

        try {
            const res = await createCropCycle(selectedField.id, data);
            if (res.success) {
                addNotification({ type: 'success', message: `Started growing ${data.cropName} on ${selectedField.name}` });
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
            notes: ''
        });
        setShowHarvestModal(true);
    };

    const handleHarvestCycle = async () => {
        if (!selectedField || !selectedCycle) return;

        const data = {
            status: harvestForm.status,
            actualHarvestDate: new Date(harvestForm.actualHarvestDate).toISOString(),
            yieldKg: harvestForm.yieldKg ? parseFloat(harvestForm.yieldKg) : undefined,
            notes: harvestForm.notes || undefined
        };

        try {
            const res = await updateCropCycle(selectedField.id, selectedCycle.id, data);
            if (res.success) {
                addNotification({
                    type: 'success',
                    message: harvestForm.status === 'harvested'
                        ? `Harvest recorded! Yield: ${data.yieldKg || 0} kg`
                        : `Crop cycle marked as ${harvestForm.status}`
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
    const totalAreaHectares = fields.reduce((sum, f) => sum + f.areaHectares, 0);
    const activeCycles = fields.flatMap(f => f.cropCycles || []).filter(c => c.status === 'growing');
    const totalYieldKg = fields.flatMap(f => f.cropCycles || []).filter(c => c.status === 'harvested').reduce((sum, c) => sum + (c.yieldKg || 0), 0);

    const StatCard = ({ title, value, icon: Icon, color = 'blue' }: {
        title: string;
        value: string | number;
        icon: React.ComponentType<{ className?: string }>;
        color?: string;
    }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${cardClass} p-6 hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden`}
        >
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
                    <p className="text-3xl font-black text-gray-900 dark:text-white mt-2">{value}</p>
                </div>
                <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/20 ${radiusClass} border border-${color}-200 dark:border-${color}-800/30`}>
                    <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
                </div>
            </div>
            {/* Ambient background glow */}
            <div className={`absolute -right-4 -bottom-4 w-20 h-20 bg-${color}-500/5 dark:bg-${color}-400/5 rounded-full blur-xl pointer-events-none`} />
        </motion.div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className={`text-4xl font-black tracking-tighter font-headline mb-2 ${headingClass}`}>
                        {isModern ? 'Agronomic Topology' : 'Fields & Crop Cycles'}
                    </h1>
                    <p className="text-slate-400 font-medium">
                        {isFarmer 
                            ? 'Manage your farm sectors, track soil profiles, and crop growing timelines.'
                            : 'Monitor agronomic fields and lifecycle performance metrics for registered farmers.'}
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    {/* Farmer Select (Officer/Admin only) */}
                    {!isFarmer && farmers.length > 0 && (
                        <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/5 shadow-inner">
                            <User className="w-4 h-4 text-cyan-400" />
                            <select
                                value={selectedFarmerId}
                                onChange={(e) => setSelectedFarmerId(e.target.value)}
                                className="bg-transparent border-0 text-sm font-semibold text-slate-200 focus:ring-0 focus:outline-none cursor-pointer pr-8"
                            >
                                {farmers.map(farmer => (
                                    <option key={farmer.id} value={farmer.id} className="bg-slate-950 text-slate-200">
                                        {farmer.firstName} {farmer.lastName} ({farmer.region || 'No Region'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={handleOpenAddField}
                        disabled={!isFarmer && !selectedFarmerId}
                        className={`flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-95 ${btnClass} disabled:opacity-50`}
                    >
                        <Plus className="w-5 h-5" />
                        Add Field Sector
                    </button>
                </div>
            </div>

            {/* Statistics row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Sectors"
                    value={totalFieldsCount}
                    icon={Map}
                    color="blue"
                />
                <StatCard
                    title="Total Farm Area"
                    value={`${totalAreaHectares.toFixed(1)} ha`}
                    icon={Sliders}
                    color="green"
                />
                <StatCard
                    title="Active Timelines"
                    value={activeCycles.length}
                    icon={Sprout}
                    color="cyan"
                />
                <StatCard
                    title="Total Harvested Yield"
                    value={`${(totalYieldKg / 1000).toFixed(1)} tons`}
                    icon={TrendingUp}
                    color="emerald"
                />
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex border-b border-white/5 gap-6">
                {[
                    { id: 'overview', label: 'Field Sectors', icon: Map },
                    { id: 'cycles', label: 'Growth Timelines', icon: Sprout },
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as unknown)}
                            className={`flex items-center gap-2 pb-4 font-bold text-sm tracking-wide transition-all border-b-2 uppercase ${
                                isActive 
                                    ? 'text-cyan-400 border-cyan-400' 
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
                    <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                    <p className="text-slate-400 text-sm font-semibold tracking-wide">Retrieving Agronomic Data...</p>
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
                        <CropsCyclesTab
                            fields={fields}
                            cardClass={cardClass}
                            handleDeleteCycle={handleDeleteCycle}
                        />
                    )}
                </AnimatePresence>
            )}

            {/* Modal: Add/Edit Field */}
            {showFieldModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
                    >
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Map className="w-5 h-5 text-cyan-400" />
                                    {editingField ? 'Modify Sector Details' : 'Provision New Sector'}
                                </h3>
                                <button
                                    onClick={() => setShowFieldModal(false)}
                                    className="text-slate-400 hover:text-white text-xl font-medium"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Sector Name</label>
                                        <input
                                            type="text"
                                            value={fieldForm.name}
                                            onChange={(e) => setFieldForm(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="e.g. North Plot, Hillside Sector"
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Area (Hectares)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={fieldForm.areaHectares}
                                            onChange={(e) => setFieldForm(prev => ({ ...prev, areaHectares: e.target.value }))}
                                            placeholder="e.g. 2.5"
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Soil pH Level</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={fieldForm.soilPh}
                                            onChange={(e) => setFieldForm(prev => ({ ...prev, soilPh: e.target.value }))}
                                            placeholder="e.g. 6.5"
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Soil Composition/Type</label>
                                        <select
                                            value={fieldForm.soilType}
                                            onChange={(e) => setFieldForm(prev => ({ ...prev, soilType: e.target.value }))}
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        >
                                            <option value="loam">Loam (Optimal)</option>
                                            <option value="clay">Clay</option>
                                            <option value="sand">Sandy</option>
                                            <option value="silt">Silty</option>
                                            <option value="clay-loam">Clay-Loam</option>
                                            <option value="sandy-loam">Sandy-Loam</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">GPS Latitude (Optional)</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={fieldForm.latitude}
                                            onChange={(e) => setFieldForm(prev => ({ ...prev, latitude: e.target.value }))}
                                            placeholder="e.g. -1.2863"
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">GPS Longitude (Optional)</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={fieldForm.longitude}
                                            onChange={(e) => setFieldForm(prev => ({ ...prev, longitude: e.target.value }))}
                                            placeholder="e.g. 36.8172"
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/5">
                                    <button
                                        onClick={handleSaveField}
                                        className="flex-1 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-all rounded-xl"
                                    >
                                        Save Sector
                                    </button>
                                    <button
                                        onClick={() => setShowFieldModal(false)}
                                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Modal: Start Crop Cycle */}
            {showCycleModal && selectedField && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
                    >
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Sprout className="w-5 h-5 text-cyan-400" />
                                    Plant Crop: {selectedField.name}
                                </h3>
                                <button
                                    onClick={() => setShowCycleModal(false)}
                                    className="text-slate-400 hover:text-white text-xl font-medium"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Crop Type</label>
                                    <input
                                        type="text"
                                        value={cycleForm.cropName}
                                        onChange={(e) => setCycleForm(prev => ({ ...prev, cropName: e.target.value }))}
                                        placeholder="e.g. Maize, Beans, Coffee"
                                        className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Crop Variety</label>
                                    <input
                                        type="text"
                                        value={cycleForm.variety}
                                        onChange={(e) => setCycleForm(prev => ({ ...prev, variety: e.target.value }))}
                                        placeholder="e.g. H614, Katumani"
                                        className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Planting Date</label>
                                        <input
                                            type="date"
                                            value={cycleForm.plantingDate}
                                            onChange={(e) => setCycleForm(prev => ({ ...prev, plantingDate: e.target.value }))}
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Est. Harvest Date</label>
                                        <input
                                            type="date"
                                            value={cycleForm.expectedHarvestDate}
                                            onChange={(e) => setCycleForm(prev => ({ ...prev, expectedHarvestDate: e.target.value }))}
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Notes / Recommendations</label>
                                    <textarea
                                        value={cycleForm.notes}
                                        onChange={(e) => setCycleForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Add details on fertilizers applied or seeds used..."
                                        rows={3}
                                        className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none`}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/5">
                                    <button
                                        onClick={handleStartCycle}
                                        className="flex-1 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-all rounded-xl"
                                    >
                                        Initialize Growth Cycle
                                    </button>
                                    <button
                                        onClick={() => setShowCycleModal(false)}
                                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Modal: Record Harvest */}
            {showHarvestModal && selectedField && selectedCycle && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
                    >
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                    Conclude Cycle: {selectedCycle.cropName}
                                </h3>
                                <button
                                    onClick={() => setShowHarvestModal(false)}
                                    className="text-slate-400 hover:text-white text-xl font-medium"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Status Result</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setHarvestForm(prev => ({ ...prev, status: 'harvested' }))}
                                            className={`py-3 text-sm font-bold uppercase rounded-xl border transition-all ${
                                                harvestForm.status === 'harvested'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500'
                                                    : 'bg-slate-950 text-slate-400 border-white/5'
                                            }`}
                                        >
                                            Successful Harvest
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHarvestForm(prev => ({ ...prev, status: 'failed' }))}
                                            className={`py-3 text-sm font-bold uppercase rounded-xl border transition-all ${
                                                harvestForm.status === 'failed'
                                                    ? 'bg-red-500/10 text-red-400 border-red-500'
                                                    : 'bg-slate-950 text-slate-400 border-white/5'
                                            }`}
                                        >
                                            Crop Failure
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Harvest Date</label>
                                        <input
                                            type="date"
                                            value={harvestForm.actualHarvestDate}
                                            onChange={(e) => setHarvestForm(prev => ({ ...prev, actualHarvestDate: e.target.value }))}
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Yield (Kilograms)</label>
                                        <input
                                            type="number"
                                            disabled={harvestForm.status === 'failed'}
                                            value={harvestForm.status === 'failed' ? '' : harvestForm.yieldKg}
                                            onChange={(e) => setHarvestForm(prev => ({ ...prev, yieldKg: e.target.value }))}
                                            placeholder="e.g. 4500"
                                            className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-50`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">Harvest Notes / Remarks</label>
                                    <textarea
                                        value={harvestForm.notes}
                                        onChange={(e) => setHarvestForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Add concluding notes on yield, conditions, or causes of crop failure..."
                                        rows={3}
                                        className={`w-full px-4 py-2.5 bg-slate-950 border border-white/10 ${radiusClass} text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none`}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/5">
                                    <button
                                        onClick={handleHarvestCycle}
                                        className={`flex-1 px-5 py-2.5 font-bold transition-all rounded-xl ${
                                            harvestForm.status === 'harvested'
                                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                                : 'bg-red-500 hover:bg-red-600 text-white'
                                        }`}
                                    >
                                        Conclude Growth Cycle
                                    </button>
                                    <button
                                        onClick={() => setShowHarvestModal(false)}
                                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
