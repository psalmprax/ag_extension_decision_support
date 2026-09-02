import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface EudrComplianceCheck {
  parcelId: string;
  country: string;
  commodity: 'coffee' | 'cocoa' | 'tea' | 'soy' | 'avocado';
  centroid: [number, number]; // [lat, lng]
  polygonVertexCount: number;
  forestCanopyBaseline2020Pct: number; // Canopy density at Dec 31, 2020
  currentForestCanopyPct: number;
  isDeforestationFree: boolean;
  eudrDueDiligenceReference: string;
  auditConclusion: 'compliant_for_eu_export' | 'non_compliant_deforestation_detected';
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
    forestCanopyBaseline2020Pct = 12.0, // Historical baseline
    currentForestCanopyPct = 12.0, // Current canopy
  } = params;

  logger.info(`Running EUDR Deforestation audit for parcel ${parcelId} (${commodity} in ${country}) against cutoff ${EUDR_CUTOFF_DATE}`);

  // NOTE: This is a heuristic estimator, not a regulatory certification.
  // No satellite baseline is ingested; callers must supply both canopy values from a verified source.
  if (forestCanopyBaseline2020Pct === 12.0 && currentForestCanopyPct === 12.0) {
    logger.warn('EUDR check using default canopy values — caller did not supply verified baseline; result is ESTIMATED');
  }
  const canopyLoss = forestCanopyBaseline2020Pct - currentForestCanopyPct;
  const isCompliant = canopyLoss <= 5.0 && polygonVertexCount >= 3;

  const ddsReference = `EUDR-DDS-${country.toUpperCase().slice(0, 3)}-${Date.now()}-${parcelId.slice(0, 6)}`;

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

  // DEMO signature: unsalted SHA-256 for display only; not a cryptographic attestation
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
  };
}
