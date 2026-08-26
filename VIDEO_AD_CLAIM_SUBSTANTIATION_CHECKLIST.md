# GPExts Video Ad Claim Substantiation Checklist

Use this checklist before publishing any GPExts video ad, landing page, sales deck, or cutdown. Every material claim must have evidence that matches the exact wording, scope, audience, market, and product version shown in the creative.

## Release Rule

A claim is publishable only when:

- The evidence is written, dated, reproducible, and stored with the campaign record.
- The evidence measures the same proposition stated in the ad.
- The scope is visible in the claim or its qualifying on-screen copy.
- Product, legal/compliance, and commercial owners have approved the final wording.
- The claim remains true for the market, carrier, language, device, and release version shown.

Do not publish a claim solely because it appears in product copy, internal documentation, a demo environment, a model output, or an unverified stakeholder statement.

## Claim Register

Create one row for every numerical, technical, comparative, performance, outcome, standards, or third-party reference used in the script.

| ID | Exact claim in creative | Category | Market/version | Evidence location | Owner | Expiry/review date | Status |
|---|---|---|---|---|---|---|---|
| C-001 |  |  |  |  |  |  | Not started |

**Status values:** `Not started`, `Evidence collected`, `Under review`, `Approved`, `Qualified`, `Rejected`, `Expired`.

## 1. AI Accuracy and Decision-Support Claims

### Claims covered

- Accuracy, precision, recall, F1, sensitivity, specificity, or confidence percentages.
- “Diagnose,” “detect,” “identify,” “predict,” “verified,” or “best” language.
- Response-time claims such as “in 2 seconds.”
- Offline AI claims.
- “Zero-hallucination,” “grounded,” “citation-gated,” or “expert-level” claims.
- Claims about supported crops, diseases, geographies, image conditions, or languages.

### Evidence required

- [ ] A versioned model card identifies the model, release/build, training scope, intended use, limitations, and prohibited use.
- [ ] A locked evaluation report identifies the test-set source, sample count, class distribution, crop/disease labels, geography, image quality, and collection dates.
- [ ] Metrics are defined precisely. “Accuracy” is not used as a substitute for precision, recall, or confidence calibration.
- [ ] The test set is separated from training and tuning data, with leakage controls documented.
- [ ] Results include confidence intervals or an uncertainty method where appropriate.
- [ ] The evaluation reflects the devices, image pipeline, languages, and operating conditions shown in the ad.
- [ ] Offline behavior is tested on supported devices with connectivity disabled before capture, inference, storage, and later sync.
- [ ] Inference time is measured from a defined start event to a defined result event, including device model, image size, app version, and percentile. Do not use an average alone.
- [ ] The model's confidence score is explicitly labeled as model confidence, not diagnostic accuracy, unless calibration and validation support that wording.
- [ ] Human review, escalation, uncertainty, and “not enough information” behavior are demonstrated where relevant.
- [ ] Source-grounding or citation tests show how unsupported answers are blocked, qualified, or escalated.
- [ ] No creative implies that the tool replaces an agronomist, veterinarian, clinician, regulator, or other qualified professional.
- [ ] The product owner confirms that every feature shown is available in the advertised release and market.

### Safer approved language

> “AI-assisted assessment to support officer review.”

> “The model displays a confidence score and visual indicators; field officers remain responsible for the decision.”

> “Core field records remain usable offline and sync when connectivity returns.”

> “Responses can be grounded in configured approved sources, with citations shown where available.”

### Restricted language

Do not use `100% accurate`, `zero hallucinations`, `guaranteed diagnosis`, `expert-level`, or an unqualified accuracy percentage without a reviewed validation package and a visible scope qualifier.

## 2. ROI, Labor-Saving, and Outcome Claims

### Claims covered

- “72% labor savings” or any percentage improvement.
- Hours saved, cost reduction, productivity, farmer income, yield, adoption, retention, or response-time improvements.
- “Manage 14,000 farmers,” “zero paper,” or other scale and transformation claims.
- Comparative claims such as “faster,” “more efficient,” “lower cost,” or “best.”

### Evidence required

- [ ] The claim has a named baseline: prior workflow, comparator product, or control group.
- [ ] The measured unit is explicit: minutes per visit, cost per case, visits per officer, response hours, hectares covered, or another defined unit.
- [ ] The study includes dates, geography, program type, participant count, device mix, and workflow scope.
- [ ] The study distinguishes pilot results from production-wide results.
- [ ] The methodology explains inclusion/exclusion criteria, missing data, outliers, and calculation rules.
- [ ] Results are reproducible from retained source data or an auditable analysis file.
- [ ] The sample is large and representative enough for the stated conclusion, or the claim is explicitly limited to the pilot.
- [ ] Confounding factors are documented, including training, staffing changes, seasonal effects, connectivity changes, and parallel process improvements.
- [ ] Results include uncertainty or a range where a single point estimate could mislead.
- [ ] Any annualized or projected benefit is labeled as a projection and includes assumptions.
- [ ] Customer permission exists for named organizations, farmer counts, logos, testimonials, and case-study figures.
- [ ] “Zero paper” is avoided unless paper use was measured and eliminated for the exact workflow and period claimed.
- [ ] Finance or commercial leadership approves pricing, savings, and payback calculations.

### Required format for a numerical outcome claim

> “In a [duration] pilot with [participant/program scope], GPExts reduced [specific task] time by [measured result] compared with [baseline], based on [method].”

If this level of detail cannot fit in the ad, use a non-numerical claim and place the methodology on the linked case-study page.

### Safer approved language

> “Measure time saved in selected workflows during a defined pilot.”

> “Designed to reduce reliance on paper records and improve follow-up visibility.”

> “Structured records can help teams review activity and prepare program reports.”

## 3. Carrier, SMS, USSD, 2G, and Language Claims

### Claims covered

- “Works on 2G,” “works on any phone,” or “works everywhere.”
- SMS delivery, USSD availability, delivery speed, cost, or reliability.
- A specific USSD code such as `*384*45#`.
- Local-language support, including Swahili, Luganda, or English.
- Claims about offline sync or coverage.

### Evidence required

- [ ] The exact country, mobile network operator, gateway, short code, USSD code, sender ID, and service configuration are recorded.
- [ ] The carrier or aggregator contract authorizes the advertised SMS/USSD use case and brand references.
- [ ] The USSD code is tested in the target market on the stated networks and is not presented as globally available.
- [ ] Tests cover session timeout, invalid input, retries, duplicate messages, opt-out, language selection, and service unavailability.
- [ ] SMS delivery evidence reports the correct metric, such as accepted, delivered, or read; these are not treated as equivalent.
- [ ] Tests cover basic phones, supported character encoding, long messages, local-language characters, and handset display limits.
- [ ] Pricing, recurring fees, message limits, and carrier dependencies are disclosed to sales and legal teams.
- [ ] Offline sync is tested with records created offline, app restart, device restart, authentication expiry, conflicts, retries, and intermittent connectivity.
- [ ] Coverage limitations and unsupported networks are identified.
- [ ] Every advertised language has reviewed translations for the exact messages shown, including agricultural terminology and opt-out text.
- [ ] Consent, opt-out, quiet hours, and applicable messaging rules are implemented and tested.

### Safer approved language

> “Reach supported farmers through configured SMS and USSD channels, including compatible basic phones.”

> “Deliver supported messages in configured languages, including English, Swahili, and Luganda where enabled.”

> “Use the configured USSD code for the target network.”

Do not show a specific USSD code in a global or reusable master edit unless the code is valid for every market in that edit.

## 4. NASA POWER, SoilGrids, FAO, and Other Data-Source Claims

### Claims covered

- “NASA weather telemetry.”
- “NASA-powered decisions.”
- “SoilGrids in every decision.”
- FAO citations, approved FAO guidance, or FAO-backed recommendations.
- Any third-party logo, name, dataset, endorsement, or certification reference.

### Evidence required

- [ ] The data provider, dataset name, API/version, license, attribution requirement, and retrieval date are recorded.
- [ ] The creative accurately describes the data as modeled, estimated, observed, forecast, or advisory; these terms are not interchanged.
- [ ] Spatial and temporal resolution, latency, refresh behavior, missing-data behavior, and geographic coverage are documented.
- [ ] The application’s fallback behavior is tested when the source is unavailable or stale.
- [ ] Cached or offline data is clearly labeled with its observation/forecast time and source date where relevant.
- [ ] Soil estimates are not presented as laboratory measurements or field-confirmed facts.
- [ ] Third-party terms permit the intended commercial use, screenshots, attribution, and distribution in advertising.
- [ ] Brand/trademark owners or legal counsel approve third-party names and logos.
- [ ] No wording or visual treatment implies NASA, FAO, SoilGrids, or another provider endorses, certifies, funds, or sponsors GPExts unless a written agreement confirms it.
- [ ] FAO materials are cited only where the content is actually retrieved, licensed, current, and displayed according to applicable attribution terms.
- [ ] Agronomist or product review confirms that external data is contextual information and does not replace field observations or professional judgment.

### Safer approved language

> “View weather indicators sourced from NASA POWER where coverage and connectivity permit.”

> “Use SoilGrids estimates as contextual information alongside field observations and lab results.”

> “Source controls can restrict guidance to configured approved references, including selected FAO materials where licensed and configured.”

## 5. Privacy, Security, Compliance, and Governance Claims

### Claims covered

- “OCAP compliant” or “OCAP data sovereignty compliance.”
- “GDPR compliant,” “fully compliant,” “secure,” “enterprise-grade,” or “audit-ready.”
- “Data sovereignty,” “owned by the farmer,” “private,” or “zero data sharing.”
- “Auditable reports” and claims about traceability.
- Security claims involving encryption, tenant isolation, access control, or availability.

### Evidence required

- [ ] The exact legal or governance framework and applicable jurisdiction are named internally.
- [ ] A current privacy impact assessment or equivalent review covers farmer identity, location, images, health/agronomic records, communications, analytics, retention, and deletion.
- [ ] Data-controller, data-processor, data-steward, and subprocessor responsibilities are documented.
- [ ] Consent, notice, lawful basis, access, correction, deletion, export, objection, and opt-out flows are tested where applicable.
- [ ] Data residency, cross-border transfer, hosting location, backup location, and administrator access are documented.
- [ ] Role-based access, tenant isolation, audit logging, encryption in transit/at rest, key management, and incident response are verified against the exact product version.
- [ ] Security claims are supported by current test results, independent assessment, certification, or a clearly bounded internal control description.
- [ ] “OCAP® alignment” is used only after assessment with the relevant First Nations or data stewards; do not present OCAP® as a generic certification or claim ownership on behalf of communities.
- [ ] “Audit-ready” is replaced with a description of available timestamps, source records, export fields, and review controls unless an independent audit supports the stronger claim.
- [ ] Legal counsel approves all regulatory, certification, sovereignty, and compliance wording.

### Safer approved language

> “The platform can be configured to support applicable data-governance requirements.”

> “Access controls and audit records support review of field activity, subject to the configured deployment.”

> “OCAP® alignment requires a documented assessment with the relevant data stewards.”

Avoid `fully compliant`, `guaranteed secure`, `zero risk`, and `zero data sharing` unless legal counsel approves the exact claim and the evidence covers all conditions.

## 6. Product Capability and Availability Checks

Before recording the final voiceover or screen capture:

- [ ] Every feature shown exists in the release build used for filming.
- [ ] The UI state is not a mock, placeholder, development-only route, or synthetic demo unless it is labeled as such.
- [ ] Offline, sync, AI, SMS, USSD, mapping, weather, soil, and reporting flows are tested end to end in the target environment.
- [ ] Demo data is clearly synthetic and does not expose personal or confidential farmer information.
- [ ] Feature availability by plan, market, device, language, carrier, and connectivity state is recorded.
- [ ] Error states and limitations are not hidden when they materially change the viewer’s interpretation.
- [ ] The final URL, QR code, phone number, and campaign tracking parameters are tested on the intended devices.
- [ ] The CTA destination contains the same qualification and scope stated in the ad.

## 7. Creative and Script Review

- [ ] Every number in the voiceover, supers, captions, UI, charts, and end card appears in the claim register.
- [ ] Every absolute word has been challenged: `all`, `any`, `always`, `never`, `100%`, `zero`, `guaranteed`, `instant`, `real-time`, and `every`.
- [ ] “Confidence” is not visually presented as “accuracy.”
- [ ] AI output is labeled `AI-assisted` or equivalent where required by product and legal review.
- [ ] On-screen claims are readable for the full duration and are not contradicted by small-print qualifications.
- [ ] Captions match the approved voiceover exactly.
- [ ] The ad does not imply that GPExts replaces field officers, agronomists, or local decision-makers.
- [ ] Third-party names and logos have approved attribution and trademark treatment.
- [ ] Testimonials identify the speaker, organization, date, and permission status, with material qualifications included.
- [ ] Before-and-after visuals use comparable conditions and are not misleadingly edited.
- [ ] The final frame uses one primary CTA and a tested destination.

## 8. Evidence Package and Sign-Off

Store the following with the final campaign version:

- [ ] Claim register with final wording and status.
- [ ] Model card and AI evaluation report.
- [ ] ROI/pilot methodology, source data, calculations, and limitations.
- [ ] Carrier, gateway, USSD, SMS, and language test results.
- [ ] Data-source licenses, attribution text, API/version details, and source-quality notes.
- [ ] Privacy, security, data-governance, and legal review records.
- [ ] Product release/version sign-off and device/browser test matrix.
- [ ] Final script, storyboard, captions, supers, voiceover, landing page, and CTA destination.
- [ ] Recording of the tested product workflow where the UI is used as proof.
- [ ] Approval record for each exception or qualified claim.

### Required approvals

| Area | Approver | Name/date | Status |
|---|---|---|---|
| Product capability and release scope | Product owner |  | Pending |
| AI/model claims | ML or agronomy lead |  | Pending |
| ROI and commercial claims | Finance/commercial owner |  | Pending |
| Carrier/SMS/USSD claims | Channel operations owner |  | Pending |
| Data sources and licensing | Data/platform owner |  | Pending |
| Privacy/security/governance | Security/privacy lead |  | Pending |
| Advertising/legal wording | Legal/compliance reviewer |  | Pending |
| Final creative and CTA | Marketing owner |  | Pending |

## 9. Default Safe Copy for the Current Ads

Use this copy when substantiation is incomplete:

> “GPExts is an offline-first platform for agricultural field teams. Officers can record visits, capture crop evidence, map fields, review AI-assisted assessments, and prepare follow-up guidance while offline. When connectivity returns, records sync to the regional workspace. Supported farmers can receive guidance through configured SMS and USSD channels, including compatible basic phones. Regional teams can review field activity and export structured reports for program oversight.”

### Claims currently requiring substantiation or qualification

- `96.4% confidence` or any crop-model performance percentage.
- `diagnose crop disease in 2 seconds`.
- `100% offline PWA`.
- `72% labor savings`.
- `14,000 farmers`.
- `zero paper`.
- `zero hallucinations`.
- `auditable reporting`.
- Specific USSD codes such as `*384*45#`.
- Universal 2G, “any phone,” or “works everywhere.”
- Unqualified NASA, FAO, SoilGrids, OCAP®, compliance, endorsement, or certification claims.

**Document owner:** Marketing/Product with Legal and Compliance review  
**Review cadence:** Before each campaign launch and whenever the model, carrier, data source, market, product release, or legal basis changes
