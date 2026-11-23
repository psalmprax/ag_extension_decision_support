/**
 * Shared API contract — records kept for one field (`/api/v1/fields/:fieldId/...`):
 * soil test results over the years, and daily solar radiation and rainfall from NASA POWER.
 */
import { z } from 'zod';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const measurement = (max: number) => z.number().min(0).max(max).nullable().optional();

/** The values a soil test can report; a result needs at least one of them. */
export const SOIL_TEST_MEASUREMENTS = ['ph', 'organicCarbonPct', 'organicMatterPct', 'nitrogenPpm', 'phosphorusPpm', 'potassiumPpm'] as const;
export type SoilTestMeasurement = (typeof SOIL_TEST_MEASUREMENTS)[number];

/** POST /api/v1/fields/:fieldId/soil-tests — one lab result as the lab reported it. */
export const soilTestInputSchema = z
  .object({
    /** The day the sample was taken or tested (YYYY-MM-DD). */
    testedAt: z.string().regex(DAY, 'Use a date like 2026-03-14'),
    labName: z.string().trim().max(150).nullable().optional(),
    sampleRef: z.string().trim().max(100).nullable().optional(),
    ph: z.number().min(0).max(14).nullable().optional(),
    organicCarbonPct: measurement(60),
    organicMatterPct: measurement(100),
    nitrogenPpm: measurement(100_000),
    phosphorusPpm: measurement(100_000),
    potassiumPpm: measurement(100_000),
  })
  .refine(input => SOIL_TEST_MEASUREMENTS.some(key => typeof input[key] === 'number'), {
    message: 'Enter at least one measurement',
    path: ['ph'],
  })
  .refine(input => {
    const day = Date.parse(`${input.testedAt}T00:00:00Z`);
    return Number.isFinite(day) && day >= Date.UTC(1950, 0, 1) && day <= Date.now() + 86_400_000;
  }, { message: 'The test date cannot be in the future', path: ['testedAt'] });

export const soilTestSchema = z.object({
  id: z.string(),
  fieldId: z.string().nullable(),
  testedAt: z.string().nullable(),
  labName: z.string().nullable(),
  sampleRef: z.string().nullable(),
  ph: z.number().nullable(),
  organicCarbonPct: z.number().nullable(),
  organicMatterPct: z.number().nullable(),
  nitrogenPpm: z.number().nullable(),
  phosphorusPpm: z.number().nullable(),
  potassiumPpm: z.number().nullable(),
});

/** One day at the field's location. Null where NASA POWER has no value for that day yet. */
export const fieldWeatherDaySchema = z.object({
  date: z.string(),
  solarMjM2: z.number().nullable(),
  rainMm: z.number().nullable(),
});

/** GET /api/v1/fields/:fieldId/weather */
export const fieldWeatherSchema = z.object({
  source: z.literal('NASA POWER'),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  from: z.string(),
  to: z.string(),
  /** The most recent day with values; NASA POWER usually runs a few days behind today. */
  latestDate: z.string().nullable(),
  units: z.object({ solar: z.literal('MJ/m²/day'), rain: z.literal('mm/day') }),
  days: z.array(fieldWeatherDaySchema),
});

export type SoilTestInput = z.infer<typeof soilTestInputSchema>;
export type SoilTest = z.infer<typeof soilTestSchema>;
export type FieldWeatherDay = z.infer<typeof fieldWeatherDaySchema>;
export type FieldWeather = z.infer<typeof fieldWeatherSchema>;
