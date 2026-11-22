import { detectVernacularKeywords, transcribeVoiceNote, synthesizeVoiceAdvisory } from '../services/voiceAudioService';
import { evaluateWeatherHazards, runProactiveHazardScan } from '../services/weatherHazardDaemonService';
import { query } from '../services/databaseService';

jest.mock('../services/databaseService', () => ({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }));
jest.mock('../services/notificationService', () => ({ notificationService: { send: jest.fn() } }));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Voice and weather hazard capabilities', () => {
  describe('Voice audio', () => {
    it('detects Swahili agronomic terminology from voice transcripts', () => {
      const { keywords, detectedLanguage } = detectVernacularKeywords('Habari, nina shida ya viwavi kwenye mahindi yangu');
      expect(detectedLanguage).toBe('sw');
      expect(keywords.some(k => k.includes('mahindi'))).toBe(true);
      expect(keywords.some(k => k.includes('viwavi') || k.includes('kiwavi'))).toBe(true);
    });

    it('transcribes voice notes and extracts agronomic payload', async () => {
      const result = await transcribeVoiceNote({ languageHint: 'sw' });
      expect(result.detectedLanguage).toBe('sw');
      // No audioBuffer supplied → stub path: marked [STUB] with 0 confidence (honest, not a real STT result)
      expect(result.confidence).toBe(0);
      expect(result.transcription).toContain('[STUB');
      expect(result.transcription.length).toBeGreaterThan(10);
    });

    it('synthesizes voice advisory audio headers', async () => {
      const result = await synthesizeVoiceAdvisory({ text: 'Tumia mbolea ya kupandia kwa kiasi sahihi', language: 'sw' });
      expect(result.format).toBe('audio/ogg');
      expect(result.durationSeconds).toBeGreaterThan(0);
      expect(typeof result.audioBase64).toBe('string');
    });

  });

  describe('Weather hazard evaluation', () => {
    it('detects severe frost hazard when night temperature drops below 3.5°C', () => {
      const forecast = [
        {
          date: '2026-09-03',
          minTempC: 2.1,
          maxTempC: 18.0,
          precipitationMm: 0,
          relativeHumidityPct: 65,
          windSpeedKmh: 8,
        },
      ];

      const hazards = evaluateWeatherHazards(forecast);
      expect(hazards).toHaveLength(1);
      expect(hazards[0].hazardType).toBe('frost');
      expect(hazards[0].threatLevel).toBe('watch');
    });

    it('detects flash flood / leaching hazard on extreme precipitation', () => {
      const forecast = [
        {
          date: '2026-09-04',
          minTempC: 16.0,
          maxTempC: 24.0,
          precipitationMm: 85.0,
          relativeHumidityPct: 92,
          windSpeedKmh: 28,
        },
      ];

      const hazards = evaluateWeatherHazards(forecast);
      expect(hazards.some(h => h.hazardType === 'flash_flood')).toBe(true);
      expect(hazards[0].threatLevel).toBe('emergency');
    });

    it('does not claim notifications were sent when no recipients were resolved', async () => {
      const forecast = [
        {
          date: '2026-09-05',
          minTempC: 1.0,
          maxTempC: 15.0,
          precipitationMm: 0,
          relativeHumidityPct: 60,
          windSpeedKmh: 5,
        },
      ];

      const result = await runProactiveHazardScan({
        county: 'Nyandarua',
        forecast,
        farmerCount: 300,
      });

      expect(result.autoAlertTriggered).toBe(false);
      expect(result.dispatchedNotificationCount).toBe(0);
      expect(result.hazardsDetected[0].hazardType).toBe('frost');
    });

    it('reports a failed recipient lookup instead of a fabricated dispatch count', async () => {
      jest.mocked(query).mockRejectedValueOnce(new Error('database unavailable'));
      const result = await runProactiveHazardScan({
        county: 'Nyandarua', farmerCount: 300, forecast: [{
          date: '2026-09-05', minTempC: 1, maxTempC: 15,
          precipitationMm: 0, relativeHumidityPct: 60, windSpeedKmh: 5,
        }],
      });
      expect(result.autoAlertTriggered).toBe(false);
      expect(result.dispatchedNotificationCount).toBe(0);
      expect(result.dispatchErrors).toBe(1);
    });
  });
});
