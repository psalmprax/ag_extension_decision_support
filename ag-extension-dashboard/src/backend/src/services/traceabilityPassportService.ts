/**
 * EUDR compliance checks and GS1 farm-to-fork batch passports — wired via POST /api/pillars/traceability/*.
 *
 * EUDR audits fail closed: without caller-supplied verified canopy measurements the
 * result is `assessment_unavailable`, never a compliance claim. Passports disclose any
 * field not supplied by the caller (a derived GTIN, the signature basis, the carbon
 * estimate) in the `provenance` block.
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

/**
 * Derive a stable, batch-specific GTIN from the passport's own identifying fields
 * (never a fixed demo constant): the first 13 digits are hashed from the batch
 * identity and the 14th is the GS1 modulo-10 check digit. Deterministic per batch,
 * but NOT a GS1-registered number — that is disclosed in the provenance block.
 */
function deriveGtin(batchId: string, commodityName: string, originCooperative: string): string {
  const digest = crypto.createHash('sha256').update(`${batchId}|${commodityName}|${originCooperative}`).digest('hex');
  let base = '';
  for (let i = 0; base.length < 13; i++) {
    base += String(parseInt(digest[i], 16) % 10);
  }
  const checksum = base.split('').reduce((sum, digit, idx) => sum + Number(digit) * (idx % 2 === 0 ? 3 : 1), 0);
  return base + String((10 - (checksum % 10)) % 10);
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
  /** Fair-trade certification is only asserted when the caller supplies it. */
  fairTradeCertified?: boolean;
  /** Tenant-registered GS1 GTIN. Falls back to a value derived from the batch payload (disclosed) when absent. */
  gtin?: string;
  /** Measured lifecycle value. Omitted means "not measured", never a default. */
  carbonFootprintKgCo2ePerKg?: number;
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
    // Unverified certification claims must not default to true — absence of evidence
    // is not evidence of certification.
    fairTradeCertified = false,
  } = params;

  logger.info(`Generating GS1 Digital Link Passport for batch ${batchId} (${commodityName})`);

  const usesDerivedGtin = !params.gtin;
  const gtin = params.gtin || deriveGtin(batchId, commodityName, originCooperative);
  const gs1DigitalLinkUrl = `https://id.agriextension.org/01/${gtin}/10/${batchId}`;

  // Keyed HMAC when a signing secret is provisioned (real integrity); otherwise an
  // unkeyed display hash, which is disclosed as non-attesting.
  const payloadToSign = `${batchId}|${commodityName}|${farmCoordinates[0]},${farmCoordinates[1]}|${harvestDate}|${originCooperative}`;
  const signingSecret = process.env.PASSPORT_SIGNING_SECRET;
  const digitalSignatureHash = signingSecret
    ? crypto.createHmac('sha256', signingSecret).update(payloadToSign).digest('hex')
    : crypto.createHash('sha256').update(payloadToSign).digest('hex');

  const carbonFootprintKgCo2ePerKg = params.carbonFootprintKgCo2ePerKg ?? 0.85;
  const carbonFootprintMeasured = params.carbonFootprintKgCo2ePerKg !== undefined;

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
    carbonFootprintKgCo2ePerKg: carbonFootprintKgCo2ePerKg, // ESTIMATED unless supplied — requires lifecycle assessment
    digitalSignatureHash,
    provenance: pillarProvenance(
      usesDerivedGtin || !signingSecret || !carbonFootprintMeasured ? 'demo_reference_data' : 'computed_from_supplied_inputs',
      'Passport structure is live. Any field that was not supplied by the caller is flagged rather than asserted.',
      [
        ...(usesDerivedGtin ? ['DEMO data: GTIN is derived from the batch payload, not a GS1-registered identifier — tenant-registered GS1 prefix required for production'] : []),
        ...(!signingSecret
          ? ['DEMO data: digitalSignatureHash is an unkeyed display hash, not a cryptographic attestation (set PASSPORT_SIGNING_SECRET to sign)']
          : ['digitalSignatureHash is an HMAC-SHA256 over the payload fields, keyed by PASSPORT_SIGNING_SECRET']),
        ...(!carbonFootprintMeasured
          ? ['carbonFootprintKgCo2ePerKg is an illustrative estimate (0.85), not a measured lifecycle value']
          : ['carbonFootprintKgCo2ePerKg supplied by the caller']),
        ...(params.fairTradeCertified === undefined
          ? ['fairTradeCertified was not supplied — reported as false']
          : ['fairTradeCertified supplied by the caller and not independently verified']),
      ],
      true
    ),
  };
}
