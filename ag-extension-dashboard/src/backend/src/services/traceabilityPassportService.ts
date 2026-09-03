/**
 * EUDR compliance checks and GS1 farm-to-fork batch passports — wired via POST /api/pillars/traceability/*.
 *
 * EUDR audits fail closed: without caller-supplied verified canopy measurements the
 * result is `assessment_unavailable`, never a compliance claim. Passports carry a DEMO
 * GTIN and a display-only hash; both are disclosed in the `provenance` block.
 */
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { pillarProvenance } from './provenance';

export interface EudrComplianceCheck {
  parcelId: string;
  country: string;
  commodity: 'coffee' | 'cocoa' | 'tea' | 'soy' | 'avocado';
  centroid: [number, number]; // [lat, lng]
  polygonVertexCount: number;
  forestCanopyBaseline2020Pct: number | null; // Canopy density at Dec 31, 2020
  currentForestCanopyPct: number | null;
  isDeforestationFree: boolean | null; // null = cannot assess without verified evidence
  eudrDueDiligenceReference: string;
  auditConclusion: 'compliant_for_eu_export' | 'non_compliant_deforestation_detected' | 'assessment_unavailable';
  provenance: ReturnType<typeof pillarProvenance>;
}

export interface CommodityBatchPassport {
  batchId: string;
  gtin: string; // Global Trade Item Number (14 digits)
  gs1DigitalLinkUrl: string;
  commodityName: string;
  grade: string;
  tonnage: number;
  originCooperative: string;
  originCountry: string;
  farmCoordinates: [number, number];
  harvestDate: string;
  chemicalResidueMrlStatus: 'passed_zero_banned_pesticides' | 'pending_lab' | 'failed';
  fairTradeCertified: boolean;
  carbonFootprintKgCo2ePerKg: number;
  digitalSignatureHash: string;
  provenance: ReturnType<typeof pillarProvenance>;
}

const EUDR_CUTOFF_DATE = '2020-12-31T23:59:59Z';

export function verifyEudrDeforestationCompliance(params: {
  parcelId: string;
  country: string;
  commodity: 'coffee' | 'cocoa' | 'tea' | 'soy' | 'avocado';
  centroid: [number, number];
  polygonVertexCount: number;
  forestCanopyBaseline2020Pct?: number;
  currentForestCanopyPct?: number;
}): EudrComplianceCheck {
  const {
    parcelId,
    country,
    commodity,
    centroid,
    polygonVertexCount,
    forestCanopyBaseline2020Pct,
    currentForestCanopyPct,
  } = params;

  logger.info(`Running EUDR Deforestation audit for parcel ${parcelId} (${commodity} in ${country}) against cutoff ${EUDR_CUTOFF_DATE}`);

  const ddsReference = `EUDR-DDS-${country.toUpperCase().slice(0, 3)}-${Date.now()}-${parcelId.slice(0, 6)}`;

  // Fail closed: without BOTH verified canopy measurements from the caller there is
  // no evidence basis for a compliance conclusion. Defaults were removed — a missing
  // measurement can never masquerade as a passing audit.
  if (
    typeof forestCanopyBaseline2020Pct !== 'number' ||
    typeof currentForestCanopyPct !== 'number'
  ) {
    logger.warn(`EUDR check for parcel ${parcelId} lacks verified canopy evidence — returning assessment_unavailable`);
    return {
      parcelId,
      country,
      commodity,
      centroid,
      polygonVertexCount,
      forestCanopyBaseline2020Pct: forestCanopyBaseline2020Pct ?? null,
      currentForestCanopyPct: currentForestCanopyPct ?? null,
      isDeforestationFree: null,
      eudrDueDiligenceReference: ddsReference,
      auditConclusion: 'assessment_unavailable',
      provenance: pillarProvenance(
        'unavailable',
        'EUDR conclusion requires caller-supplied 2020-baseline and current forest-canopy measurements from a verified source. No satellite baseline is ingested by this service.',
        ['No default canopy values are assumed'],
        false
      ),
    };
  }

  const canopyLoss = forestCanopyBaseline2020Pct - currentForestCanopyPct;
  const isCompliant = canopyLoss <= 5.0 && polygonVertexCount >= 3;

  return {
    parcelId,
    country,
    commodity,
    centroid,
    polygonVertexCount,
    forestCanopyBaseline2020Pct,
    currentForestCanopyPct,
    isDeforestationFree: isCompliant,
    eudrDueDiligenceReference: ddsReference,
    auditConclusion: isCompliant ? 'compliant_for_eu_export' : 'non_compliant_deforestation_detected',
    provenance: pillarProvenance(
      'computed_from_supplied_inputs',
      'Compliance derived from caller-supplied canopy measurements (loss <= 5pp and >= 3 polygon vertices). Caller is responsible for measurement provenance.',
      ['Canopy-loss tolerance fixed at 5.0 percentage points'],
      false
    ),
  };
}

export function generateFarmToForkPassport(params: {
  batchId: string;
  commodityName: string;
  grade?: string;
  tonnage: number;
  originCooperative: string;
  originCountry: string;
  farmCoordinates: [number, number];
  harvestDate: string;
  fairTradeCertified?: boolean;
}): CommodityBatchPassport {
  const {
    batchId,
    commodityName,
    grade = 'Grade AA',
    tonnage,
    originCooperative,
    originCountry,
    farmCoordinates,
    harvestDate,
    fairTradeCertified = true,
  } = params;

  logger.info(`Generating GS1 Digital Link Passport for batch ${batchId} (${commodityName})`);

  const gtin = '06164000189214'; // DEMO GTIN — replace with tenant-registered value before production use
  const gs1DigitalLinkUrl = `https://id.agriextension.org/01/${gtin}/10/${batchId}`;

  // Display-only integrity hash: unsalted SHA-256 over the payload. Not a cryptographic attestation.
  const payloadToSign = `${batchId}|${commodityName}|${farmCoordinates[0]},${farmCoordinates[1]}|${harvestDate}|${originCooperative}`;
  const digitalSignatureHash = crypto.createHash('sha256').update(payloadToSign).digest('hex');

  return {
    batchId,
    gtin,
    gs1DigitalLinkUrl,
    commodityName,
    grade,
    tonnage,
    originCooperative,
    originCountry,
    farmCoordinates,
    harvestDate,
    chemicalResidueMrlStatus: 'pending_lab' as const,
    fairTradeCertified,
    carbonFootprintKgCo2ePerKg: 0.85, // ESTIMATED — requires lifecycle assessment, not measured
    digitalSignatureHash,
    provenance: pillarProvenance(
      'demo_reference_data',
      'Passport structure is live but the GTIN is a demo placeholder and the signature is an unsalted display hash. Carbon footprint is a fixed estimate pending lifecycle assessment.',
      [
        'GTIN is a DEMO value — tenant-registered GS1 prefix required for production',
        'digitalSignatureHash is display-only, not a cryptographic attestation',
        'carbonFootprintKgCo2ePerKg fixed at 0.85 (illustrative)',
      ],
      true
    ),
  };
}
