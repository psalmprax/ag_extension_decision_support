import type { FarmerDetailRow } from '../rowTypes';
import { parseDecimal, toIso } from './common';

export interface FarmerDetailDTO {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  region: string | null;
  locationLat: number | null;
  locationLng: number | null;
  farmSizeHectares: number | null;
  crops: string[] | null;
  languagePreference: string | null;
  lastVisit: string | null;
}
export function mapFarmerDetailRow(row: FarmerDetailRow): FarmerDetailDTO {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    village: row.village,
    district: row.district,
    region: row.region,
    locationLat: parseDecimal(row.location_lat),
    locationLng: parseDecimal(row.location_lng),
    farmSizeHectares: parseDecimal(row.farm_size_hectares),
    crops: row.crops,
    languagePreference: row.language_preference,
    lastVisit: toIso(row.last_visit) ?? null,
  };
}

export interface PortfolioExportFarmerDTO {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  region: string | null;
  farmSizeHectares: number | null;
  crops: string[] | null;
  totalVisits: number;
  lastVisitDate: string | null;
}

export interface PortfolioExportVisitDTO {
  id: string;
  officerId: string | null;
  farmerId: string | null;
  visitType: string | null;
  status: string | null;
  scheduledAt: string | null;
  notes: string | null;
  firstName: string;
  lastName: string;
  village: string | null;
  type?: string;
}
