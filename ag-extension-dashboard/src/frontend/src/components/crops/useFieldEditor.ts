import { useState } from 'react';
import { createField, updateField, type Field } from '@/api/fieldService';
import { useUnits } from '@/hooks/useUnits';
import { getApiErrorMessage } from '@/lib/apiError';
import { boundaryMetrics } from '@ag-extension/shared/api';
import { storedBoundary, type FieldBoundary } from './boundary/boundaryModel';
import { useSavedNotice } from './useCropCycleActions';

export type FieldForm = {
  name: string;
  /** In the person's unit (hectares or acres); saved in hectares. */
  areaHectares: string;
  soilType: string;
  soilPh: string;
  latitude: string;
  longitude: string;
  /** With a boundary, the area and location are measured from it. */
  boundary: FieldBoundary | null;
};

const EMPTY_FORM: FieldForm = { name: '', areaHectares: '', soilType: 'loam', soilPh: '6.5', latitude: '', longitude: '', boundary: null };

type Notify = (notification: { type: 'success' | 'error' | 'warning'; message: string }) => void;

/** The add and edit field dialog: its form, and saving it for the chosen farmer. */
export function useFieldEditor({ farmerId, notify, onSaved }: { farmerId: string | undefined; notify: Notify; onSaved: () => void }) {
  const units = useUnits();
  const savedNotice = useSavedNotice();
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [fieldForm, setFieldForm] = useState<FieldForm>(EMPTY_FORM);

  const handleOpenAddField = () => {
    setEditingField(null);
    setFieldForm(EMPTY_FORM);
    setShowFieldModal(true);
  };

  const handleOpenEditField = (field: Field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      areaHectares: String(Math.round(units.fromHectares(Number(field.areaHectares)) * 100) / 100),
      soilType: field.soilType || 'loam',
      soilPh: field.soilPh?.toString() || '6.5',
      latitude: field.latitude?.toString() || '',
      longitude: field.longitude?.toString() || '',
      boundary: storedBoundary(field),
    });
    setShowFieldModal(true);
  };

  const handleSaveField = async () => {
    const { boundary } = fieldForm;
    if (!fieldForm.name || (!boundary && !fieldForm.areaHectares)) {
      notify({ type: 'warning', message: 'Name and Area are required' });
      return;
    }
    const removedBoundary = Boolean(editingField && storedBoundary(editingField) && !boundary);
    const data = {
      farmerId,
      name: fieldForm.name,
      soilType: fieldForm.soilType || undefined,
      soilPh: fieldForm.soilPh ? parseFloat(fieldForm.soilPh) : undefined,
      ...(boundary
        ? {
            areaHectares: boundaryMetrics(boundary.points).hectares,
            boundaryCoordinates: boundary.points,
            boundaryMethod: boundary.method,
            boundaryAccuracyM: boundary.accuracyM,
          }
        : {
            areaHectares: units.toHectares(parseFloat(fieldForm.areaHectares)),
            latitude: fieldForm.latitude ? parseFloat(fieldForm.latitude) : null,
            longitude: fieldForm.longitude ? parseFloat(fieldForm.longitude) : null,
            ...(removedBoundary ? { boundaryCoordinates: null } : {}),
          }),
    };

    try {
      const res = editingField ? await updateField(editingField.id, data) : await createField(data);
      if (!res.success) throw new Error(res.error || 'Failed to save field record');
      notify({ type: 'success', message: savedNotice(res.queued, editingField ? 'Field updated successfully' : 'Field created successfully') });
      setShowFieldModal(false);
      onSaved();
    } catch (error) {
      console.error('Failed to save field:', error);
      notify({ type: 'error', message: getApiErrorMessage(error, 'Failed to save field record') });
    }
  };

  return { showFieldModal, setShowFieldModal, editingField, fieldForm, setFieldForm, handleOpenAddField, handleOpenEditField, handleSaveField };
}
