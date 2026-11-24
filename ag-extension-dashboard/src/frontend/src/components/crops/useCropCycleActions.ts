import { useState } from 'react';
import { createCropCycle, deleteCropCycle, updateCropCycle, type CropCycle, type Field } from '@/api/fieldService';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLanguage } from '@/lib/LanguageContext';

type Notify = (notification: { type: 'success' | 'error' | 'warning'; message: string }) => void;

const today = () => new Date().toISOString().split('T')[0];
const emptyCycleForm = () => ({ cropName: '', variety: '', plantingDate: today(), expectedHarvestDate: '', notes: '' });
const emptyHarvestForm = () => ({ status: 'harvested' as 'harvested' | 'failed', actualHarvestDate: today(), yieldKg: '', notes: '' });

/** The confirmation for a save, which says so when the save is waiting on this device. */
export function useSavedNotice() {
  const { t } = useLanguage();
  return (queued: boolean | undefined, online: string) =>
    queued ? t('saved_offline_notice', { defaultValue: 'Saved on this device. It syncs when you are back online.' }) : online;
}

/** Starting, harvesting and deleting crop cycles, with or without a connection. */
export function useCropCycleActions({ notify, onSaved }: { notify: Notify; onSaved: () => void }) {
  const savedNotice = useSavedNotice();
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<CropCycle | null>(null);
  const [cycleForm, setCycleForm] = useState(emptyCycleForm);
  const [harvestForm, setHarvestForm] = useState(emptyHarvestForm);

  const handleOpenStartCycle = (field: Field) => {
    setSelectedField(field);
    setCycleForm(emptyCycleForm());
    setShowCycleModal(true);
  };

  const handleStartCycle = async () => {
    if (!selectedField || !cycleForm.cropName || !cycleForm.plantingDate) {
      notify({ type: 'warning', message: 'Crop Name and Planting Date are required' });
      return;
    }
    const data = {
      cropName: cycleForm.cropName,
      variety: cycleForm.variety || undefined,
      status: 'growing' as const,
      plantingDate: new Date(cycleForm.plantingDate).toISOString(),
      expectedHarvestDate: cycleForm.expectedHarvestDate ? new Date(cycleForm.expectedHarvestDate).toISOString() : undefined,
      notes: cycleForm.notes || undefined,
    };
    try {
      const res = await createCropCycle(selectedField.id, data);
      if (!res.success) throw new Error(res.error || 'Failed to start crop cycle');
      notify({ type: 'success', message: savedNotice(res.queued, `Started growing ${data.cropName} on ${selectedField.name}`) });
      setShowCycleModal(false);
      onSaved();
    } catch (error) {
      console.error('Failed to start cycle:', error);
      notify({ type: 'error', message: getApiErrorMessage(error, 'Failed to start crop cycle') });
    }
  };

  const handleOpenHarvest = (field: Field, cycle: CropCycle) => {
    setSelectedField(field);
    setSelectedCycle(cycle);
    setHarvestForm(emptyHarvestForm());
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
      if (!res.success) throw new Error(res.error || 'Failed to update crop cycle');
      const online = harvestForm.status === 'harvested' ? `Harvest recorded! Yield: ${data.yieldKg || 0} kg` : `Crop cycle marked as ${harvestForm.status}`;
      notify({ type: 'success', message: savedNotice(res.queued, online) });
      setShowHarvestModal(false);
      onSaved();
    } catch (error) {
      console.error('Failed to record harvest:', error);
      notify({ type: 'error', message: getApiErrorMessage(error, 'Failed to update crop cycle') });
    }
  };

  const handleDeleteCycle = async (fieldId: string, cycleId: string) => {
    if (!confirm('Are you sure you want to delete this crop cycle?')) return;
    try {
      const res = await deleteCropCycle(fieldId, cycleId);
      if (!res.success) throw new Error(res.error || 'Failed to delete cycle');
      notify({ type: 'success', message: savedNotice(res.queued, 'Crop cycle deleted') });
      onSaved();
    } catch (error) {
      console.error('Failed to delete cycle:', error);
      notify({ type: 'error', message: getApiErrorMessage(error, 'Failed to delete cycle') });
    }
  };

  return {
    showCycleModal, setShowCycleModal, showHarvestModal, setShowHarvestModal, selectedField, selectedCycle,
    cycleForm, setCycleForm, harvestForm, setHarvestForm,
    handleOpenStartCycle, handleStartCycle, handleOpenHarvest, handleHarvestCycle, handleDeleteCycle,
  };
}
