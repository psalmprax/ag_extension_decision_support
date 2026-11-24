import apiClient from './client';
import type { FieldWeather, SoilTest as SharedSoilTest, SoilTestInput } from '@ag-extension/shared/api';
import { isNetworkFailure, sendOrQueue } from './offlineWrites';
import { syncQueue } from './syncQueueService';
import { newRecordId } from '@/lib/randomId';
import { recallRead, rememberRead } from '@/lib/offlineReadCache';

/** A soil test; pendingSync while it is saved on this device and has not reached the server. */
export type SoilTest = SharedSoilTest & { pendingSync?: boolean };
export type { FieldWeather, SoilTestInput };

const soilTestsPath = (fieldId: string) => `/v1/fields/${fieldId}/soil-tests`;

function asSoilTest(fieldId: string, input: SoilTestInput & { id: string }): SoilTest {
  return {
    id: input.id,
    fieldId,
    testedAt: input.testedAt,
    labName: input.labName ?? null,
    sampleRef: input.sampleRef ?? null,
    ph: input.ph ?? null,
    organicCarbonPct: input.organicCarbonPct ?? null,
    organicMatterPct: input.organicMatterPct ?? null,
    nitrogenPpm: input.nitrogenPpm ?? null,
    phosphorusPpm: input.phosphorusPpm ?? null,
    potassiumPpm: input.potassiumPpm ?? null,
    pendingSync: true,
  };
}

/** Results saved or deleted on this device that the server has not heard about yet. */
function withPendingSoilTests(fieldId: string, tests: SoilTest[]): SoilTest[] {
  const path = soilTestsPath(fieldId);
  return syncQueue.getQueue().reduce((list, item) => {
    if (item.entity !== 'soil_test') return list;
    if (item.action === 'create' && item.endpoint === path) {
      const input = item.data as SoilTestInput & { id: string };
      return list.some(test => test.id === input.id) ? list : [...list, asSoilTest(fieldId, input)];
    }
    if (item.action === 'delete' && item.endpoint.startsWith(`${path}/`)) {
      const id = item.endpoint.slice(path.length + 1);
      return list.filter(test => test.id !== id);
    }
    return list;
  }, tests);
}

// Undated results go last, as the server lists them.
const byTestDay = (a: SoilTest, b: SoilTest) => (a.testedAt ?? '9999').localeCompare(b.testedAt ?? '9999');

/** Soil test results and NASA POWER weather for one saved field. */
export const fieldRecordsService = {
  /** Oldest first. Without a connection, the copy kept on this device and anything saved since. */
  async soilTests(fieldId: string): Promise<SoilTest[]> {
    const cacheKey = `soil-tests:${fieldId}`;
    try {
      const { data } = await apiClient.get(soilTestsPath(fieldId));
      rememberRead(cacheKey, data.data);
      return withPendingSoilTests(fieldId, data.data).toSorted(byTestDay);
    } catch (error) {
      if (!isNetworkFailure(error)) throw error;
      return withPendingSoilTests(fieldId, recallRead<SoilTest[]>(cacheKey)?.value ?? []).toSorted(byTestDay);
    }
  },

  async addSoilTest(fieldId: string, input: SoilTestInput): Promise<{ test: SoilTest; queued: boolean }> {
    const body = { ...input, id: newRecordId() };
    const outcome = await sendOrQueue(
      { entity: 'soil_test', action: 'create', method: 'POST', endpoint: soilTestsPath(fieldId), data: body, label: `Soil test from ${input.testedAt}` },
      async key => (await apiClient.post(soilTestsPath(fieldId), body, { headers: { 'Idempotency-Key': key } })).data.data as SoilTest
    );
    return outcome.queued ? { test: asSoilTest(fieldId, body), queued: true } : { test: outcome.result, queued: false };
  },

  /** True when the deletion is waiting on this device for a connection. */
  async deleteSoilTest(fieldId: string, testId: string): Promise<boolean> {
    const endpoint = `${soilTestsPath(fieldId)}/${testId}`;
    const outcome = await sendOrQueue(
      { entity: 'soil_test', action: 'delete', method: 'DELETE', endpoint, label: 'Delete soil test' },
      key => apiClient.delete(endpoint, { headers: { 'Idempotency-Key': key } })
    );
    return outcome.queued;
  },

  async weather(fieldId: string): Promise<FieldWeather> {
    const { data } = await apiClient.get(`/v1/fields/${fieldId}/weather`);
    return data.data;
  },
};
