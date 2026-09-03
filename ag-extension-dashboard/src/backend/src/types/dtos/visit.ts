import type {
  VisitStatsRow,
  VisitWithFarmerRow,
  VisitInsertRow,
  VisitIdRow,
} from '../rowTypes';
import { parseCount, parseDecimal, toIso } from './common';

// --- Reporting DTOs --------------------------------------------------------

export interface VisitStatsDTO {
  total: number;
  completed: number;
  totalMinutes: number | null;
}
export function mapVisitStatsRow(row: VisitStatsRow): VisitStatsDTO {
  return {
    total: parseCount(row.total),
    completed: parseCount(row.completed),
    totalMinutes: row.total_minutes == null ? null : parseInt(row.total_minutes, 10),
  };
}

// --- Visits DTOs ------------------------------------------------------------

export interface VisitWithFarmerDTO {
  id: string;
  officerId: string | null;
  farmerId: string | null;
  visitType: string | null;
  status: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  locationLat: number | null;
  locationLng: number | null;
  notes: string | null;
  outcomes: string | null;
  followUpRequired: boolean | null;
  followUpDate: string | null;
  reminderSent: boolean | null;
  overdueAlertSent: boolean | null;
  followUpReminderSent: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  farmerName: string | null;
}
export function mapVisitWithFarmerRow(row: VisitWithFarmerRow): VisitWithFarmerDTO {
  return {
    id: row.id,
    officerId: row.officer_id,
    farmerId: row.farmer_id,
    visitType: row.visit_type,
    status: row.status,
    scheduledAt: toIso(row.scheduled_at) ?? null,
    startedAt: toIso(row.started_at) ?? null,
    completedAt: toIso(row.completed_at) ?? null,
    durationMinutes: row.duration_minutes,
    locationLat: parseDecimal(row.location_lat),
    locationLng: parseDecimal(row.location_lng),
    notes: row.notes,
    outcomes: row.outcomes,
    followUpRequired: row.follow_up_required,
    followUpDate: toIso(row.follow_up_date) ?? null,
    reminderSent: row.reminder_sent,
    overdueAlertSent: row.overdue_alert_sent,
    followUpReminderSent: row.follow_up_reminder_sent,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
    farmerName: row.farmer_name,
  };
}
export function mapVisitWithFarmerRows(rows: VisitWithFarmerRow[]): VisitWithFarmerDTO[] {
  return rows.map(mapVisitWithFarmerRow);
}

export interface VisitInsertDTO {
  id: string;
  officerId: string | null;
  farmerId: string | null;
  visitType: string | null;
  status: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  locationLat: number | null;
  locationLng: number | null;
  notes: string | null;
  outcomes: string | null;
  followUpRequired: boolean | null;
  followUpDate: string | null;
  reminderSent: boolean | null;
  overdueAlertSent: boolean | null;
  followUpReminderSent: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}
export function mapVisitInsertRow(row: VisitInsertRow): VisitInsertDTO {
  return {
    id: row.id,
    officerId: row.officer_id,
    farmerId: row.farmer_id,
    visitType: row.visit_type,
    status: row.status,
    scheduledAt: toIso(row.scheduled_at) ?? null,
    startedAt: toIso(row.started_at) ?? null,
    completedAt: toIso(row.completed_at) ?? null,
    durationMinutes: row.duration_minutes,
    locationLat: parseDecimal(row.location_lat),
    locationLng: parseDecimal(row.location_lng),
    notes: row.notes,
    outcomes: row.outcomes,
    followUpRequired: row.follow_up_required,
    followUpDate: toIso(row.follow_up_date) ?? null,
    reminderSent: row.reminder_sent,
    overdueAlertSent: row.overdue_alert_sent,
    followUpReminderSent: row.follow_up_reminder_sent,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
  };
}

export interface VisitIdDTO {
  id: string;
}
export function mapVisitIdRow(row: VisitIdRow): VisitIdDTO {
  return { id: row.id };
}
