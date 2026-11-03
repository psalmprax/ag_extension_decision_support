# What We Do Differently

**A novelty statement for the Agricultural Extension Decision Support platform**

This document states, in plain terms, what is genuinely distinctive about the platform, why each difference matters to a farmer, officer, cooperative or funder, and where the evidence for the claim lives in this repository. It ends with the claims we deliberately do **not** make, because credibility with ministries and buyers depends on naming limits precisely.

---

# The gap we are built for

Public extension systems run at roughly one field officer to several thousand smallholders. The consequences are well documented and structural, not a failure of effort:

- Preventable pest and disease losses occur because diagnosis arrives days after the window for cheap intervention has closed.
- Farmers sell at distressed prices because grade, origin and compliance cannot be evidenced at the point of sale.
- Funders and ministries cannot prove that a visit, an advisory or a yield gain actually happened, so capital is allocated against paper logs instead of measured outcomes.

Most agricultural software addresses one slice of this: a chat interface, an SMS blast, a satellite dashboard, or a traceability registry. Each assumes the others exist. The platform's thesis is different:

> Extension is not a messaging problem. It is a distributed telemetry, verification and decision-support problem, and it has to work where the network does not.

That thesis produces seven concrete differences.

---

# 1. Data honesty is enforced by the architecture, not by policy

**What it is.** Every analytical response in the platform carries a provenance block describing how the value was produced and what it rests on: measured, computed from supplied inputs, deterministic estimation, demo reference data, or unavailable. The vocabulary is enforced in code, and callers cannot get a value without the accompanying status.

**Why it matters.** The failure mode of agricultural AI is not a crash; it is a confident number with no basis. A yield estimate invented to fill a chart, or a county list invented to fill a map, is worse than a blank field because a loan officer or a procurement manager will act on it. Provenance makes "we do not know" a first-class, reportable result.

**What most alternatives do.** Consumer agri-chatbots optimise for a complete-looking answer. Satellite dashboards present an index without stating whether it is measured or modelled. The platform states both, and its recommendation, traceability and satellite modules all emit the same status contract.

**Evidence in this repository:** `ag-extension-dashboard/src/backend/src/services/provenance.ts` (the `pillarProvenance` status vocabulary) and its use across the pillar services, for example `traceabilityPassportService.ts`, `pestSwarmRadarService.ts` and `mechanizationFleetService.ts`. The audit report `backend_audit_report.md` tracks the work of removing every place that previously presented a placeholder as live data.

---

# 2. A regulatory gate, with reconstructable provenance

**What it is.** Before an advisory recommends a pesticide, the platform evaluates it against versioned regulatory rules for the jurisdiction, product, formulation, crop, pest, application method and timing. It checks registration validity, maximum legal rate, pre-harvest interval, pollinator and flowering restrictions, and revoked substances. A decision that cannot be authorised is a hard rejection with a reason code, not a softer suggestion.

Each decision carries a hash of the inputs, a hash of the rule version applied, and a signature envelope. An auditor can take a historical recommendation and reconstruct exactly which rule and dataset version produced it, and detect whether the record has been altered since.

**Why it matters.** Advice that breaches a pre-harvest interval is a food-safety and export problem, not an agronomic preference. Exporters and regulators increasingly ask not just "was the advice correct" but "prove what you knew and when". Rule-level provenance answers that question.

**What most alternatives do.** Advisory tools typically encode recommendations as text or a knowledge article with no versioned rule, no legality evaluation at decision time, and no way to reconstruct the basis of a past recommendation.

**Evidence:** `ag-extension-dashboard/src/backend/src/services/regulatoryProvenanceService.ts` (rule hashing, temporal validation, hard rejections, `auditReconstruct`), with the integration test suite in `src/__tests__/regulatoryProvenance.test.ts`. Signing uses `REGULATORY_SIGNING_SECRET`; when the secret is absent the envelope is explicitly marked as an unkeyed digest rather than being presented as a signature.

---

# 3. The field edge works with no connection at all

**What it is.** The client is built as an offline-first application, not an online application with a cache. Field registrations, visit records, diagnosis captures and drafted advisories are written to a durable local queue with unique identifiers, and synchronised when connectivity returns. Retries are idempotent, so a timeout does not become a duplicate record. A two-stage on-device detector classifies leaf damage and soil imagery without sending the image anywhere, and cached map tiles keep the spatial view usable.

**Why it matters.** The agricultural frontier is precisely where coverage is worst. A tool that requires four bars is a tool for the district capital. Offline capture also protects privacy: a farmer's photograph need not leave the handset to produce a preliminary read.

**What most alternatives do.** Mobile agri-apps generally require connectivity for diagnosis and treat offline as an error state. Where an offline mode exists, it usually caches read-only content rather than accepting writes with conflict-aware replay.

**Evidence:** `ag-extension-dashboard/src/frontend/src/api/syncQueueService.ts`, `src/services/offlineDiagnosisQueue.ts`, `src/lib/offlineTiles.ts`, `src/components/EdgeVisionScannerModal.tsx`, with tests `syncQueueService.test.ts` and `offlineDiagnosisQueue.test.ts`.

---

# 4. Model-independent AI: a cascade, not a single vendor

**What it is.** Agronomic reasoning is routed across eleven provider adapters through a cascade that scores availability and falls through on failure, with cooldowns for providers that are erroring or rate-limited. If every provider is unavailable, the platform returns a labelled fallback rather than an exception or an invented answer.

**Why it matters.** A single-provider dependency turns a quota error into a failed field visit. Model independence also lets the same platform serve a ministry that mandates a domestic model and a cooperative that wants the lowest-cost option, without forking the product.

**What most alternatives do.** Agri-chat features are commonly thin wrappers over one vendor's API. Failover, when present, is a retry rather than a routing decision.

**Evidence:** `src/services/aiProvider/cascade.ts`, `src/services/aiProvider/providers/` (eleven adapters), `src/app.ts` health reporting for primary, fallback and cascade providers.

---

# 5. Field work that is verified, not self-reported

**What it is.** A visit is not a row someone typed. It has a check-in with position and time, a dwell-time requirement, and fraud checks for implausible movement and stationary "visits". A visit that fails verification is flagged rather than quietly accepted. One-time codes used in verification are generated with a cryptographic source and stored as hashes, with attempt counters bound to the code's lifetime.

**Why it matters.** "Ghost visits" are the single most corrosive problem in funded extension programmes. If a visit cannot be distinguished from a fabricated one, every downstream metric, from coverage to yield attribution, inherits the doubt. Verification converts activity reporting into evidence.

**What most alternatives do.** Digital extension tools generally record what the officer submits. GPS stamping is common; dwell-time and movement plausibility checks, with explicit rejection, are not.

**Evidence:** `src/routes/visits.ts` (stationary fraud and dwell-time enforcement), `src/services/verificationFraudService.ts` (cryptographic OTP generation, hashed storage, attempt limits), and `src/__tests__/` coverage for the verification paths.

---

# 6. Closing the economic loop: from field record to trade document

**What it is.** The platform connects the agronomic record to the transaction: batch passports with a GS1 Digital Link identifier, a deforestation assessment that refuses to conclude without supplied canopy baselines, a signed passport payload when a signing secret is configured, and revenue analytics that separate new, expansion, contraction and churned revenue from recorded subscription events. Cancellation reasons are captured at the moment of cancellation and reported with a coverage figure showing how much churn they explain.

**Why it matters.** Compliance regimes such as the EUDR turn an agronomic record into a market-access document. A passport that says "unavailable" for an unverified baseline is commercially useful because it tells a buyer what still needs measuring; a passport that invents a compliant answer is a liability at the port. The same discipline applies internally: expansion revenue computed from recorded events, with the date tracking began disclosed, is defensible in an investor update.

**What most alternatives do.** Traceability suites and agronomy tools usually sit in separate systems, joined by manual export. Where they are joined, the compliance conclusion is often asserted rather than derived from supplied measurements.

**Evidence:** `src/services/traceabilityPassportService.ts`, `src/services/regulatoryProvenanceService.ts`, `prisma/schema.prisma` (`SubscriptionChangeEvent`, `CancellationFeedback`), `src/services/paymentAnalyticsService.ts`, and the migration set under `prisma/migrations/`.

---

# 7. Inclusion is a channel strategy, not a localisation checkbox

**What it is.** The same advisory can leave the platform over SMS, WhatsApp, Telegram, in-app messaging, voice broadcast and transcribed voice notes, with per-plan metering so cost is visible per capability. The interface ships in more than fifteen languages, including right-to-left Arabic, and the AI answers in the user's selected language. A browser extension carries the advisory workflow to the desktop tools officers already use.

**Why it matters.** The farmer who most needs advice may have a feature phone, may not read the colonial-language interface, and may communicate by voice note. Reach is determined by the weakest channel the population actually uses, not the best one the product supports.

**What most alternatives do.** Many platforms localise a handful of languages and offer one delivery channel, usually SMS or an app. Voice and messaging are frequently separate products with separate records.

**Evidence:** `src/services/smsService.ts`, `whatsappService.ts`, `telegramService.ts`, `ivrBroadcastService.ts`, `whisperTranscriptionService.ts`; language catalogue in `src/frontend/src/lib/i18n.ts`; extension in `ag-extension-browser-ext/`.

---

# Where the differences combine

Each difference is useful alone. Together they produce a capability none of the individual categories offers: a claim you can defend end to end.

Consider a cooperative that must prove a pesticide was applied legally and that the resulting lot is deforestation-free:

1. The officer's visit is verified by position and dwell time, so its existence is not in question.
2. The advisory passed a regulatory gate against a versioned rule, so the legality of the dose and interval is reconstructable.
3. The parcel's canopy measurements were supplied and recorded, so the deforestation conclusion is derived rather than asserted.
4. The batch passport is signed with a keyed HMAC, so tampering after issue is detectable.
5. The whole chain carries provenance labels, so any gap is visible to the buyer instead of being hidden by an optimistic default.

A stack of separate tools can produce the same five artefacts only by reconciling five vendors' records after the fact.

---

# What we do not claim

Precision here is part of the product's value.

- **Not every module is live by default.** Vision diagnosis, satellite indices, SMS and voice require provider credentials. When a dependency is unconfigured, the module reports that state; it does not simulate a result.
- **Some datasets in the repository are demonstration reference data.** Where a catalogue or directory is illustrative, records are prefixed and the provenance block says so. Those paths are for evaluation, not for operational decisions.
- **Satellite vegetation figures are not always raw satellite NDVI.** Where the platform falls back to a modelled or proxied value, the response says which it is. Treat the label, not the number, as the primary information.
- **Outbreak trajectories are deterministic wind-drift estimates.** They are not boundary-intersection epidemiology and are labelled as such, with their assumptions.
- **Churn reasons cover reported feedback only.** The churn endpoint returns a coverage figure alongside the reasons so that "most customers left because of price" cannot be implied from a handful of responses.
- **We do not claim regulatory coverage of every jurisdiction.** Rule packs are versioned datasets; a jurisdiction without a pack cannot receive an authorised pesticide recommendation.

---

# Defensibility and the next twelve months

The durable advantages are the ones that compound with use:

| Advantage | Why it compounds |
|---|---|
| Verified field telemetry | Every verified visit improves the evidence base for yield attribution and pricing |
| Versioned regulatory rule packs | Each jurisdiction added raises switching cost for an exporter that depends on the audit trail |
| Provenance-native architecture | New modules inherit the honesty contract instead of needing a retrofit |
| Offline-first client | Field-collected data grows with usage; competitors starting online-first must rebuild the client |
| Economic loop | Passports, compliance and revenue analytics tie the agronomic record to money, which is what buyers and investors actually purchase |

The near-term roadmap follows directly from the gaps this document names: widening the regulatory rule packs beyond the seeded jurisdictions, closing the remaining provenance gaps tracked in `backend_audit_report.md`, moving satellite indices from proxy data to direct observation, and extending verified-visit telemetry to cooperative-level dashboards.

---

# Verification appendix

Every claim above is checkable in the repository at the paths below.

| Claim | File |
|---|---|
| Provenance vocabulary and statuses | `ag-extension-dashboard/src/backend/src/services/provenance.ts` |
| Regulatory evaluation and audit reconstruction | `src/services/regulatoryProvenanceService.ts` |
| Regulatory test coverage | `src/__tests__/regulatoryProvenance.test.ts` |
| Signed traceability passports | `src/services/traceabilityPassportService.ts` |
| Visit verification and dwell-time rules | `src/routes/visits.ts`, `src/services/verificationFraudService.ts` |
| Offline write queue | `src/frontend/src/api/syncQueueService.ts` |
| Offline diagnosis queue and on-device scan | `src/frontend/src/services/offlineDiagnosisQueue.ts`, `src/components/EdgeVisionScannerModal.tsx` |
| AI provider cascade | `src/backend/src/services/aiProvider/cascade.ts` |
| Omni-channel delivery | `src/backend/src/services/smsService.ts`, `whatsappService.ts`, `telegramService.ts`, `ivrBroadcastService.ts` |
| Language coverage | `src/frontend/src/lib/i18n.ts` |
| Subscription change and cancellation records | `prisma/schema.prisma`, `prisma/migrations/` |
| Churn reason reporting with coverage | `src/backend/src/services/paymentAnalyticsService.ts` |
| Platform capability audit and remaining gaps | `backend_audit_report.md` |

Audit note: claims in this document describe the shipped code, not marketing material. Where a claim depends on configuration or a seeded dataset, the dependency is stated in the text.
