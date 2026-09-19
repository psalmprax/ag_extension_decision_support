# AG-Extension: Project Concept for Investors & Grant Partners
### Revenue Generation, Data-Processing Infrastructure, and High-End Cocoa & Coffee Value Chain

> Audience: investors, grant-makers, export/cooperative partners.
> Status: concept note grounded in the existing AG-Extension Decision Support platform.
> Related: `README.md`, `ARCHITECTURE_PILLARS.md`, `docs/M4D_Application_Final_Draft.md`, `docs/IRAP_submission_plan.md`, `presentations/investor_pitch_deck.html`.

---

## 1. Project Concept for AG

**One-liner:** AG-Extension turns agricultural advisory from untracked visits into verifiable, AI-supported service delivery — then converts that verified data into farmer income (yield + price premium) and platform revenue.

**What exists today:**
An AI-powered extension platform serving field officers and farmers:

- Conversational AI agronomist with 7-provider fallback (OpenAI, Groq, Azure OpenAI, Google Vertex, Anthropic, Ollama) — no single-provider outage stops advice.
- 22 MCP agricultural tools: weather + farming advice, disease diagnosis, market price analysis, yield prediction, satellite NDVI, RAG research, translation, agent orchestration.
- Disease monitoring + quarantine escalation, 48-hour proactive hazard warnings (frost, flood, heatwave, pest/blight window).
- Zero-connectivity field edge: on-device leaf diagnosis (HTML5 Canvas chromaticity), WGS-84 parcel mapping with GeoJSON export, durable offline mutation queue with idempotency and conflict reconciliation.
- Inclusion channels: WhatsApp/SMS, Swahili/vernacular voice-note transcription, IVR/DTMF broadcasts for low-literacy users.
- Economic closure: certified agro-dealer directory + anti-counterfeit batch check, harvest offtaker matchmaking, cross-border price arbitrage (KES/UGX/TZS/RWF/ETB normalized to USD).
- Trust & compliance: TOTP 2FA, lockout, SHA-256 session revocation, GeoIP audit; EUDR zero-deforestation verifier + GS1 Digital Link farm-to-fork passports; IPCC Tier 2 soil carbon MRV; 0–1000 agronomic credit score + parametric weather-index insurance; multi-tenant org/region/co-op federation.

**The problem we solve:**
1. Advisor deficit — ~1 officer per 3,000 farmers in target regions; 85%+ of smallholders get no timely agronomy advice.
2. Preventable loss — 25–30% yield lost to pests, disease, weather mistiming.
3. Price loss — ~30% value captured by middlemen due to no price transparency, no aggregation, no provable quality/traceability.
4. Visibility crisis for funders — "ghost visits," paper logs, no measurable return on extension spend.

**Concept shift:** every advisory interaction, visit, soil test, NDVI anomaly, and offtake match becomes a signed telemetry event. Agencies and co-ops buy accountability; farmers get yield + premium; the platform earns SaaS + transaction + data revenue on the same event stream.

**Target pilot wedge:** high-value perennial export chains — **cocoa and specialty coffee** — where quality grading + EUDR + traceability directly unlock export premiums. Staples (maize, cassava) ride the same rails for scale.

---

## 2. How Revenue Generation Is Formed

Revenue is formed in layers on one data foundation: verified farmer + field + advisory events. No layer requires a separate app.

### 2.1 Core recurring (base)

**A. B2B co-op / union / exporter SaaS — primary engine (~70–75% of revenue at scale)**
- Who pays: cooperatives, cocoa/coffee unions, commercial estates, county extension agencies, NGOs.
- What they buy: multi-tenant workspace (Organization → Region → Co-op → Officer → Farmer), officer performance index, visit verification, advisory compliance, white-label branding, custom chemical restriction rules.
- Pricing form: annual license per co-op + per-officer seat + per-farmer enrolled band. Illustrative structure only — set per market after pilot costing.
- Why it retains: switches the buyer from "software" to "auditable proof of delivery" they report to boards, donors, and regulators.

**B. Commercial / high-end producer subscriptions (~10–15%)**
- Who pays: outgrower schemes, specialty coffee estates, cocoa fermentary operators, agro-processors.
- What they buy: parcel NDVI monitoring, IoT/VPD irrigation triggers, pest swarm radar alerts, spray/drone mission planning, ROI/BCR modeling per block.
- Pricing form: per-hectare per-season subscription, tiered by monitoring frequency.

### 2.2 Transactional (grows with volume)

**C. Input marketplace + service commission (~3–5%)**
- Certified agro-dealer geo-inventory, anti-counterfeit batch verification, tractor/solar-pump sharing, ULV drone spray dispatch (wind-buffered mission planner).
- Take rate on completed bookings/orders fulfilled through the platform. No inventory risk.

**D. Offtake facilitation fee (~5–8% in cocoa/coffee focus)**
- Harvest aggregation by county/harvest window, institutional buyer matching (millers, grinders, specialty roasters/exporters), cooperative premium modeling vs. middleman spot.
- Fee as % of contracted premium uplift or fixed per-ton facilitation fee. Aligns platform incentive with farmer price, not against it.

**E. Traceability & compliance passport fee (per-batch)**
- EUDR due-diligence certificate + GS1 Digital Link QR (`https://id.agriextension.org/01/{gtin}/10/{batchId}`) with GPS origin, MRL compliance, fair-trade and carbon signals.
- Buyer or exporter pays per-batch passport issuance/verification. Required for EU market access post-EUDR — willingness to pay is regulatory, not optional.

### 2.3 Data & financial services (high margin, later)

**F. Data Insights API licensing (~5–7%)**
- Anonymized, consent-scoped aggregates: yield attainment by zone, input adoption, NDVI stress indices, price spreads, hazard exposure.
- Buyers: insurers, fertilizer/seed companies, lenders, researchers. Strict tenant isolation (`organization_id` scoping) + community consent model.
- Pricing form: tiered API calls + custom reports. Never sells farmer PII.

**G. Lending & insurance referral + carbon MRV share**
- 0–1000 agronomic credit score (AAA–C) unlocks micro-lending; parametric weather-index underwriting automates drought/flood payouts.
- IPCC Tier 2 SOC engine quantifies tCO2e (`ΔSOC × ha × 3.667`). Voluntary agriculture offsets averaged ~$7–8/tCO2e in 2023–24 (Ecosystem Marketplace via CRS R49035); CORSIA-eligible units traded ~$10/t in mid-2026 (Carbon Pulse). Model conservatively at $7–12/t, with upside only for CCP-labelled soil-carbon lots (issuance ~4.5M units in 2025, AlliedOffsets/Carbon Pulse).
- Revenue form: referral/origination fee from FSPs + MRV verification fee + share of credit issuance services. Requires licensed partners; platform does not underwrite risk.

### 2.4 Revenue formation logic

```
Verified visits + advice → yield gain (BCR-proven)
  → aggregation + grading + passport → export premium
    → SaaS (access) + facilitation (volume) + passport (batch) + API/MRV (data)
```

Grant capital funds the verifiable rails; commercial revenue scales on premium capture, not on charging poor farmers per query. Smallholders access advice free via co-op/buyer-sponsored seats, WhatsApp/SMS, and voice — monetization sits with institutions capturing the uplift.

---

## 3. What We Need in Terms of Infrastructure / Capabilities for Data Processing

Split into what exists and what grant/investment must add for a cocoa/coffee-grade operation.

### 3.1 Existing data backbone

- **Transactional store:** PostgreSQL 16 + Prisma, parametrized role-scoped queries; pgvector for RAG v2 hybrid search + rerank + knowledge graph.
- **Cache/queue/realtime:** Redis (cache, Socket.IO adapter, BullMQ) for advisory jobs, broadcast campaigns, ingestion workers.
- **Object storage:** S3-compatible abstraction (Backblaze B2 $0.006/GB raw, Cloudflare R2 zero-egress streaming, Wasabi/Hetzner/MinIO/local) with presigned browser uploads, magic-byte validation, SHA-256 report archival.
- **AI layer:** provider-resilient router with health-checked fallback; RAG fused with FAOSTAT agronomic data; Whisper-class vernacular transcription.
- **Field edge:** offline-first PWA + Capacitor; IndexedDB/localStorage mirrored queue, exponential backoff, 409 conflict surfacing; on-device vision + geodesic acreage.
- **Observability:** health/live/ready probes, audit logs, login telemetry, performance indices.

### 3.2 Required additions for scale (the ask)

**A. Ingestion & pipelines**
- Satellite tasking: Sentinel-2 NDVI/EVI/NDWI refresh per parcel per 5–10 days; temporal anomaly job (ΔNDVI ≤ −15% vs. 30-day baseline → scouting task).
- Weather/market feeds: 48-hour hazard daemon + regional commodity price normalization pipeline with FX and freight/SPS cost model ($0.075/ton-km baseline).
- IoT/LoRaWAN: soil VWC/EC/temperature ingestion + VPD computation (`SVP = 0.61078·exp(17.27·T/(T+237.3))`) for irrigation pulses; gateway backhaul for remote fermentaries/washing stations.
- Crowd-sourced pest radar: DBSCAN (ε = 30 km) + wind-vector 24/48h trajectory jobs.

**B. Compute & storage sizing (pilot → scale)**
- Pilot (15 officers, 1,000–15,000 farmers): single Postgres primary + Redis + one object-storage bucket + one worker tier suffices; satellite and AI inference are the dominant variable costs.
- Scale (100+ co-ops, 100k+ farmers): read replicas, partitioned telemetry tables, regional object-storage caching, dedicated GPU/CPU pool for reranking and vision, rate-limited broadcast workers for SMS/IVR.
- Cost control: semantic caching for repeated advisory queries; R2 for high-egress farmer media; B2 for cold archival.

**C. Data governance & trust**
- Tenant isolation enforcement, OCAP-aligned community consent (ownership/control/access/possession), encrypted farmer PII, batch passport signing keys with rotation, MRL/EUDR evidence retention.
- Human capability: 2 backend/data engineers (pipelines, PostGIS/pgvector tuning), 1 agronomy data steward (label QC for cocoa black pod / coffee leaf rust models), 1 field ops coordinator per cluster for device training and consent.

**D. Connectivity reality**
- Design for 2G/SMS fallback: all critical alerts available as SMS/IVR/WhatsApp voice; full dashboard only when bandwidth allows. No feature that requires continuous connectivity for cocoa fermentation timing or spray windows.

**Grant funds:** device kits (low-end Android + GPS), LoRaWAN gateways for pilot blocks, satellite/API feed credits, field enumerator stipends, EUDR baseline mapping. **Investment funds:** engineering hires, multi-region hardening, passport/insurance partner integrations.

---

## 4. High-End Producer Focus: Cocoa & Coffee Value Chain, Supply Chain, and Pricing

### 4.1 Why cocoa & coffee first

- Highest premium per verifiable quality/traceability intervention.
- EUDR makes deforestation-free proof a market-access gate for EU cocoa/coffee — non-compliant lots are discounted or rejected.
- Post-harvest handling (cocoa fermentation/drying; coffee cherry→washed/natural, drying to 11–12% moisture) determines 40–60% of realized price. Advisory + timing + moisture discipline is directly monetizable.

### 4.2 Supply chain map (as instrumented by the platform)

```
Inputs (certified seed/clones, fertilizer, bio-control)
  → Farm (parcel polygon + soil test + NDVI baseline + credit score)
    → Crop care (pruning/shade, spray timing, pest radar, hazard alerts)
      → Harvest (selective picking maturity windows)
        → Post-harvest (cocoa: pod break → 5–7d ferment + sun-dry to ~7.5%;
                        coffee: cherry sort → wash/natural → dry to 11–12%)
          → Grading/QC (bean count, cut test, defect count, cupping score)
            → Aggregation (co-op lot bulking by grade + harvest window)
              → Traceability passport (EUDR DDS + GS1 QR + MRL + carbon tag)
                → Offtake/export (contract vs. spot, cross-border arbitrage check)
```

Platform touchpoint per stage: input verification, parcel + soil record, spray/irrigation advisory, harvest timing push, post-harvest checklists via IVR/WhatsApp, QC capture with photo evidence in object storage, lot aggregation dashboard, passport issuance, buyer match with net-spread calculator.

### 4.3 Pricing — how farmgate price is actually formed

**Base:** world reference (cocoa: ICE futures; coffee: arabica/robusta benchmarks) → local exporter spot → co-op price → farmgate after costs. Farmers without aggregation or proof take the lowest tier.

**Premiums the platform helps capture (stackable):**

| Premium lever | Mechanism | Platform enabler |
|---|---|---|
| Quality grade | Correct fermentation/drying, bean size, defect rate, cupping score | Post-harvest protocols + moisture/QC capture + officer verification |
| Certification | Organic / Rainforest / Fairtrade audit trail | Multi-tenant compliance rules + visit/advisory logs as audit evidence |
| EUDR compliance | Proof parcel was not deforested post 2020-12-31 | Polygon vs. forest-baseline check + DDS certificate |
| Traceability | Signed farm-to-fork batch identity | GS1 Digital Link passport, QR verification for buyer |
| Volume aggregation | Bulk contract vs. distress spot sale | Lot aggregation + offtaker match + premium-vs-middleman model |
| Timing/arbitrage | Sell into stronger corridor, avoid gluts | Cross-border net-margin engine (price − freight − customs − SPS) |
| Carbon/low-input | Shade-grown, SOC-building practices | IPCC Tier 2 MRV + low-carbon tag on passport |

**Illustrative math (directional, not a promise):**
If middleman spot = 100 units and export-grade contracted lot realizes 135–150 units through grading + aggregation + EUDR passport, the 35–50 unit uplift funds: farmer gain (majority), co-op operations, platform facilitation + passport fees. The ROI service (`agronomicRoiService`) models this per hectare as yield gain %, net profit gain/ha, BCR, and break-even price/ton — the number loan officers and buyers underwrite against.

**Risk controls on pricing claims:** no guaranteed farmgate figure is quoted to farmers; the platform shows (a) live corridor prices, (b) grade-gated contract options, (c) net-of-cost spreads. Parametric insurance and credit scoring reference the same verified history, reducing adverse selection for lenders.

### 4.4 High-end producer operating model

1. Onboard estate/co-op as tenant; map every parcel (WGS-84 polygon), soil test, shade inventory.
2. Enroll farmers under sponsored seats; deploy voice/SMS for illiterate/low-bandwidth members.
3. Run NDVI + hazard + pest radar loops; push spray/harvest/post-harvest actions with 48-hour lead time.
4. Capture QC at fermentary/washing station; bulk by grade; issue EUDR+GS1 passports per lot.
5. Match to buyers on net spread; settle via transparent lot ledger; feed repayment/fulfillment back into credit scores.
6. Report to grantors/investors on: yield delta, premium captured, % lots passported, % visits verified, payout/claim latency.

---

## 5. Other Priority Value Chains — Opportunities Beyond Cocoa & Coffee

Cocoa and coffee are the premium wedge. The same rails (parcel mapping, NDVI/hazard loops, QC capture, aggregation, passporting, offtake match, credit/insurance) extend to seven adjacent chains selected for margin, scale, food-security relevance, and grant alignment. Each entry states the chain logic, price formation, and direct platform fit.

### 5.1 Cashew (raw nut → kernel export)

- **Supply chain:** nursery grafts → farm establishment/pruning → harvest (fallen-nut collection timing) → sun-drying to 8–10% → jute-bag storage → outturn/KOR grading (kernel outturn ratio) → aggregation → local processing or raw-nut export → kernel/butter buyers.
- **Pricing:** base on international RCN price + KOR premium (high-KOR lots command step-change premiums) + processing margin if shelled locally. Poor drying/storage and mixed KOR collapse farmgate to distress levels.
- **Platform fit:** harvest-timing pushes via SMS/IVR, drying/storage checklists with photo evidence, KOR test capture per lot, aggregation by KOR band, offtaker match (processors vs. raw exporters), cross-border spread check. Drone/parcel mapping for new orchard blocks; credit score from orchard maintenance history.
- **Revenue link:** SaaS (processor/co-op seats) + per-ton facilitation + QC/passport per lot.

### 5.2 Shea (nut → butter, cosmetics export)

- **Supply chain:** parkland collection (women-led groups) → parboiling → drying → crushing → roasting → milling/kneading → butter grading (moisture, free fatty acid, impurities) → aggregation → cosmetics/food buyers with organic/fair-trade audit.
- **Pricing:** base shea-nut/butter spot + quality grade (low-FFA, low-moisture) + organic/fair-trade certification + traceability-to-collector-group premium demanded by EU/US cosmetics buyers.
- **Platform fit:** group enrollment under multi-tenant co-op nodes, voice-first training (low-literacy), batch QC capture at processing centers, anti-adulteration lot identity, GS1 passport for export butter, aggregation ledger that attributes premium back to collector groups.
- **Revenue link:** SaaS for unions/processors + per-batch passport + marketplace fee on certified butter contracts. Strong gender-impact narrative for grants.

### 5.3 Staples: maize, rice, soybean (food security + scale)

- **Supply chain:** certified seed + soil-test fertilizer → planting-window advisory → Fall Armyworm/MLND scouting (maize), blast management (rice) → harvest moisture control → hermetic storage/aggregation → milling/feed/offtaker contracts → cross-border corridors.
- **Pricing:** harvest-gluts crash spot; quality (moisture, aflatoxin-safe, broken-grain %) + storage (sell 2–4 months post-harvest) + bulk contracts + cross-border arbitrage (e.g., surplus-to-deficit corridors net of $0.075/ton-km freight + customs/SPS) determine realized price.
- **Platform fit:** edge vision classifier (Fall Armyworm, MLND already in rule base), pest swarm radar (DBSCAN ε = 30 km + wind trajectory), hazard daemon (flood/heatwave), mechanization sharing (tractor dispatch), hermetic-storage prompts, lot aggregation + arbitrage engine, parametric drought/flood insurance tied to verified planting dates.
- **Revenue link:** high-volume SaaS (county/NGO programs) + mechanization commission + insurance/credit referral at scale. Lower margin per ton, highest farmer-count and food-security impact.

### 5.4 Horticulture: tomato, onion, mango, avocado, chili (perishable, fast cash)

- **Supply chain:** nursery/seedling QC → staggered planting → IPM + VPD-driven irrigation → maturity grading → same-day harvest → crates/cold-chain → collection-center sorting → urban/export offtake (contracts + spot) → rapid settlement.
- **Pricing:** extreme intraday volatility; grade/size/shelf-life + timing (avoid glut days) + cold-chain integrity + contract vs. roadside-spot spread. Post-harvest loss (30–40% without cold discipline) is the hidden tax.
- **Platform fit:** IoT soil/VPD irrigation triggers, satellite stress anomalies per block, late-blight warnings (tomato rule base exists), harvest-readiness alerts, collection-center QC photo capture in object storage, buyer match with same-day settlement ledger, voice alerts for illiterate transporters.
- **Revenue link:** per-hectare subscriptions for commercial vegetable blocks + collection-center SaaS + per-crate facilitation. Fastest payback story for youth/women agripreneurs.

### 5.5 Cassava (fresh root → gari, flour, starch)

- **Supply chain:** clean cuttings (CMD-free) → weed/fertility management → 9–12 month harvest timing (starch peak) → rapid processing within 48h (perishability) → grating/pressing/fermentation/flash-drying → graded gari/flour/starch → industrial (brewery/starch) + retail buyers.
- **Pricing:** fresh-root price is low and transport-sensitive; processing multiplies value 2–4x. Starch content + dryness + food-safety (cyanide reduction via correct fermentation) gate industrial contracts.
- **Platform fit:** CMD mottling detection (in edge rule base), harvest-starch-window advisory, 48-hour processing coordination via broadcast, processing-center throughput matching, batch QC + food-safety checklist, offtaker match to starch/brewery buyers.
- **Revenue link:** processor SaaS + per-ton processed facilitation + equipment-sharing commission (graters, presses, flash dryers via mechanization registry).

### 5.6 Poultry & dairy (short-cycle protein, daily cash flow)

- **Supply chain:** day-old chicks / heifer sourcing → feed formulation + vaccination calendar → housing/hygiene compliance → egg/milk collection → cold-chain bulking → retail/processor contracts.
- **Pricing:** feed cost is 60–70% of cost; mortality/mastitis control + vaccination compliance + cold-chain + contract regularity determine margin. Daily product means daily price exposure.
- **Platform fit:** vaccination/heat-stress alert broadcasts (reuse hazard daemon + IVR), feed-price intelligence via market tools, collection-center bulking ledger, credit score from delivery consistency for stockist/vet-input advances, parametric heat cover where feeds allow.
- **Revenue link:** input/vet marketplace commission + collection-center SaaS + lending referral. Extends platform beyond crops with minimal new build (scheduling + ledger + alerts already exist).

### 5.7 Honey & aquaculture (low-footprint, high-value diversification)

- **Supply chain (honey):** apiary siting → hive health checks → harvest timing (moisture <20%) → settling/filtering → moisture/refractometer grading → labeled, traceable jars/bulk drums → premium retail/export.
- **Supply chain (fish):** pond/cage stocking → water-quality + feed management → growth sampling → partial/total harvest → cold-chain → local/urban buyers.
- **Pricing:** honey: moisture + purity (anti-adulteration) + floral origin + organic label drive 2–3x spreads. Fish: size uniformity + freshness/cold-chain + harvest timing vs. market-day gluts.
- **Platform fit:** apiary/pond parcel registry (reuse WGS-84 + GeoJSON), harvest-readiness checklists, batch QC + anti-adulteration identity + GS1 passport for export honey, buyer match, diversification signal that improves the farmer credit score (climate-resilience points).
- **Revenue link:** passport per batch + buyer facilitation + resilience uplift that de-risks the lending book across all other chains.

### 5.8 Prioritization matrix

| Chain | Margin potential | Scale / food security | Speed to revenue | Grant resonance | Platform reuse |
|---|---|---|---|---|---|
| Cocoa / coffee (wedge) | Very high | Medium | Medium | High (EUDR, export) | Base |
| Cashew | High | Medium | Medium | High (processing jobs) | Very high |
| Shea | High | Medium | Medium-fast | Very high (women, climate) | Very high |
| Maize / rice / soy | Medium | Very high | Fast (volume) | Very high (food security) | Very high |
| Horticulture | High | High | Fastest | High (youth, nutrition) | High |
| Cassava | Medium-high | Very high | Fast | High (industrialization) | High |
| Poultry / dairy | Medium-high | High | Fast | Medium-high (nutrition) | Medium-high |
| Honey / aquaculture | High (niche) | Medium | Medium | High (biodiversity, resilience) | Medium |

**Sequencing recommendation:** hold cocoa/coffee as the export-premium proof; add horticulture + staples in the same pilot geography for volume and daily-cash stories; add cashew/shea as the second-region processing play; layer poultry/dairy and honey/fish as diversification and credit-book stabilizers. No new core platform is required — only chain-specific QC checklists, grading tables, and buyer integrations.

---

---

## 6. Sourced Market & Price Anchors (September 2026 cut)

All figures below are public benchmarks with retrieval dates. Use them as the pricing floor for pilot modeling; farmgate realization is net of costs and grade discounts.

**Cocoa**
- ICE Cocoa futures (world benchmark, $/MT): Sep-26 ~$6,049; Dec-26 ~$6,175; Mar-27 ~$6,291 (ICE Futures U.S., quoted 4–6 Sep 2026). US benchmark traded ~$5,683.50/MT on 7 Aug 2026 after COCOBOD reported 2025/26 output at ~750,000 MT (+25.6% YoY).
- Ghana farmgate (regulated): GH¢41,392/tonne for 2026 Light Crop (GH¢2,587 per 64 kg bag; GH¢1,241.76 per 30 kg load, COCOBOD circular 12 Jun 2026, purchases from 18 Jun 2026). Proposed 2026/27: GH¢43,792/tonne (~$3,820/t, ~2,737 cedis/bag, Bloomberg via Ecofin 9 Sep 2026, ministerial sign-off pending).
- Implication: regulated farmgate does not track daily futures. Premium capture must come from grade, KOR/outturn discipline, aggregation, and EUDR passporting — not from timing the ICE curve.

**Coffee**
- ICO Composite (I-CIP): 287.26 US cents/lb avg Jul 2026 (+15.4% MoM); 272.90 cents/lb early-Sep 2026 avg. Colombian Milds ~371–383c; Robustas ~169–184c (ICO CMR Jul 2026; ICO daily tables Sep 2026).
- Futures: London Robusta Nov-26 ~$3,739/MT (18 Aug 2026); NY Arabica Dec-26 ~332.45c/lb (18 Aug 2026). Uganda farmgate week of Aug 2026: FAQ 12,000–13,000 UGX/kg; Kiboko 5,500–6,500; Arabica parchment 15,000–16,000 (MAAIF daily reports).
- Implication: wide Arabica/Robusta spread and intraseason volatility reward grading, moisture discipline, and contract-vs-spot timing — the exact variables the QC + arbitrage engine tracks.

**Carbon (correction to earlier drafts)**
- Voluntary agriculture offsets averaged $7 (2023) to $8 (2024) per tCO2e; forestry/land-use $10 → $9 (Ecosystem Marketplace via US CRS R49035, 2026). CORSIA benchmark slid to ~$10/t in May–Aug 2026 (Carbon Pulse). Soil-carbon issuance grew to ~4.5M units in 2025 from ~1.6M in 2024; CCP-labelled soil issuance doubled in H1 2026 (AlliedOffsets/Carbon Pulse, Jul 2026).
- Modeling rule adopted in this note: $7–12/t base; higher only with CCP label + buyer contract. Prior $15–30/t references are retired.

**Addressable market frame**
- Global AgTech ~$17.81B (2025) → ~$72.05B (2035) at ~15.0% CAGR (EMR, Aug 2026). Agritech ~$34.58B (2025) → ~$38.56B (2026) at 11.5% (Research and Markets, 2026). Digital Agriculture ~$22.8–24.1B (2025) → ~$64.6–78.1B (2035) at 10.4–13.1% (InsightAce, Vantage, Feb–May 2026).
- Serviceable focus for this platform is not the full stack: it is co-op/processor SaaS + traceability/passporting + advisory-driven offtake in Ghana, Uganda, Kenya, and Malawi. That SAM is a narrow slice of the figures above; sizing per district/co-op pipeline is in Section 7.

---

## 7. Unit-Economics Model (to validate in pilot — not a guarantee)

Model structure only. Replace unit prices with signed pilot price lists before any investor close.

| Unit | Illustrative price basis | Cost drivers | What proves it |
|---|---|---|---|
| Co-op SaaS seat | Annual license per co-op + per-officer seat + per-farmer band | Onboarding, training, support, SMS/IVR credits | 3 co-ops paying 2 consecutive seasons, churn reason logged |
| Per-hectare monitoring | Per-ha per-season, tiered by NDVI refresh + IoT | Satellite/API fees, sensor gateways, field QC | NDVI anomaly → scouting → action closure rate |
| Per-batch passport (EUDR+GS1) | Per-lot issuance + verification call | Baseline mapping, key management, audit retention | Buyer acceptance rate for EU-bound lots |
| Per-ton facilitation | Fixed fee or % of uplift vs. documented spot | Aggregation labor, QC, settlement | Net premium/ton after freight, customs, SPS |
| Data API | Tiered calls + custom reports | Anonymization, consent admin | 1 paying data buyer on consented aggregates |
| Credit/insurance referral + MRV | Origination fee + MRV verification fee | FSP integration, actuarial review, SOC sampling | Claim latency, repayment delta vs. control |

Break-even discipline: each chain owner reports BCR per hectare (yield gain %, net profit gain/ha, break-even price/ton) from `agronomicRoiService` against a control cohort. No chain scales without BCR > 1 after full costs including SMS/IVR and QC labor.

---

## 8. Competitive Landscape & Moat

| Player | Base | What they do well | Gap AG-Extension exploits |
|---|---|---|---|
| Apollo Agriculture (Kenya/Zambia, Series B, ~$75M raised, SoftBank Vision Fund 2) | Nairobi | Input credit + ML score + satellite + insurance via Pula; 100k+ farmers financed | Credit-led, staples-centric; no EUDR/GS1 export passport, no offline edge vision, no multi-tenant white-label for unions/exporters |
| Farmerline / Mergdata (Ghana, Kumasi) | Kumasi | Field agents + Mergdata reaching 2.3M farmers via 3,000 partners across 50 countries; shea/EUDR content | Agent-network heavy; advisory + marketplace, but no provider-resilient AI router, no parametric underwriting engine, no drone/mechanization dispatch in one tenant |
| Esoko | Accra / multi-country | SMS/voice prices, weather, market linkage via basic phones | Information service, not verifiable service-delivery telemetry with officer performance index |
| ThriveAgric (Nigeria/Kenya) | Abuja | Input finance + field-officer monitoring; 200k+ farmers | Finance-first; limited traceability/MRV and cross-border arbitrage tooling |
| Degas, MazaoHub, Sowit | West/East Africa | Niche agri-fintech, soil analytics, sensors | Single-point tools; no federated multi-chain rails |

Defensibility claimed on architecture, not marketing: offline-first idempotent sync, 7-provider AI fallback with health-checked routing, RAG v2 hybrid + knowledge graph fused with FAOSTAT, tenant-scoped SQL isolation, signed batch passports, and IPCC Tier 2 MRV in the same tenancy. Each is shippable; together they raise switching costs for co-ops that have passported lots and scored farmers inside the system.

---

## 9. Traction, Team & Confirmations Required

No traction is invented in this note. The following are required from the project owner before investor circulation:

- **Pilot pipeline:** name 3 candidate co-ops/unions/processors (cocoa/coffee + one staples/horticulture), hectares, farmer counts, season start dates, and letter status (MOU/LOI/none).
- **Buyer pull:** name 1–2 offtakers per wedge chain willing to accept passported lots and state grade specs; attach indicative price grids.
- **Measured baseline:** most recent season yield/ha, post-harvest loss %, and realized farmgate/ton for each pilot group to anchor BCR controls.
- **Team roster:** founders, agronomy lead, engineering leads, field coordinators — names, roles, time commitment, and hiring gaps for the two data-engineer and one steward roles in Section 3.2.
- **Entity & compliance:** operating entity per market, data-protection registration, and EUDR Due Diligence Statement workflow owner.

Until these are attached, circulate this note as a concept with a labeled appendix for confirmations, not as a committed pipeline.

---

## 10. Budget Shape, Milestones, M&E, and Risks

**Illustrative 12-month pilot budget structure (owner to price locally):**
~60% field delivery (devices, enumerators, agronomists, QC labor, SMS/IVR); ~20% data feeds and infrastructure (satellite, AI inference, storage, gateways, EUDR mapping); ~15% engineering (offline RAG hardening, passport/FSP integrations); ~5% MRV audit readiness and safeguards. Grant funds field + feeds; investment funds engineering + scale hardening. No sales hiring is charged to grant.

**Milestones:**
Months 0–3: parcel mapping + soil baselines + buyer grade grids signed. Months 3–6: first NDVI/hazard/pest loops closed with action evidence. Months 6–9: first aggregated passported lots sold on contract. Months 9–12: BCR vs. control published, credit/insurance referral live with one FSP, carbon sampling frame ready.

**M&E (reported from telemetry, not surveys alone):** % visits verified, advisory resolution rate, yield delta/ha vs. control, net premium/ton vs. documented spot, % lots passported and buyer-accepted, payout/claim latency, % women/youth beneficiaries, tCO2e sampling coverage.

**Top risks and mitigations:** side-selling breaks aggregation → transparent lot ledger + prompt settlement; EUDR baseline disputes → licensed geospatial source + retained evidence; SMS/IVR cost overrun → semantic caching + 2G-first design; buyer default → multi-buyer matching + partial prepayment terms; data misuse → tenant isolation + OCAP-aligned consent + encrypted PII; carbon price softness → model at $7–12/t and treat MRV as upside.

---

## 11. Split Ask — Investor vs. Grant (do not merge)

**Grant ask:** fund verifiable public goods — devices, baselines, feeds, field staff, inclusion channels, M&E — for 1,000–15,000 farmers across 3 clusters. Return is measured impact: yield BCR, premium/ton, verified coverage, gender/youth reach, audit-ready evidence.

**Investment ask:** fund the scale engine — offline RAG, federated telemetry, passport/FSP integrations, multi-region hardening, co-op onboarding team. Return is recurring SaaS + per-ha + per-batch + per-ton revenue on passported, contracted volume. Commercial close is conditional on pilot BCR and buyer acceptance in Section 10.

---

## 12. Ask & Use of Funds (summary)

**Grant (pilot validation):** field devices, EUDR baseline mapping, satellite/feed credits, enumerator and agronomist stipends, voice/SMS broadcast costs.

**Investment (scale engine):** Canadian + field engineering for offline RAG, federated telemetry, passport/insurance integrations; co-op onboarding team; MRV audit readiness.

Both tranches report against the same telemetry: verified visits, advisory resolution rate, yield BCR, premium per ton, passported share, carbon sampling pipeline.

---

## 13. Appendix — Capability → Revenue Trace

| Platform capability | Revenue it supports |
|---|---|
| Multi-tenant federation, visit verification, performance index | B2B SaaS |
| NDVI, IoT/VPD, pest radar, drone/mechanization dispatch | Per-hectare subscriptions + service commission |
| Agro-dealer directory + batch verification | Input marketplace take rate |
| Lot aggregation + offtaker match + arbitrage engine | Offtake facilitation fee |
| EUDR verifier + GS1 passport | Per-batch passport fee |
| Anonymized aggregates API | Data licensing |
| Credit score + parametric insurance + SOC MRV | FSP referral + MRV/credit issuance fees |

### Sources (accessed 14 Sep 2026)

- ICE Futures U.S., Cocoa Futures pricing (Sep-26 ~$6,049; Dec-26 ~$6,175) and contract specs (Ghana/Ivory Coast Group A +$160/t).
- COCOBOD circular 12 Jun 2026 via cocobod.gh / GNA / High Street Journal: GH¢41,392/tonne Light Crop (GH¢2,587/64 kg; GH¢1,241.76/30 kg); purchases from 18 Jun 2026.
- Ecofin Agency / Bloomberg 9–11 Sep 2026: proposed 2026/27 GH¢43,792/t (~$3,820) pending ministerial sign-off; Côte d'Ivoire 1,200 CFA/kg reference.
- GhanaWeb 11 Aug 2026: 2025/26 output ~750,000 MT (+25.6% YoY); US benchmark ~$5,683.50/MT on 7 Aug 2026.
- ICO CMR Jul 2026; ICO daily indicator tables Sep 2026: I-CIP 287.26c (Jul) / 272.90c (early Sep); Colombian Milds 371–383c; Robustas 169–184c.
- Uganda MAAIF daily reports May/Aug 2026: London Robusta Nov-26 $3,739/MT; NY Arabica Dec-26 332.45c/lb; farmgate FAQ 12,000–13,000 UGX/kg.
- EMR Aug 2026 (AgTech $17.81B → $72.05B, 15.0% CAGR); Research and Markets 2026 (Agritech $34.58B → $38.56B); InsightAce/Vantage (Digital Ag $22.8–24.1B → $64.6–78.1B).
- Apollo Agriculture (apolloagriculture.com; Tracxn/CB Insights; AgFunderNews Apr 2025: $40M Series B, SoftBank Vision Fund 2, 100k+ farmers); Farmerline (farmerline.co: Mergdata, 2.3M farmers, 3,000 partners, 50 countries); FAO STI Portal (Esoko SMS/voice).
- US CRS R49035 (2026) via Ecosystem Marketplace: agriculture $7–8/tCO2e (2023–24); Carbon Pulse / AlliedOffsets Jul–Aug 2026: CORSIA ~$10/t; soil issuance ~4.5M units (2025).

*No yield, price, carbon, or ARR figure in this note is a guarantee. Model inputs in Section 7 must be replaced with signed pilot price lists and measured baselines before commercial use.*

---

## 14. Farm Radio International — Alignment Addendum (partnership, not equity)

Farm Radio International (Ottawa, est. 1979) runs interactive radio + Community Listening Groups + Uliza mobile feedback across 1,000+ stations in 41 sub-Saharan countries, focused on climate resilience and gender equality. This addendum positions AG-Extension as the verification and value-capture layer beneath their reach: radio drives listening and action intent; AG-Extension proves action, yield, and premium.

### 14.1 Alignment thesis

- Farm Radio solves reach in local languages where literacy and bandwidth are low. AG-Extension solves proof: every broadcast call-to-action becomes a trackable event (SMS/IVR response → field visit → QC photo → aggregated lot → passported sale).
- No duplication: Farm Radio owns broadcast craft, station training, Barza Wire resources, and listener trust. AG-Extension owns offline-first advisory telemetry, parcel/NDVI monitoring, lot aggregation, EUDR/GS1 passports, and credit/MRV scoring.
- Shared donor language: Global Affairs Canada–aligned outcomes (food security, women/youth reach, climate adaptation) reported from the same telemetry both parties audit.

### 14.2 Joint pilot design (candidates to confirm with Farm Radio)

- **Candidate geographies (overlap first):** Lilongwe District, Malawi (existing AG-Extension pilot frame: 3 rural clusters, 15 officers, 1,000 farmers); rural Kenya (Apollo/ThriveAgric corridor, strong radio density); Ghana cocoa belt (COCOBOD farmgate GH¢41,392/t Light Crop 2026); Uganda coffee (FAQ 12,000–13,000 UGX/kg Aug 2026). Final districts and stations to be selected jointly from Farm Radio's active station list — no station is named here as committed.
- **Episode-to-action loop (same week, every week):**
  1. Farm Radio airs localized episode (e.g., cocoa black-pod hygiene; coffee selective picking + drying to 11–12%; Fall Armyworm scouting).
  2. Within 24h, AG-Extension pushes the same advisory as SMS/IVR/WhatsApp voice in the broadcast languages, with a press-1/press-2 response (confirm receipt; request officer visit; nearest agro-dealer).
  3. Listening-group responses via Uliza + IVR feed the offline queue; officers close the loop with verified visits, geo-tagged QC photos, and parcel/NDVI checks.
  4. Harvest weeks switch the loop to aggregation: collection-center QC capture, lot bulking by grade, buyer match on net spread.
- **Season timeline:** Months 0–2 align episode calendar with crop calendar and buyer grade grids. Months 2–6 run weekly loops with action-closure tracking. Months 6–9 sell first jointly-attributed aggregated lots. Months 9–12 publish joint BCR vs. control and listener-to-action conversion.

### 14.3 Roles and data ownership

| Function | Farm Radio | AG-Extension | Joint |
|---|---|---|---|
| Broadcast production, station training, listening groups | Owns | Supports with advisory content + FAOSTAT/RAG briefs | Episode calendar signed |
| SMS/IVR/voice-note delivery, offline field verification | Supports | Owns (broadcast workers, idempotent sync, visit proofs) | Delivery + closure reports shared |
| Farmer PII, consent, community data rights | Co-owner under OCAP-aligned consent | Custodian under tenant isolation + encryption | Consent wording and retention agreed before pilot; community owns its data |
| Lot passports, buyer contracts, settlement | Supports with buyer storytelling | Owns issuance + ledger | Buyer acceptance jointly reported |
| Donor reporting | Owns narrative + reach numbers | Owns telemetry evidence | Single joint results table |

No farmer PII is sold or shared beyond the pilot tenancy. Aggregates leave the tenancy only anonymized and consented, per Section 3.2.

### 14.4 Joint M&E and budget split

- **Shared funnel:** broadcast reach (Farm Radio) → response rate (Uliza + IVR) → verified action rate (officer closure) → yield delta/ha vs. control → net premium/ton vs. documented spot → % lots passported and buyer-accepted. Gender/youth disaggregation at every stage.
- **Budget split principle:** Farm Radio covers broadcast production, station support, and listening-group facilitation. AG-Extension side covers devices, EUDR baselines, satellite/AI feeds, field QC labor, and SMS/IVR credits (~60% field, ~20% feeds/infra, ~15% engineering, ~5% MRV/safeguards per Section 10). Joint M&E is co-funded and co-owned. Amounts are priced once districts, stations, and farmer counts are confirmed — no figure is committed here.

### 14.5 Confirmations required and next step

Owner to confirm with Farm Radio before circulation as a commitment: selected districts and stations, broadcast languages, crop calendars, buyer grade grids per chain, consent owner per market, and operating entity per market. Next step is a single working session to lock the episode calendar against the crop calendar and sign the RACI above — then the pilot in 14.2 becomes executable.
