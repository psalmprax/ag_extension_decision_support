import apiClient from './client';
import type { FieldWeather, SoilTest, SoilTestInput } from '@ag-extension/shared/api';

export type { FieldWeather, SoilTest, SoilTestInput };

/** Soil test results and NASA POWER weather for one saved field. */
export const fieldRecordsService = {
  async soilTests(fieldId: string): Promise<SoilTest[]> {
    const { data } = await apiClient.get(`/v1/fields/${fieldId}/soil-tests`);
    return data.data;
  },

  async addSoilTest(fieldId: string, input: SoilTestInput): Promise<SoilTest> {
    const { data } = await apiClient.post(`/v1/fields/${fieldId}/soil-tests`, input);
    return data.data;
  },

  async deleteSoilTest(fieldId: string, testId: string): Promise<void> {
    await apiClient.delete(`/v1/fields/${fieldId}/soil-tests/${testId}`);
  },

  async weather(fieldId: string): Promise<FieldWeather> {
    const { data } = await apiClient.get(`/v1/fields/${fieldId}/weather`);
    return data.data;
  },
};
