import { calculateVpdKPa, evaluateSmartIrrigation, type SoilProbeTelemetry } from '../services/iotTelemetryService';
import { verifyEudrDeforestationCompliance, generateFarmToForkPassport } from '../services/traceabilityPassportService';
import { findAvailableEquipment, planDroneSprayMission } from '../services/mechanizationFleetService';
import { clusterPestSightings, forecastSwarmTrajectory, type PestSightingReport } from '../services/pestSwarmRadarService';
import { findCrossBorderArbitrage } from '../services/crossBorderTradeService';

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Frontier Agricultural Capabilities (IoT, EUDR, Drone Fleet, Swarm Radar, Cross-Border Trade)', () => {
  describe('IoT & LoRaWAN Sensor Mesh & Smart Irrigation', () => {
    it('calculates Vapor Pressure Deficit (VPD) accurately', () => {
      // 25°C, 60% RH -> SVP ~ 3.17 kPa, VPD = 3.17 * 0.40 = 1.27 kPa
      const vpd = calculateVpdKPa(25, 60);
      expect(vpd).toBeGreaterThan(1.1);
      expect(vpd).toBeLessThan(1.4);
    });

    it('triggers automated irrigation when soil hits permanent wilting point', () => {
      const telemetry: SoilProbeTelemetry = {
        deviceId: 'lora-probe-01',
        sensorType: 'lorawan_dragino',
        batteryVoltage: 3.6,
        soilVwcPct: 15.2, // Below 18% wilting point threshold
        soilEcSalinityMsdPerCm: 0.8,
        soilTempC: 21.0,
        airTempC: 28.0,
        airHumidityPct: 45.0,
        recordedAt: '2026-09-01T00:00:00Z',
      };

      const decision = evaluateSmartIrrigation(telemetry);
      expect(decision.irrigationTriggered).toBe(true);
      expect(decision.soilMoistureStatus).toBe('wilting_point_risk');
      expect(decision.recommendedWaterVolumeLitersPerHa).toBeGreaterThan(20000);
    });
  });

  describe('EUDR Zero-Deforestation & GS1 Traceability Passports', () => {
    it('verifies EUDR deforestation-free compliance for export crops', () => {
      const result = verifyEudrDeforestationCompliance({
        parcelId: 'coffee-plot-nakuru-01',
        country: 'Kenya',
        commodity: 'coffee',
        centroid: [-0.18, 35.95],
        polygonVertexCount: 4,
        forestCanopyBaseline2020Pct: 14.0,
        currentForestCanopyPct: 13.8, // minimal change
      });

      expect(result.isDeforestationFree).toBe(true);
      expect(result.auditConclusion).toBe('compliant_for_eu_export');
      expect(result.eudrDueDiligenceReference).toContain('EUDR-DDS-KEN-');
    });

    it('generates verifiable GS1 Digital Link farm-to-fork batch passports', () => {
      const passport = generateFarmToForkPassport({
        batchId: 'LOT-COF-2026-881',
        commodityName: 'Arabica Specialty Coffee (SL-28)',
        tonnage: 18.5,
        originCooperative: 'Rift Valley Mountain Coffee Union',
        originCountry: 'Kenya',
        farmCoordinates: [-0.182, 35.942],
        harvestDate: '2026-08-20',
      });

      expect(passport.gs1DigitalLinkUrl).toContain('https://id.agriextension.org/01/');
      expect(passport.digitalSignatureHash).toHaveLength(64);
      expect(passport.chemicalResidueMrlStatus).toBe('passed_zero_banned_pesticides');
    });
  });

  describe('Shared Mechanization & Agricultural Drone Fleet Dispatcher', () => {
    it('searches for available tractor and drone mechanization assets', () => {
      const equipment = findAvailableEquipment({ county: 'Nakuru' });
      expect(equipment.length).toBeGreaterThan(0);
      expect(equipment.some(e => e.assetType === 'spraying_drone_t30')).toBe(true);
    });

    it('plans ULV drone spraying missions across smallholder cluster blocks', () => {
      const mission = planDroneSprayMission({
        targetCrop: 'Maize',
        pestTarget: 'Fall Armyworm Outbreak',
        totalHectares: 40,
        farmerIds: ['farmer-1', 'farmer-2', 'farmer-3'],
      });

      expect(mission.totalSortiesRequired).toBeGreaterThan(0);
      expect(mission.batterySwapsRequired).toBeGreaterThan(0);
      expect(mission.costEstimateKes).toBeGreaterThan(50000);
      expect(mission.safetyBufferWindSpeedMaxKmh).toBe(18.0);
    });
  });

  describe('Crowd-Sourced Pest Swarm Radar & DBSCAN Trajectory Modeling', () => {
    it('clusters spatial sightings into active epidemic swarms', () => {
      const sightings: PestSightingReport[] = [
        {
          id: 's1',
          pestType: 'desert_locust',
          lat: 0.5,
          lng: 36.0,
          county: 'Baringo',
          severity: 'dense_plague',
          reportedAt: '2026-09-01T00:00:00Z',
          reporterRole: 'extension_officer',
        },
        {
          id: 's2',
          pestType: 'desert_locust',
          lat: 0.52,
          lng: 36.05,
          county: 'Baringo',
          severity: 'moderate_swarm',
          reportedAt: '2026-09-01T00:05:00Z',
          reporterRole: 'farmer',
        },
      ];

      const clusters = clusterPestSightings(sightings, 30.0);
      expect(clusters.length).toBe(1);
      expect(clusters[0].severityLevel).toBe('critical');
      expect(clusters[0].sightingCount).toBe(2);
    });

    it('forecasts 24h and 48h downwind swarm trajectory based on wind vector', () => {
      const cluster = {
        clusterId: 'c1',
        pestType: 'desert_locust',
        centroid: [0.5, 36.0] as [number, number],
        sightingCount: 5,
        radiusKm: 25,
        severityLevel: 'critical' as const,
      };

      const forecast = forecastSwarmTrajectory({
        cluster,
        windSpeedKmh: 20,
        windDirectionDegrees: 180, // Blowing South
      });

      expect(forecast.forecast24hCentroid[0]).toBeLessThan(0.5); // Moved South
      expect(forecast.forecast48hCentroid[0]).toBeLessThan(forecast.forecast24hCentroid[0]);
      expect(forecast.predictedImpactCounties.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Border Commodity Trade & Arbitrage Engine', () => {
    it('identifies profitable cross-border arbitrage opportunities (e.g. Uganda to Kenya Maize)', () => {
      const opportunities = findCrossBorderArbitrage({ commodity: 'Maize', minNetMarginPct: 5.0 });
      expect(opportunities.length).toBeGreaterThan(0);

      const top = opportunities[0];
      expect(top.originCountry).toBe('Uganda');
      expect(top.destinationCountry).toBe('Kenya');
      expect(top.netArbitrageProfitUsdPerTon).toBeGreaterThan(20.0);
      expect(top.recommendedTrade).toBe(true);
    });
  });
});
