import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useBulkActions } from '@/hooks/useBulkActions';
import type { Farmer } from '@/types/dashboard';

const { sendBulkSMS, createFarmer, fetchFarmers, updateFarmers } = vi.hoisted(() => ({
  sendBulkSMS: vi.fn(),
  createFarmer: vi.fn(),
  fetchFarmers: vi.fn(),
  updateFarmers: vi.fn(),
}));

vi.mock('@/api/smsService', () => ({ sendBulkSMS }));
vi.mock('@/api/farmerService', () => ({ createFarmer, fetchFarmers, updateFarmers }));

function farmer(id: string, overrides: Partial<Farmer> = {}): Farmer {
  return {
    id,
    firstName: `Grace ${id}`,
    lastName: 'Wanjiru',
    phone: `+25470000${id}`,
    region: 'Nakuru',
    village: 'Bahati',
    crops: ['maize', 'beans'],
    farmSize: 1.5,
    ...overrides,
  };
}

const FARMERS = [farmer('1'), farmer('2'), farmer('3', { phone: undefined })];

interface Harness {
  selected: Set<string>;
  hook: ReturnType<typeof useBulkActions>;
}

function setup(overrides: Partial<Parameters<typeof useBulkActions>[0]> = {}) {
  const addNotification = vi.fn();
  const setActiveTab = vi.fn();
  const setShowBulkSmsComposer = vi.fn();
  const setConfirmModal = vi.fn();
  const setIsUpdatingBulk = vi.fn();
  const setIsBulkUpdateModalOpen = vi.fn();
  const removeFarmers = vi.fn(async () => undefined);
  const setFarmerList = vi.fn();

  const rendered = renderHook<Harness, unknown>(() => {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const hook = useBulkActions({
      effectiveFarmers: FARMERS,
      selectedFarmers: selected,
      setSelectedFarmers: setSelected,
      addNotification,
      setActiveTab,
      setShowBulkSmsComposer,
      setConfirmModal,
      setIsUpdatingBulk,
      setIsBulkUpdateModalOpen,
      removeFarmers,
      setFarmerList,
      ...overrides,
    });
    return { selected, hook };
  });

  return {
    ...rendered,
    addNotification,
    setActiveTab,
    setShowBulkSmsComposer,
    setConfirmModal,
    setIsUpdatingBulk,
    setIsBulkUpdateModalOpen,
    removeFarmers,
    setFarmerList,
  };
}

describe('useBulkActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    createFarmer.mockResolvedValue({ success: true });
    fetchFarmers.mockResolvedValue({ success: true, data: { farmers: [] } });
    updateFarmers.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects and deselects individual farmers without mutating the previous set', () => {
    const { result } = setup();

    act(() => {
      result.current.hook.handleSelectFarmer('1', true);
    });
    expect([...result.current.selected]).toEqual(['1']);

    act(() => {
      result.current.hook.handleSelectFarmer('2', true);
    });
    expect([...result.current.selected].sort()).toEqual(['1', '2']);

    act(() => {
      result.current.hook.handleSelectFarmer('1', false);
    });
    expect([...result.current.selected]).toEqual(['2']);
  });

  it('selects every visible farmer and clears the selection', () => {
    const { result } = setup();

    act(() => {
      result.current.hook.handleSelectAllFarmers(true);
    });
    expect([...result.current.selected].sort()).toEqual(['1', '2', '3']);

    act(() => {
      result.current.hook.handleSelectAllFarmers(false);
    });
    expect(result.current.selected.size).toBe(0);
  });

  it('only opens the SMS composer when at least one farmer is selected', () => {
    const { result, setShowBulkSmsComposer } = setup();

    act(() => {
      result.current.hook.handleBulkSMS();
    });
    expect(setShowBulkSmsComposer).not.toHaveBeenCalled();

    act(() => {
      result.current.hook.handleSelectFarmer('1', true);
    });
    act(() => {
      result.current.hook.handleBulkSMS();
    });
    expect(setShowBulkSmsComposer).toHaveBeenCalledWith(true);
  });

  it('sends nothing and warns when no selected farmer has a phone number', async () => {
    const { result, addNotification } = setup();
    act(() => {
      result.current.hook.handleSelectFarmer('3', true);
    });
    await act(async () => {
      await result.current.hook.onBulkSmsSend('Late blight alert');
    });
    expect(sendBulkSMS).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith({
      type: 'warning',
      message: 'None of the selected farmers has a phone number. No SMS was sent.',
    });
  });

  it('sends a bulk SMS to the selected phone numbers and reports the count reached', async () => {
    sendBulkSMS.mockResolvedValueOnce({ success: true });
    const { result, setActiveTab, setShowBulkSmsComposer, addNotification } = setup();

    act(() => {
      result.current.hook.handleSelectAllFarmers(true);
    });
    await act(async () => {
      await result.current.hook.onBulkSmsSend('Late blight alert: scout your plots');
    });

    // Farmer 3 has no phone number, so it is not a recipient.
    expect(sendBulkSMS).toHaveBeenCalledWith({
      recipients: ['+254700001', '+254700002'],
      message: 'Late blight alert: scout your plots',
    });
    // The success toast counts recipients actually messaged, not the raw selection size.
    expect(addNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Bulk SMS sent to 2 farmers. 1 without a phone number was skipped.',
    });
    expect(setActiveTab).toHaveBeenCalledWith('sms');
    expect(setShowBulkSmsComposer).toHaveBeenCalledWith(false);
    expect(result.current.selected.size).toBe(0);
    expect(result.current.hook.isSendingBulkSms).toBe(false);
  });

  it('surfaces an SMS provider failure instead of reporting success', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendBulkSMS.mockRejectedValueOnce(new Error('gateway timeout'));
    const { result, addNotification, setActiveTab } = setup();

    act(() => {
      result.current.hook.handleSelectFarmer('1', true);
    });
    await act(async () => {
      await result.current.hook.onBulkSmsSend('hello');
    });

    expect(addNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Error connecting to SMS service.',
    });
    expect(setActiveTab).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    expect(result.current.hook.isSendingBulkSms).toBe(false);
  });

  it('does nothing when bulk SMS is sent with an empty selection', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.hook.onBulkSmsSend('nobody');
    });
    expect(sendBulkSMS).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting and offers an undo that recreates the farmers', async () => {
    const { result, setConfirmModal, removeFarmers, addNotification, setFarmerList } = setup();

    act(() => {
      result.current.hook.handleSelectFarmer('1', true);
    });
    act(() => {
      result.current.hook.handleSelectFarmer('2', true);
    });
    act(() => {
      result.current.hook.handleBulkDelete();
    });

    const modal = setConfirmModal.mock.calls[0][0];
    expect(modal.title).toBe('Delete Farmers');
    expect(modal.variant).toBe('danger');
    expect(modal.confirmText).toBe('Delete All');
    expect(modal.message).toContain('delete 2 farmers');

    await act(async () => {
      await modal.onConfirm();
    });

    expect(setConfirmModal).toHaveBeenCalledWith(null);
    expect(removeFarmers).toHaveBeenCalledWith(['1', '2']);
    expect(result.current.selected.size).toBe(0);

    const notification = addNotification.mock.calls[0][0];
    expect(notification.type).toBe('success');
    expect(notification.message).toBe('Deleted 2 farmers.');
    expect(notification.actionLabel).toBe('Undo');

    await act(async () => {
      await notification.onAction();
    });

    expect(createFarmer).toHaveBeenCalledTimes(2);
    expect(fetchFarmers).toHaveBeenCalledTimes(1);
    expect(setFarmerList).toHaveBeenCalledWith([]);
  });

  it('reports a failed delete without offering undo', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const removeFarmers = vi.fn(async () => {
      throw new Error('FK constraint');
    });
    const { result, setConfirmModal, addNotification } = setup({ removeFarmers });

    act(() => {
      result.current.hook.handleSelectFarmer('1', true);
    });
    act(() => {
      result.current.hook.handleBulkDelete();
    });
    await act(async () => {
      await setConfirmModal.mock.calls[0][0].onConfirm();
    });

    expect(addNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Failed to delete some farmers.',
    });
    expect(consoleError).toHaveBeenCalled();
    // The selection survives so the officer can retry.
    expect(result.current.selected.size).toBe(1);
  });

  it('does not open a delete confirmation with nothing selected', () => {
    const { result, setConfirmModal } = setup();
    act(() => {
      result.current.hook.handleBulkDelete();
    });
    expect(setConfirmModal).not.toHaveBeenCalled();
  });

  it('applies a bulk update and closes the modal only on success', async () => {
    const { result, setIsUpdatingBulk, setIsBulkUpdateModalOpen, addNotification } = setup();

    act(() => {
      result.current.hook.handleSelectAllFarmers(true);
    });
    await act(async () => {
      await result.current.hook.onBulkUpdateFarmers({ region: 'Kisumu' });
    });

    expect(updateFarmers).toHaveBeenCalledWith(['1', '2', '3'], { region: 'Kisumu' });
    expect(setIsUpdatingBulk).toHaveBeenNthCalledWith(1, true);
    expect(setIsUpdatingBulk).toHaveBeenLastCalledWith(false);
    expect(setIsBulkUpdateModalOpen).toHaveBeenCalledWith(false);
    expect(addNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Bulk update applied to 3 farmers.',
    });
  });

  it('keeps the update modal open and reports the error when the update fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    updateFarmers.mockRejectedValueOnce(new Error('validation failed'));
    const { result, setIsBulkUpdateModalOpen, addNotification } = setup();

    act(() => {
      result.current.hook.handleSelectFarmer('1', true);
    });
    await act(async () => {
      await result.current.hook.onBulkUpdateFarmers({ region: 'Kisumu' });
    });

    expect(setIsBulkUpdateModalOpen).not.toHaveBeenCalledWith(false);
    expect(addNotification).toHaveBeenCalledWith({
      type: 'error',
      message: 'Error applying bulk update.',
    });
    expect(consoleError).toHaveBeenCalled();
  });

  it('exports the selection as a quoted CSV download with a dated filename', () => {
    vi.useFakeTimers();
    const { result, addNotification } = setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    act(() => {
      result.current.hook.handleSelectFarmer('1', true);
    });
    act(() => {
      result.current.hook.handleBulkExport();
    });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    // The URL is released after the browser has started the download.
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    vi.useRealTimers();
    expect(addNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Exported 1 farmers to CSV',
    });
    expect(result.current.selected.size).toBe(0);
  });

  it('exports everyone listed when nothing is selected', () => {
    const { result, addNotification } = setup();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    act(() => {
      result.current.hook.handleBulkExport();
    });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'success', message: expect.stringMatching(/^Exported \d+ farmers to CSV$/) }));
  });
});
