import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { FieldModal } from '../FieldModal';
import { useFieldEditor, type FieldForm } from '../useFieldEditor';
import { createField, updateField, type Field } from '@/api/fieldService';

vi.mock('@/api/fieldService', () => ({ createField: vi.fn(), updateField: vi.fn() }));
// The map needs a real browser; the editor around it is what these tests cover.
vi.mock('../boundary/BoundaryMap', () => ({ BoundaryMap: ({ label }: { label: string }) => <div role="region" aria-label={label} /> }));

const METRE = 1 / 111_195;
const SQUARE = [{ lat: 0, lng: 36 }, { lat: 0, lng: 36 + 100 * METRE }, { lat: 100 * METRE, lng: 36 + 100 * METRE }, { lat: 100 * METRE, lng: 36 }];
const FORM: FieldForm = { name: 'North', areaHectares: '', soilType: 'loam', soilPh: '6.5', latitude: '', longitude: '', boundary: null };

function renderModal(form: FieldForm) {
  const setFieldForm = vi.fn();
  render(<FieldModal showFieldModal setShowFieldModal={vi.fn()} editingField={null} fieldForm={form} setFieldForm={setFieldForm} handleSaveField={vi.fn()} radiusClass="" />);
  return setFieldForm;
}

describe('field form with a boundary', () => {
  it('offers to map the boundary and opens the mapping dialog', () => {
    renderModal(FORM);
    fireEvent.click(screen.getByRole('button', { name: 'Map the boundary' }));
    expect(screen.getByRole('dialog', { name: 'Map the field boundary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this boundary' })).toBeDisabled();
  });

  it('shows the measured area instead of the area and location inputs', () => {
    renderModal({ ...FORM, boundary: { points: SQUARE, method: 'walked', accuracyM: 5 } });
    expect(screen.queryByLabelText('Area (hectares)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument();
    expect(screen.getByText(/measured from the boundary/)).toBeInTheDocument();
    expect(screen.getByText(/Walked with GPS, typical error ±5 m; could be off by up to about 0.2/)).toBeInTheDocument();
  });

  it('keeps the measured area and middle when the boundary is removed', () => {
    const setFieldForm = renderModal({ ...FORM, boundary: { points: SQUARE, method: 'drawn', accuracyM: null } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove boundary' }));
    const next = setFieldForm.mock.calls[0][0](FORM) as FieldForm;
    expect(next.boundary).toBeNull();
    expect(Number(next.areaHectares)).toBeCloseTo(1, 1);
    expect(Number(next.latitude)).toBeCloseTo(50 * METRE, 5);
  });
});

describe('saving a field', () => {
  const notify = vi.fn();
  beforeEach(() => {
    vi.mocked(createField).mockReset().mockResolvedValue({ success: true });
    vi.mocked(updateField).mockReset().mockResolvedValue({ success: true });
    notify.mockReset();
  });

  it('sends the boundary, and the area it measures, for a new field', async () => {
    const { result } = renderHook(() => useFieldEditor({ farmerId: 'f-1', notify, onSaved: vi.fn() }));
    act(() => result.current.setFieldForm({ ...FORM, boundary: { points: SQUARE, method: 'walked', accuracyM: 4.5 } }));
    await act(() => result.current.handleSaveField());
    const sent = vi.mocked(createField).mock.calls[0][0] as Record<string, unknown>;
    expect(sent).toMatchObject({ farmerId: 'f-1', boundaryCoordinates: SQUARE, boundaryMethod: 'walked', boundaryAccuracyM: 4.5 });
    expect(sent.areaHectares as number).toBeCloseTo(1, 2);
    expect(sent).not.toHaveProperty('latitude');
  });

  it('clears the stored boundary when it was removed while editing', async () => {
    const field = { id: 'x', name: 'North', areaHectares: 1, boundaryCoordinates: SQUARE, boundaryMethod: 'drawn' } as unknown as Field;
    const { result } = renderHook(() => useFieldEditor({ farmerId: 'f-1', notify, onSaved: vi.fn() }));
    act(() => result.current.handleOpenEditField(field));
    act(() => result.current.setFieldForm(form => ({ ...form, boundary: null, areaHectares: '1.2' })));
    await act(() => result.current.handleSaveField());
    expect(vi.mocked(updateField).mock.calls[0][1]).toMatchObject({ boundaryCoordinates: null, areaHectares: 1.2 });
  });

  it('shows the reason the server gives for refusing a boundary', async () => {
    vi.mocked(createField).mockRejectedValue({ response: { data: { success: false, error: 'The boundary crosses itself' } } });
    const { result } = renderHook(() => useFieldEditor({ farmerId: 'f-1', notify, onSaved: vi.fn() }));
    act(() => result.current.setFieldForm({ ...FORM, boundary: { points: SQUARE, method: 'drawn', accuracyM: null } }));
    await act(() => result.current.handleSaveField());
    expect(notify).toHaveBeenCalledWith({ type: 'error', message: 'The boundary crosses itself' });
  });
});
