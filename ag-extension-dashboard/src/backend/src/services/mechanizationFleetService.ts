/**
 * Shared mechanization fleet directory and drone-mission planner — wired via
 * POST /api/pillars/mechanization/*.
 *
 * The equipment directory is in-code demo data clearly labeled '[DEMO]' at the record
 * level; mission planning is deterministic math over caller inputs. Disclosed per
 * response via the `provenance` block.
 */
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

export interface MechanizationAsset {
  id: string;
  assetType: 'tractor_75hp' | 'solar_water_pump' | 'combine_harvester' | 'spraying_drone_t30';
  modelName: string;
  ownerName: string;
  ownerPhone: string;
  county: string;
  subCounty: string;
  ratePerUnitKes: number;
  rateUnit: 'per_acre' | 'per_day' | 'per_hour';
  isAvailable: boolean;
}

export interface DroneSprayMissionPlan {
  missionId: string;
  targetCrop: string;
  pestTarget: string;
  totalHectares: number;
  farmerIds: string[];
  droneModel: string;
  sprayApplicationRateLPerHa: number; // e.g. 12 L/ha (Ultra-Low Volume)
  totalSprayLiquidLiters: number;
  tankCapacityLiters: number; // e.g. 30 L (DJI Agras T30)
  totalSortiesRequired: number; // Flights/Tank refills
  estimatedFlightTimeMinutes: number;
  batterySwapsRequired: number;
  costEstimateKes: number;
  safetyBufferWindSpeedMaxKmh: number;
  provenance: ReturnType<typeof pillarProvenance>;
}

const REGISTERED_EQUIPMENT: MechanizationAsset[] = [
  {
    id: 'asset-trac-01',
    assetType: 'tractor_75hp',
    modelName: '[DEMO] Massey Ferguson 375 (75 HP with Disc Plow)',
    ownerName: '[DEMO] Peter Kiprono',
    ownerPhone: '+254711334455',
    county: 'Nakuru',
    subCounty: 'Njoro',
    ratePerUnitKes: 2800,
    rateUnit: 'per_acre',
    isAvailable: true,
  },
  {
    id: 'asset-drone-02',
    assetType: 'spraying_drone_t30',
    modelName: '[DEMO] DJI Agras T30 (30L Tank, 16 Spouts)',
    ownerName: '[DEMO] Equator Drone Agro Services',
    ownerPhone: '+254722556677',
    county: 'Nakuru',
    subCounty: 'Rongai',
    ratePerUnitKes: 1200,
    rateUnit: 'per_acre',
    isAvailable: true,
  },
];

export interface EquipmentSearchResult {
  equipment: MechanizationAsset[];
  provenance: ReturnType<typeof pillarProvenance>;
}

export function findAvailableEquipment(params: {
  county: string;
  assetType?: MechanizationAsset['assetType'];
}): EquipmentSearchResult {
  const { county, assetType } = params;
  logger.info(`Searching mechanization equipment in ${county} (type=${assetType || 'all'})`);

  const equipment = REGISTERED_EQUIPMENT.filter(
    item =>
      item.county.toLowerCase() === county.toLowerCase() &&
      item.isAvailable &&
      (!assetType || item.assetType === assetType)
  );

  return {
    equipment,
    provenance: pillarProvenance(
      'demo_reference_data',
      'Equipment records come from an in-code demo directory (records are prefixed [DEMO]); availability is static, not live tracking.',
      ['Demo directory holds 2 Nakuru assets (1 tractor, 1 drone)'],
      true
    ),
  };
}

export function planDroneSprayMission(params: {
  targetCrop: string;
  pestTarget: string;
  totalHectares: number;
  farmerIds: string[];
  tankCapacityLiters?: number;
  applicationRateLPerHa?: number;
}): DroneSprayMissionPlan {
  const {
    targetCrop,
    pestTarget,
    totalHectares,
    farmerIds,
    tankCapacityLiters = 30, // 30L standard tank
    applicationRateLPerHa = 15, // 15L/ha ULV
  } = params;

  logger.info(`Planning drone spraying mission for ${totalHectares} ha against ${pestTarget}`);

  const totalSprayLiquid = Math.round(totalHectares * applicationRateLPerHa);
  const sorties = Math.ceil(totalSprayLiquid / tankCapacityLiters);

  // Modern agricultural drones spray approx. 12 hectares per hour (5 mins per hectare)
  const flightMinutes = Math.round(totalHectares * 5.5);
  const batterySwaps = Math.max(sorties, Math.ceil(flightMinutes / 12)); // 12 min runtime per battery

  const totalAcres = totalHectares * 2.471;
  const costEstimateKes = Math.round(totalAcres * 1200);

  return {
    missionId: `drone_mission_${Date.now()}`,
    targetCrop,
    pestTarget,
    totalHectares,
    farmerIds,
    droneModel: 'DJI Agras T30 (30L ULV)',
    sprayApplicationRateLPerHa: applicationRateLPerHa,
    totalSprayLiquidLiters: totalSprayLiquid,
    tankCapacityLiters,
    totalSortiesRequired: sorties,
    estimatedFlightTimeMinutes: flightMinutes,
    batterySwapsRequired: batterySwaps,
    costEstimateKes,
    safetyBufferWindSpeedMaxKmh: 18.0, // Do not spray if wind > 18 km/h to prevent chemical drift
    provenance: pillarProvenance(
      'deterministic_estimation',
      'Mission logistics are deterministic math (sorties, flight time, battery swaps). Cost uses a fixed per-acre rate against a specific drone model — no live fleet availability is checked.',
      [
        'Application rate default 15 L/ha ULV',
        'Flight time modeled at 5.5 min/ha; battery runtime 12 min',
        'Cost fixed at KES 1,200/acre (illustrative)',
      ]
    ),
  };
}
