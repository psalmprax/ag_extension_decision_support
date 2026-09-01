import { describe, it, expect } from 'vitest';
import {
  CrdtSyncEngine,
  compareVectorClocks,
  resolveLwwConflict,
  type CrdtFieldRecord,
} from '../services/crdtSyncService';

describe('CrdtSyncService (Conflict-Free Offline Multi-Master Sync)', () => {
  it('correctly compares vector clocks for causality ordering', () => {
    const clockA = { 'node-1': 2, 'node-2': 1 };
    const clockB = { 'node-1': 1, 'node-2': 1 };

    expect(compareVectorClocks(clockA, clockB)).toBe(1); // clockA is strictly ahead
    expect(compareVectorClocks(clockB, clockA)).toBe(-1); // clockB is strictly behind

    // Concurrent clocks
    const clockC = { 'node-1': 2, 'node-2': 0 };
    const clockD = { 'node-1': 1, 'node-2': 2 };
    expect(compareVectorClocks(clockC, clockD)).toBe(0); // concurrent
  });

  it('resolves LWW conflicts deterministically by timestamp and nodeId tie-break', () => {
    const local: CrdtFieldRecord<{ name: string }> = {
      entityId: 'farmer-1',
      entityType: 'farmer',
      value: { name: 'Local Farmer' },
      timestamp: 1000,
      nodeId: 'node-A',
    };

    const remoteNewer: CrdtFieldRecord<{ name: string }> = {
      entityId: 'farmer-1',
      entityType: 'farmer',
      value: { name: 'Remote Newer Farmer' },
      timestamp: 2000,
      nodeId: 'node-B',
    };

    const res1 = resolveLwwConflict(local, remoteNewer);
    expect(res1.updated).toBe(true);
    expect(res1.winner.value.name).toBe('Remote Newer Farmer');

    // Tie break on identical timestamp: higher nodeId wins
    const remoteTie: CrdtFieldRecord<{ name: string }> = {
      entityId: 'farmer-1',
      entityType: 'farmer',
      value: { name: 'Tie Winner' },
      timestamp: 1000,
      nodeId: 'node-Z',
    };

    const res2 = resolveLwwConflict(local, remoteTie);
    expect(res2.updated).toBe(true);
    expect(res2.winner.value.name).toBe('Tie Winner');
  });

  it('synchronizes offline updates bidirectionally between two field officer devices', () => {
    const officerDeviceA = new CrdtSyncEngine('officer-nakuru-01');
    const officerDeviceB = new CrdtSyncEngine('officer-nakuru-02');

    // Officer A records a farmer and a soil test offline
    officerDeviceA.setRecord('farmer-101', 'farmer', { name: 'Kiprop Kimutai', crop: 'Maize' });
    officerDeviceA.setRecord('soil-202', 'soil_test', { pH: 6.2, nitrogen: 'High' });

    // Officer B records a visit offline
    officerDeviceB.setRecord('visit-303', 'visit', { notes: 'Scouted for FAW damage' });

    // Device A generates delta since B's clock
    const deltaAtoB = officerDeviceA.generateSyncDelta(officerDeviceB.getClock());
    expect(deltaAtoB.deltas.length).toBe(2);

    // Device B applies delta from A
    const syncResultB = officerDeviceB.applyRemoteSyncPayload(deltaAtoB);
    expect(syncResultB.appliedCount).toBe(2);
    expect(officerDeviceB.getRecord('farmer-101')?.value).toEqual({ name: 'Kiprop Kimutai', crop: 'Maize' });

    // Device B generates delta for A
    const deltaBtoA = officerDeviceB.generateSyncDelta(officerDeviceA.getClock());
    const syncResultA = officerDeviceA.applyRemoteSyncPayload(deltaBtoA);
    expect(syncResultA.appliedCount).toBe(1);
    expect(officerDeviceA.getRecord('visit-303')?.value).toEqual({ notes: 'Scouted for FAW damage' });
  });
});
