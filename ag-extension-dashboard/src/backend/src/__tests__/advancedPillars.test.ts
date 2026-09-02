import { detectVernacularKeywords, transcribeVoiceNote, synthesizeVoiceAdvisory } from '../services/voiceAudioService';
import { generateIvrXml, processDtmfResponse, dispatchVoiceBroadcast } from '../services/ivrBroadcastService';
import { findNearbySuppliers, verifyBatchNumber } from '../services/inputSupplierService';
import { aggregateHarvestProjections, matchOfftakerContracts } from '../services/harvestOfftakeService';
import { calculateAgronomicRoi } from '../services/agronomicRoiService';
import { calculateSocStock, auditSoilCarbonSequestration } from '../services/soilCarbonMrvService';
import { evaluateWeatherHazards, runProactiveHazardScan } from '../services/weatherHazardDaemonService';

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Strategic Architecture Pillars (Voice, Economics, Carbon, Hazards)', () => {
  describe('Pillar 3: Voice Audio & IVR Dispatch', () => {
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

    it('generates valid TwiML / Africa’s Talking XML prompt for IVR broadcasts', () => {
      const xml = generateIvrXml({
        alertTitle: 'Tahadhari ya Viwavi wa Jeshi',
        advisorySwahili: 'Kagua mahindi yako mara moja.',
      });
      expect(xml).toContain('<Response>');
      expect(xml).toContain('<Say voice="alice" language="sw-KE">');
      expect(xml).toContain('<Gather numDigits="1"');
    });

    it('processes DTMF response digits into structured workflows', () => {
      const dtmf2 = processDtmfResponse('2');
      expect(dtmf2.action).toBe('request_officer_visit');
      expect(dtmf2.description).toContain('on-farm diagnostic visit');

      const dtmf3 = processDtmfResponse('3');
      expect(dtmf3.action).toBe('connect_agro_dealer');
    });

    it('dispatches batch voice calls to farmer lists', async () => {
      const res = await dispatchVoiceBroadcast({
        farmerPhones: ['+254711111111', '+254722222222'],
        alertTitle: 'Frost Warning',
        advisorySwahili: 'Maji majira ya jioni.',
        advisoryEnglish: 'Irrigate in evening.',
      });
      expect(res.dispatchedCount).toBe(2);
      expect(res.batchId).toContain('ivr_batch_');
    });
  });

  describe('Pillar 4: Certified Agro-Dealer Inventory & Harvest Matchmaking', () => {
    it('locates nearest verified input dealers within specified radius', () => {
      // Searching near Nakuru coordinates
      const suppliers = findNearbySuppliers({ lat: -0.2, lng: 35.9, radiusKm: 30 });
      expect(suppliers.length).toBeGreaterThan(0);
      expect(suppliers[0].isVerifiedStockist).toBe(true);
      expect(suppliers[0].location.distanceKm).toBeDefined();
    });

    it('verifies certified seed / pesticide batch authenticity against fraud', () => {
      const authentic = verifyBatchNumber('KSC-2026-MZ-8821');
      expect(authentic.isAuthentic).toBe(true);
      expect(authentic.item?.category).toBe('seed');

      const fake = verifyBatchNumber('FAKE-BATCH-9999');
      expect(fake.isAuthentic).toBe(false);
      expect(fake.verificationSource).toContain('Suspected Counterfeit');
    });

    it('aggregates projected cooperative yields and calculates bulk premiums', () => {
      const aggregation = aggregateHarvestProjections({ crop: 'Maize', county: 'Nakuru', totalAcreage: 500 });
      expect(aggregation.projectedMetricTons).toBe(900);
      expect(aggregation.bulkContractValueKes).toBeGreaterThan(aggregation.spotMarketValueKes);
      expect(aggregation.projectedCooperativePremiumKes).toBeGreaterThan(0);
    });

    it('matches harvest projections with accredited institutional buyers', () => {
      const match = matchOfftakerContracts({ crop: 'Maize', county: 'Nakuru', totalAcreage: 300 });
      expect(match.matchedBuyers.length).toBeGreaterThan(0);
      expect(match.matchedBuyers[0].buyer.category).toBeDefined();
      expect(match.matchedBuyers[0].totalOfferValueKes).toBeGreaterThan(0);
    });
  });

  describe('Pillar 5: Agronomic ROI & Soil Carbon MRV Engine', () => {
    it('computes yield differential, net profit gains, and benefit-cost ratio', () => {
      const roi = calculateAgronomicRoi({
        crop: 'Maize',
        hectares: 2.5,
        controlYieldTons: 2.2,
        advisoryYieldTons: 4.8,
      });

      expect(roi.differential.yieldGainPct).toBeGreaterThan(100);
      expect(roi.differential.netProfitGainKes).toBeGreaterThan(0);
      expect(roi.differential.benefitCostRatio).toBeGreaterThan(1.0);
      expect(roi.executiveSummary).toContain('Benefit-Cost Ratio');
    });

    it('quantifies Soil Organic Carbon stock (tC/ha) via IPCC Tier 2 methodology', () => {
      // 0-30cm, 1.3 g/cm³, 3.2% SOM, 0.05 coarse
      const socStock = calculateSocStock({
        sampleId: 'sample-001',
        depthCm: 30,
        bulkDensityGPerCm3: 1.3,
        organicMatterPct: 3.2,
        coarseFragmentFraction: 0.05,
        testedAt: '2026-01-01',
      });
      // Expected ~ 68.7 t C/ha
      expect(socStock).toBeGreaterThan(60);
      expect(socStock).toBeLessThan(80);
    });

    it('audits multi-year soil carbon sequestration and carbon credit revenue', () => {
      const baseline = {
        sampleId: 'base',
        depthCm: 30,
        bulkDensityGPerCm3: 1.3,
        organicMatterPct: 2.5,
        coarseFragmentFraction: 0.05,
        testedAt: '2024-01-01',
      };
      const current = {
        sampleId: 'curr',
        depthCm: 30,
        bulkDensityGPerCm3: 1.28,
        organicMatterPct: 3.4,
        coarseFragmentFraction: 0.05,
        testedAt: '2026-01-01',
      };

      const audit = auditSoilCarbonSequestration({
        baselineSample: baseline,
        currentSample: current,
        hectares: 150,
        carbonCreditPriceUsd: 25.0,
      });

      expect(audit.deltaSocTCPerHa).toBeGreaterThan(0);
      expect(audit.totalCo2EquivalentSequesteredTons).toBeGreaterThan(0);
      expect(audit.estimatedCarbonRevenueUsd).toBeGreaterThan(0);
      expect(audit.complianceTier).toBe('IPCC Tier 2 (Soil-Specific MRV)');
    });
  });

  describe('Pillar 6: Proactive Weather Hazard Engine', () => {
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

    it('executes proactive hazard scan and auto-triggers notification dispatch', async () => {
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

      expect(result.autoAlertTriggered).toBe(true);
      expect(result.dispatchedNotificationCount).toBe(300);
      expect(result.hazardsDetected[0].hazardType).toBe('frost');
    });
  });
});
