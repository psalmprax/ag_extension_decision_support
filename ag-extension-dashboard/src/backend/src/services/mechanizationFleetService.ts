/**
 * Mechanization fleet registry and drone-mission planner — wired via
 * POST /api/pillars/mechanization/*.
 *
 * Equipment records live in the `mechanization_assets` table and are registered
 * explicitly by owners or tenant administrators. Availability is an
 * operator-maintained flag, not live telematics, and each response says so via
 * its `provenance` block. Mission planning is deterministic math over caller
 * inputs.
 */
import { logger } from '../utils/logger';
import { query } from './databaseService';
import { pillarProvenance } from './provenance';

export const MECHANIZATION_ASSET_TYPES = [
  'tractor_75hp',
  'solar_water_pump',
  'combine_harvester',
  'spraying_drone_t30',
] as const;

export type MechanizationAssetType = typeof MECHANIZATION_ASSET_TYPES[number];

export const MECHANIZATION_RATE_UNITS = ['per_acre', 'per_day', 'per_hour'] as const;

export type MechanizationRateUnit = typeof MECHANIZATION_RATE_UNITS[number];

export interface MechanizationAsset {
  id: string;
  assetType: MechanizationAssetType;
  modelName: string;
  ownerName: string;
  ownerPhone: string;
  county: string;
  subCounty: string;
  ratePerUnitKes: number;
  rateUnit: MechanizationRateUnit;
  isAvailable: boolean;
  isVerified: boolean;
}

export interface RegisterEquipmentInput {
  assetType: MechanizationAssetType;
  modelName: string;
  ownerName: string;
  ownerPhone: string;
  county: string;
  subCounty: string;
  ratePerUnitKes: number;
  rateUnit: MechanizationRateUnit;
  isAvailable?: boolean;
  isVerified?: boolean;
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

export interface EquipmentSearchResult {
  equipment: MechanizationAsset[];
  provenance: ReturnType<typeof pillarProvenance>;
}

/** Adds one asset to the registry. Callers must be authorized administrators. */
export async function registerEquipment(tenantId: string, input: RegisterEquipmentInput): Promise<MechanizationAsset> {
  if (!tenantId?.trim()) throw new Error('Tenant is required for equipment registration');
  const { rows } = await query<MechanizationAssetRecord>(`
    INSERT INTO mechanization_assets
      (tenant_id, asset_type, model_name, owner_name, owner_phone, county, sub_county,
       rate_per_unit_kes, rate_unit, is_available, is_verified)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, asset_type AS "assetType", model_name AS "modelName", owner_name AS "ownerName",
      owner_phone AS "ownerPhone", county, sub_county AS "subCounty", rate_per_unit_kes AS "ratePerUnitKes",
      rate_unit AS "rateUnit", is_available AS "isAvailable", is_verified AS "isVerified"
  `, [tenantId, input.assetType, input.modelName.trim(), input.ownerName.trim(), input.ownerPhone.trim(),
    input.county.trim(), input.subCounty.trim(), input.ratePerUnitKes, input.rateUnit,
    input.isAvailable ?? true, input.isVerified ?? false]);
  const record = rows[0];
  if (!record) throw new Error('Equipment registration did not return a record');

  logger.info(`Registered mechanization asset ${record.id} (${record.assetType}) in ${record.county}`);
  return toAsset(record);
}

/**
 * Lists available assets in a county from the registry. Returns an empty list —
 * with provenance saying so — when nothing has been registered for that county;
 * it never substitutes demo records.
 */
export async function findAvailableEquipment(tenantId: string, params: {
  county: string;
  assetType?: MechanizationAssetType;
}): Promise<EquipmentSearchResult> {
  if (!tenantId?.trim()) throw new Error('Tenant is required for equipment search');
  const { county, assetType } = params;
  logger.info(`Searching mechanization registry in ${county} (type=${assetType || 'all'})`);

  const { rows: records } = await query<MechanizationAssetRecord>(`
    SELECT id, asset_type AS "assetType", model_name AS "modelName", owner_name AS "ownerName",
      owner_phone AS "ownerPhone", county, sub_county AS "subCounty", rate_per_unit_kes AS "ratePerUnitKes",
      rate_unit AS "rateUnit", is_available AS "isAvailable", is_verified AS "isVerified"
    FROM mechanization_assets
    WHERE tenant_id = $1 AND lower(county) = lower($2) AND is_available = true
      AND ($3::text IS NULL OR asset_type = $3)
    ORDER BY is_verified DESC, rate_per_unit_kes ASC
  `, [tenantId, county.trim(), assetType ?? null]);

  return {
    equipment: records.map(toAsset),
    provenance: pillarProvenance(
      'tenant_registry',
      records.length > 0
        ? 'Equipment comes from the operator-maintained mechanization_assets registry. Availability and verification are recorded flags, not live telematics.'
        : `No available equipment is registered for ${county}${assetType ? ` (${assetType})` : ''}. The registry holds only records an administrator has added.`,
      [
        'Availability flag is maintained by the registry operator',
        'isVerified is false until an administrator confirms ownership documents',
      ],
      false
    ),
  };
}

type MechanizationAssetRecord = {
  id: string;
  assetType: string;
  modelName: string;
  ownerName: string;
  ownerPhone: string;
  county: string;
  subCounty: string;
  ratePerUnitKes: number;
  rateUnit: string;
  isAvailable: boolean;
  isVerified: boolean;
};

function toAsset(record: MechanizationAssetRecord): MechanizationAsset {
  return {
    id: record.id,
    assetType: record.assetType as MechanizationAssetType,
    modelName: record.modelName,
    ownerName: record.ownerName,
    ownerPhone: record.ownerPhone,
    county: record.county,
    subCounty: record.subCounty,
    ratePerUnitKes: record.ratePerUnitKes,
    rateUnit: record.rateUnit as MechanizationRateUnit,
    isAvailable: record.isAvailable,
    isVerified: record.isVerified,
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
