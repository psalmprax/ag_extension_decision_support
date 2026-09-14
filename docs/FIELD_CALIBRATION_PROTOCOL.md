# Field Calibration Protocol — Closing the Measurement Gaps

Companion to `docs/AG_PROJECT_CONCEPT_REVENUE_COCOA_COFFEE.md` Section 14. The code harnesses exist; this protocol fills them with one pilot season of field data. No code in this loop ships thresholds without a backtest attached.

## 1. Satellite ingest credentials (unblocks item 5)

- Owner obtains Sentinel Hub OAuth credentials (`SENTINEL_HUB_CLIENT_ID` / `SENTINEL_HUB_CLIENT_SECRET`) for pilot districts, or nominates an equivalent provider implementing `ImageryProvider.fetchBands` (`satelliteIngestService.ts`).
- Until then the system correctly refuses ingest (`UNCONFIGURED`) and falls back to manual scouting — do not bypass with hand-entered bands except for labeled calibration parcels.

## 2. Edge vision + voice calibration (fills item 6)

- For every officer visit involving a diagnosis or voice note, record prediction vs. officer verdict via `recordVerification` (`fieldVerificationService.ts`): kind, predicted label, verdict, correctness, confidence.
- Weekly review `calibrationSummary()`: overall accuracy, per-kind accuracy, and sub-0.8 accuracy. Ship threshold changes only when the low-confidence slice justifies the current 0.8 gate in `shouldConfirmEdgeDiagnosis`.
- Target before scale: ≥200 verified edge diagnoses and ≥100 verified transcripts per language, with per-condition accuracy reported — not a single aggregate number.

## 3. Dialect eval sets (fills item 13)

- Collect ≥50 field recordings per vernacular (Chichewa first, then others), each with officer-transcribed reference text. Store outside the repo (object storage, consent-scoped); reference counts here.
- A dialect graduates from low-confidence routing (`isVoiceHintSupported` in `voiceAudioService.ts`) only with a measured word-error-rate on its set, reviewed against the Swahili baseline.

## 4. Threshold backtests (fills item 8)

- Export one labeled season per cutoff: credit tier vs. repayment, DBSCAN clusters vs. confirmed swarm damage, VPD triggers vs. measured stress, hazard alerts vs. events.
- Run `sweepThresholds` + `bestThreshold` (`thresholdBacktestService.ts`); attach the precision/recall/F1 table to the change that moves any cutoff.

## 5. Provider eval discipline (fills item 7)

- Log every production attempt via `evaluateProviders` input shape (provider, model, latency, success, officer quality rating).
- Monthly: publish per-provider success/p50/quality; block below floor (20+ attempts, <0.9 success or <0.6 quality). Review `OMNIROUTE_MAX_PAID_ATTEMPTS` spend against the same report.

## 6. Estimate retirement (fills items 9–10)

- Replace one static table per quarter with a live feed or a measured local survey, starting with FX (last-known-good cache already narrows the gap) then FAOSTAT baselines, then cross-border snapshots.
- Demo-sourced endpoints keep `settlementGrade: 'estimate'` until their inputs are live; removing the flag requires a backtest, not an opinion.

## 7. Calibration ownership and rotation discipline

- **Owner:** one named agronomy data steward owns the verification ledger (`fieldVerificationService.ts`), the weekly accuracy review, and threshold-change proposals. No cutoff moves without their sign-off plus an attached backtest table.
- **Credential rotation:** `credentialVault.listOverdueCredentials()` is the rotation backlog. Expired-credential access now pages via `[CRIT]` logs — the on-call engineer rotates through `storeCredential`/`rotateCredential` and confirms the overdue list is empty. Vault contents are in-memory: any restart requires re-provisioning from the secrets manager, which is also the moment to rotate.
- **Redis degradation:** a `[CRIT]` shared-state log means replicas have diverged (revocations, rate limits, one-time codes). On-call restores Redis, then verifies convergence via `degradationStatus()` before declaring the incident closed. See ADR-001 for the one accepted single-implementation risk (TOTP).
