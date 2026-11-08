import { describe, expect, it } from 'vitest';
import { buildHazardDays, defaultFollowUpQuestions, parseFollowUpQuestions } from '../pages/farmerChatSafety';

describe('Farmer chat advisory inputs', () => {
  it('does not turn absent or null weather readings into zero', () => {
    const complete = { date: '2026-11-08', minTemp: 10, maxTemp: 25, precipitationMm: 0, relativeHumidityPct: 0, windSpeedKmh: 0 };
    expect(buildHazardDays([complete])).toEqual([{
      date: '2026-11-08', minTempC: 10, maxTempC: 25, precipitationMm: 0, relativeHumidityPct: 0, windSpeedKmh: 0,
    }]);
    expect(buildHazardDays([{ ...complete, precipitationMm: undefined }])).toEqual([]);
    expect(buildHazardDays([JSON.parse(JSON.stringify({ ...complete, relativeHumidityPct: null }))])).toEqual([]);
  });

  it('offers questions without presenting assumptions as field observations', () => {
    expect(defaultFollowUpQuestions.every(question => question.endsWith('?'))).toBe(true);
    expect(parseFollowUpQuestions('1. What crop is affected?\nApply a treatment.\n- When did it start?'))
      .toEqual(['What crop is affected?', 'When did it start?']);
  });
});
