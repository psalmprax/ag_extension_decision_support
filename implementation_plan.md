# Implementation Plan: 8 New Features (Route Optimizer → Soil Labs)

Approved scope: implement all 8 features from the second gap analysis. Sequenced by value/effort. Business-gated items (insurance partner, gov registration) get the full code layer + documented gates.

## Backend (migration batch 2)

- New tables: `crop_cycle_milestones`, `soil_lab_results`; new columns on `crop_cycles` (`plan_json`, `plan_generated_at`)
- No tables needed: route optimization (computed), gamification (aggregated), MIS export (derived), insurance index (computed), SMS triage (reuses onboarding sessions)

## Features

1. **Route Optimizer** — `routeOptimizationService` (pure nearest-neighbor + 2-opt over follow-up queue with priority weights: daysOverdue, vitalScore); `GET /efficacy/route-plan`; VisitsPage route panel
2. **Farm Plans** — `farmPlanService`: rule-based milestone templates per crop from planting date; `POST /fields/cycles/:id/generate-plan`, `GET/PATCH milestones`; CropsFields milestone UI
3. **In-Field Calculators** — pure `lib/agCalculators.ts` (tank mix, fertilizer blend NPK, planting density, herbicide dose) + FieldCalculators panel; fully offline
4. **MIS Interop** — `misExportService`: standardized CSV/JSON exports (farmers, visits, outcomes) with documented column contract; `GET /mis/export/:dataset` (admin/regional)
5. **Officer Gamification** — `officerGamificationService`: 30d leaderboard (visits, outcomes recorded, efficacy success rate) + badges; `GET /gamification/leaderboard`; dashboard LeaderboardCard
6. **SMS/USSD Symptom Triage** — `symptomTriageService` (pure keyword matcher, 8 crop/pest playbooks) wired into onboardingEngine 'diagnose' flow; tests on matcher
7. **Weather-Index Insurance API** — `weatherIndexService`: seasonal rainfall index vs historical mean per district from NASA POWER; `GET /insurance/weather-index` (partner integration = business gate, documented)
8. **Soil Lab Import** — `soilLabService`: pure CSV parser + `POST /soil-lab/import` + `GET /soil-lab/farmer/:id`; SoilDiagnosticsTab import button

## Verification

Backend tsc + jest (new suites per service), frontend tsc + vitest + locale audit; atomic commits on stage; push.
