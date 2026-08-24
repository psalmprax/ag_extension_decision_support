# Spec: Market Linkage, Credit Scoring & Carbon Tracking (Phase 3.2 / 3.3)

**Status:** Stakeholder spec — these are business-model features; code is the smaller half

## Part A — Market Linkage + Credit Scoring (Phase 3.2)

### Problem
Farmers see market prices (read-only today) but cannot act on them. The revenue models that work in this space (Apollo Agriculture: input credit + advisory bundle) combine advisory trust with input financing. GPExts already has the two hardest ingredients: **farmer trust via officers** and **verified field/advice history via the Phase 1 efficacy loop**.

### Scope
1. **Input supplier catalog**: suppliers list products (seed, fertilizer, agrochemicals) with prices per district; officers/farmers browse; order request routed to supplier. New tables: `suppliers`, `products`, `product_listings`, `order_requests`. Fulfilment is OFF-platform v1 (phone-coordinated) — no payments/escrow until v2.
2. **Sell listings**: farmers post produce (crop, quantity, price, district) via officer or farmer PWA; buyers (aggregators) browse. Reuses the same listing infrastructure.
3. **Credit scoring (v2)**: score = f(visit adherence, efficacy-loop outcomes, farm size, yield history, voucher repayment history). `vouchers` + `TransactionSubmission` models already exist; efficacy loop (Phase 1.1) supplies the behavioral signal. Score gates input-credit limits. **Requires**: a lending partner (bank/MFI/fintech) or balance-sheet decision — this is the business gate.

### Why Phase 1.1 is a prerequisite
Credit without outcome data is collateral-less lending with worse information than the MFI down the road. The efficacy loop makes GPExts the only player with verified advice-adherence history per farmer.

### Business gates (stakeholders)
1. Lending partner or balance-sheet appetite
2. Supplier-side sales motion (who onboards suppliers?)
3. Regulatory: credit provision in Malawi/others (Reserve Bank licensing thresholds)
4. Take-rate model: supplier commission vs farmer subscription vs lender origination fee

## Part B — Carbon / Regenerative Practice Tracking (Phase 3.3)

### Problem
Climate finance pays for verified regenerative practice, but verification is the bottleneck. GPExts already has the verification primitives: officer field visits (ground truth), photo evidence, NDVI time series (satelliteService), and per-farmer identity.

### Scope
1. **Practice logging**: farmers/officers log practices (cover cropping, agroforestry, reduced tillage, composting) against fields — new `practice_logs` table, taxonomy from a recognized standard
2. **Verification signals**: NDVI trend analysis (existing `satelliteNDVITool`) + officer photo verification → `practice_verifications` with evidence chain
3. **Aggregation**: per-district carbon-program dashboards showing enrolled hectares + practice adoption rates

### Methodology gate (business decision)
- **Verra VM0042** (Improved Agricultural Land Management) — market standard, heavy documentation, third-party validation required, multi-year commitment
- **National/jurisdictional programs** (e.g., Malawi carbon markets initiative under Article 6) — government partnership route
- **Interim option**: corporate Scope-3 insetting programs (offtakers pay suppliers for regenerative practice) — fastest to revenue, lighter methodology

Recommendation: start with the interim corporate insetting route (one anchor offtaker, 2–3 districts, practice logging + NDVI verification), graduate to VM0042 once volume justifies validation costs (~$50–100k+ program cost).

### Why GPExts wins here
Officer-verified ground truth + satellite corroboration is the exact combination carbon programs lack. The visit pipeline IS the MRV (measurement, reporting, verification) backbone.

## Sequencing recommendation

1. Ship Phase 1.1 efficacy loop (done) → 2. Supplier catalog + listings (code-only, ~3–4 weeks) → 3. Sign lending partner → credit scoring → 4. Anchor offtaker → carbon practice logging
