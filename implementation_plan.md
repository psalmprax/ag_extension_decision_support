# Implementation Plan: 3-Tier Feature Roadmap (Top-Notch Feature Set)

Scope: all 9 identified features. Sequenced so each phase ships independently complete artifacts. Phase 1 is pure-code and build-ready; Phase 2 has one decision gate each; Phase 3 produces stakeholder specs (code cannot conjure partnerships/methodologies).

---

## PHASE 1 — Pure-code features (build on approval)

### 1.1 Advice Efficacy Loop (#2)
**Goal:** measure whether advice worked; aggregate success rates; create follow-up queue.

- **Schema** (Prisma migration):
  - `RecommendationOutcome`: id, visitId (FK), farmerId, crop, disease/adviceCategory, adviceSummary, outcome enum(`resolved`|`improved`|`unresolved`|`worsened`|`lost_to_followup`), followUpPhotoId?, officerNotes?, measuredAt, createdAt
  - `FollowUpDue`: derived — visit follow-up date = visit date + 14d when advice was given; surfaced via query, no extra table
- **Backend**: `adviceEfficacyService` (record, aggregate by crop/category/officer/region, follow-up queue query); routes `POST /api/v1/visits/:id/outcome`, `GET /api/v1/efficacy/summary`, `GET /api/v1/efficacy/followups` (RBAC: officer+)
- **Frontend**: outcome picker in VisitModal follow-up flow (reuse existing modal, new step); efficacy card on DashboardPage (success rate by crop, trend); follow-up queue badge in VisitsPage
- **Tests**: service aggregation fixtures; route RBAC + validation; outcome enum constraints

### 1.2 Proactive Seasonal Advisory Engine (#3)
**Goal:** push, not pull — weather/NDVI data you already ingest becomes dispatched advisories.

- **Schema**: `AdvisoryDispatch` (id, ruleKey, region/district, channel, audienceCount, payloadJson, dispatchedAt, dedupeHash unique) — dedupe prevents spam; `AdvisoryPreference` (farmerId unique, channels bitmask, optIn bool, categories[])
- **Rules engine**: `seasonalAdvisoryService` with seeded rules:
  - `planting_window`: rainfall forecast + soil temp thresholds → "plant in N days"
  - `faw_degree_day`: fall armyworm degree-day accumulation → scouting alert
  - `late_blight_risk`: BLITECAST-style humidity/temp model → potato alert
  - `dry_spell_warning`: N-day no-rain forecast → irrigation notice
- **Dispatch**: BullMQ repeatable job (daily 06:00 Africa/Blantyre) → evaluate per district → dedupe → send via existing whatsappService/smsService/web-push; officer digest email
- **Config**: `ADVISORY_ENGINE_ENABLED`, `ADVISORY_CRON expression` env-gated
- **Frontend**: farmer preference capture in Channels page; "Recent advisories" list per district on DashboardPage
- **Tests**: rule evaluation against fixture weather series; dedupe logic; opt-out honored

### 1.3 Outbreak Intelligence (#4)
**Goal:** first-party epidemiology from diagnoses already flowing through the pipeline.

- **Backend**: `outbreakService` — aggregate anonymized diagnosis events by (district, crop, disease) over trailing 14d; k-anonymity threshold (≥3 distinct farmers) before surfacing; alert officers in affected + adjacent districts (district adjacency table seeded for Malawi districts); heatmap endpoint `GET /api/v1/outbreaks?bbox=&days=`
- **Trigger**: runs inside the diagnosis persist path (incremental counters) + daily rollup job
- **Frontend**: outbreak layer toggle on FarmerMap (district choropleth circles); outbreak banner on DashboardPage when officer's district is affected
- **Privacy**: aggregates only; no farmer identity beyond district; threshold enforced in SQL
- **Tests**: threshold enforcement, adjacency alerting, bbox query

### 1.4 Offline Map Tiles (#7)
**Goal:** maps render with zero connectivity.

- **Frontend**: tile-cache layer — Cache Storage-backed custom `L.TileLayer.Offline` (no new heavy dep); "Download district maps" action pre-fetches z8–z14 tiles for assigned-district bboxes (existing district bbox data); cache-size meter + evict control in SettingsPanel
- **Tests**: bbox→tile-list math (pure function, unit tested); cache hit/fallback logic

**Phase 1 verification**: backend tsc+jest green; frontend tsc+vitest+locale audit; new Playwright overflow spec extended to dashboard routes; manual visual at 390px via browse.

---

## PHASE 2 — One decision gate each (spike first, build after sign-off)

### 2.1 On-Device Offline Diagnosis (#1)
- **Spike (research, no build)**: model selection — EfficientNet-Lite0 / MobileNetV3 trained on PlantVillage (CC-BY-SA dataset) restricted to top ~10 regional crops/diseases; quantized INT8 target ≤12MB; runtime: `onnxruntime-web` (works in Capacitor webview, no native plugin risk) vs tflite plugin
- **Decision gate**: accuracy ≥85% on held-out subset + acceptable model size → then build: capture flow fallback ("On-device (offline) result — sync for AI confirmation"), confidence display, telemetry event
- **Risk**: model quality on field photos (lab-leaf dataset bias) — mitigate by pairing with existing multimodal confirmation when online

### 2.2 WhatsApp Voice-Note Advisories (#6)
- **Spike**: STT comparison for Chichewa/sw/fr: OpenAI Whisper API vs Google STT vs self-hosted whisper-small — accuracy on 20-sample field set, cost/min, latency
- **Decision gate**: provider + budget → build: WhatsApp voice note ingest (existing webhook) → STT → existing chatbot pipeline → TTS reply (same provider if quality passes)

---

## PHASE 3 — Stakeholder specs (docs, not code)

- **3.1 Farmer Self-Service PWA (#5)**: spec — auth (phone OTP), diagnose-self flow reusing on-device model, visit history read-only, market prices, advisory inbox; reuses officer RBAC role `farmer`
- **3.2 Market Linkage + Credit (#8)**: spec — supplier catalog, listings, voucher redemption (voucherService exists), credit score model from visit/outcome history (efficacy loop feeds this — Phase 1.1 is a prerequisite)
- **3.3 Carbon/Regenerative Tracking (#9)**: spec — practice logging taxonomy, NDVI-based verification signals (satelliteService exists), registry methodology options (Verra VM0042 vs national programs) — business decision

---

## Execution order (on approval)

1. 1.1 → 1.2 → 1.3 → 1.4 sequentially (shared migration batches; each committed atomically on `stage`)
2. Phase 2 spikes run in parallel research track; results presented as decision memos
3. Phase 3 specs delivered as `docs/specs/*.md`

## Risks

- Migration size (Phase 1 adds ~5 tables) — batched, reversible, no destructive changes
- Advisory spam risk — dedupe hash + per-farmer opt-in + category caps
- Outbreak privacy — k≥3 aggregation enforced in SQL, no identity columns
- Scope honesty: Phases 2–3 cannot complete without the stated decisions/business inputs
