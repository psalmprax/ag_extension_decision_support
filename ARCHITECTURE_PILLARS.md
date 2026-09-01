# Agri-Extension Decision Support Platform — Strategic Capabilities & Architecture Guide

This document provides complete architectural specifications, data models, service interactions, and API contracts for the core platform expansion pillars and enterprise security features.

---

## Architecture Overview

```
                               ┌────────────────────────────────────────────────────────┐
                               │     AGRI-EXTENSION DECISION SUPPORT ECOSYSTEM          │
                               └────────────────────────────────────────────────────────┘
                                                           │
        ┌───────────────────┬───────────────────┬──────────┴────────┬───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼                   ▼                   ▼
  [1. Security &      [2. Zero-Conn       [3. Voice &         [4. Economic        [5. Agronomic       [6. Automated
     Identity]           Field Edge]         Inclusivity]        Supply Loop]        ROI & Carbon]       Hazard Engine]
  • RFC 6238 TOTP     • On-Device Image   • WhatsApp Voice    • Certified Agro-   • Yield Gain Diff   • 48h Weather
  • Auto-Lockout        Chromaticity        Whisper Transcribe  Dealer Directory    • Input BCR Model   • Anomaly Scans
  • SHA-256 Sessions  • WGS-84 Polygon    • TwiML/AT IVR      • Batch Anti-Fraud  • IPCC Tier 2 SOC   • Auto Dispatch
  • GeoIP Tracking      Acreage Measure     DTMF Workflows    • Offtaker Match    • Carbon Credits      Campaigns
```

---

## 1. Login History & Location Auditing Architecture

### Purpose
Provides comprehensive enterprise identity audit logs for security oversight, compliance, and suspicious activity detection (credential stuffing, geo-velocity anomalies, brute-force attempts).

### Database Schema
Located in [`prisma/schema.prisma`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/prisma/schema.prisma) and [`databaseService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/databaseService.ts):

```sql
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device VARCHAR(100),
    location VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'locked_out', 'mfa_required')),
    failure_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id_created ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_email_created ON login_history(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status);
```

### Key Components
- **Device Parsing** ([`loginHistoryService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/loginHistoryService.ts)): Extracts client OS (iOS, Android, Windows, macOS, Linux) and Browser (Chrome, Safari, Firefox, Edge).
- **Location Resolution**: Resolves client city/region/country using proxy/CDN headers (`cf-ipcountry`, `x-country-code`, `x-real-ip`, `x-forwarded-for`).
- **Telemetry Querying**: Computes total logins, 24h failure rates, distinct IP addresses, and user timeline history.

### API Endpoints
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/auth/login-history` | `Admin`, `Regional Manager`, `Self` | Paginated login attempt logs with filters (`userId`, `status`, `limit`) |
| `GET` | `/api/v1/auth/login-stats` | `Admin`, `Regional Manager`, `Self` | 24-hour telemetry aggregate (total attempts, failures, unique IPs) |

---

## 2. Pillar 1: Security & Identity Hardening

### Purpose
Protects agricultural extension officers and system administrators against credential theft, brute-force attacks, and session hijacking.

### Key Components

#### A. RFC 6238 TOTP Multi-Factor Authentication ([`mfaService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/mfaService.ts))
- **Zero External Dependencies**: Built directly on Node.js `crypto` with custom Base32 encoding/decoding and HMAC-SHA1 dynamic truncation.
- **Authenticator Support**: Compatible with Google Authenticator, Microsoft Authenticator, and 1Password via standard `otpauth://totp/...` URIs.
- **Backup Recovery Codes**: Generates 8 cryptographically random alphanumeric backup codes (`XXXX-XXXX`) stored hashed in the database and consumed atomically on single use.

#### B. Brute-Force Account Lockout ([`lockoutService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/lockoutService.ts))
- **Threshold**: 5 consecutive failed login attempts within the sliding window.
- **Lockout Duration**: 15 minutes (`LOCKOUT_DURATION_MS = 900,000`).
- **HTTP Response**: Returns `423 Locked` with `lockoutRemainingSeconds`.
- **Auto Reset**: Successful password verification instantly resets failed attempt counters.

#### C. Active Session Management & SHA-256 Token Hashing ([`sessionService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/sessionService.ts))
- **Token Protection**: Raw JWTs are never stored in the database. Instead, sessions are indexed by deterministic SHA-256 token hashes (`tokenHash`).
- **Instant Revocation**: Features a high-performance in-memory revocation set (`revokedTokenHashes`) synchronized with PostgreSQL for sub-millisecond, zero-database-overhead checks in [`authorize.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/middleware/authorize.ts).
- **Remote Revocation**: Allows revoking specific sessions or revoking all other active devices.

### API Endpoints
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/mfa/setup` | Authenticated | Generates new TOTP secret & QR data URI |
| `POST` | `/api/v1/auth/mfa/enable` | Authenticated | Verifies 6-digit TOTP code and enables 2FA |
| `POST` | `/api/v1/auth/mfa/verify` | Public (with temp token) | Validates TOTP code or backup code during login |
| `POST` | `/api/v1/auth/mfa/disable` | Authenticated | Confirms password and disables 2FA |
| `GET` | `/api/v1/auth/sessions` | Authenticated | Lists user's active sessions with device & IP info |
| `DELETE` | `/api/v1/auth/sessions/:id` | Authenticated | Revokes a specific remote session |
| `POST` | `/api/v1/auth/sessions/revoke-others` | Authenticated | Revokes all sessions except the current request |

---

## 3. Pillar 2: Field & Edge Operational Reality (Zero-Connectivity)

### Purpose
Enables field officers and farmers in remote rural regions without cellular connectivity to run visual crop disease diagnosis and measure field acreage directly on-device.

### Key Components

#### A. On-Device Edge Plant Vision Classifier ([`edgePlantVisionClassifier.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/services/edgePlantVisionClassifier.ts))
- **Zero-Network Inference**: Analyzes crop foliage directly in HTML5 Canvas using RGB/HSV chromaticity ratios and spatial pixel statistics:
  - **Green Canopy Index**: NDVI approximation `(G - R) / (G + R + \epsilon)`.
  - **Chlorosis Index**: Yellow pigmentation ratio (high $R+G$, low $B$).
  - **Necrosis / Lesion Index**: Dark necrotic pixel density ($R > G > B$ with low luminance).
  - **Rust Pustule Ratio**: Orange/red-brown chromaticity ($R > 160, G \in [70, 140], B < 50$).
  - **Mottling Spatial Variance**: Block-level standard deviation of green intensity across $16 \times 16$ pixel sub-grids.
- **Disease Rule Knowledge Base**:
  - **Fall Armyworm (*Spodoptera frugiperda*) on Maize**: Leaf chew damage, irregular whorl holes, ragged margins.
  - **Cassava Mosaic Disease (CMD)**: Severe chlorotic mottling, leaf curling, distorted lamina.
  - **Maize Lethal Necrosis Disease (MLND)**: Marginal leaf necrosis, "dead heart" drying.
  - **Tomato Late Blight (*Phytophthora infestans*)**: Water-soaked necrotic lesions with chlorotic halos.
  - **Coffee Leaf Rust (*Hemileia vastatrix*)**: Powdery orange lesions on abaxial leaf surfaces.
- **Output**: Returns diagnostic confidence score ($0.0 - 1.0$), severity grade (`mild`, `moderate`, `severe`), cultural controls, biological controls, and chemical intervention thresholds.

#### B. WGS-84 Geodesic Parcel Boundary Polygon Tracer & Acreage Calculator ([`parcelGeoService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/services/parcelGeoService.ts))
- **Geodesic Acreage Calculation**: Uses metric planar-projected Shoelace formula on WGS-84 coordinates:
  $$\text{Area} = \frac{1}{2} \left| \sum_{i=0}^{n-1} (x_i y_{i+1} - x_{i+1} y_i) \right|$$
  where $x_i = \lambda_i \cdot \frac{\pi}{180} R \cos(\bar{\phi})$ and $y_i = \phi_i \cdot \frac{\pi}{180} R$.
- **Perimeter & Centroid**: Calculates perimeter distance via Haversine and bounding box extents.
- **GeoJSON Export**: Produces RFC 7946 compliant `Feature<Polygon>` with closed coordinate rings.
- **Offline Persistence**: Caches recorded parcel polygons in LocalStorage / IndexedDB for synchronization once online.

---

## 4. Pillar 3: Smallholder Inclusivity & Voice Channels

### Purpose
Removes literacy and technological barriers by supporting native voice note audio queries and automated voice alert phone calls.

### Key Components

#### A. WhatsApp & Voice Note Transcription Service ([`voiceAudioService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/voiceAudioService.ts))
- **Multi-Format Audio Support**: Ingests OGG/Opus, MP3, M4A, and AMR audio streams from WhatsApp Cloud API and Africa's Talking.
- **Vernacular Agronomic Parsing**: Detects agricultural terms in Swahili (*mahindi*, *muhogo*, *mbolea*, *viwavi*, *ukungu*, *shamba*), English, and regional dialects.
- **Speech Synthesis**: Synthesizes localized audio advisory files (`audio/ogg`) for voice-note responses.

#### B. Interactive Voice Response (IVR) & Automated Voice Broadcasts ([`ivrBroadcastService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/ivrBroadcastService.ts))
- **TwiML / Africa's Talking Voice XML**: Generates standard dynamic voice XML prompts.
- **DTMF Keypad Interaction Workflow**:
  - `Press 1`: Confirm receipt and receive written advisory summary via SMS.
  - `Press 2`: Request an on-farm diagnostic visit from an extension officer.
  - `Press 3`: Connect with nearest certified agro-dealer stockist.
  - `Press 0`: Replay voice advisory.
- **Batch Broadcast Dispatch**: Initiates automated voice alert campaigns for weather emergencies and pest outbreaks.

---

## 5. Pillar 4: Economic & Supply Chain Loop Closure

### Purpose
Connects farmers directly to genuine input supplies and guaranteed commodity buyers, closing the economic feedback loop.

### Key Components

#### A. Certified Agro-Dealer Directory & Anti-Counterfeit Verification ([`inputSupplierService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/inputSupplierService.ts))
- **Geo-Inventory Proximity Matching**: Searches verified stockists within a specified radius (km), sorting by distance, stock availability, and official licensing (PCPB/KEPHIS/KEBS).
- **Anti-Counterfeit Batch Lookup**: Verifies seed, fertilizer, and agrochemical batch numbers against national regulator databases to identify counterfeit agricultural inputs.

#### B. Harvest Offtaker & Market Aggregation Matchmaker ([`harvestOfftakeService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/harvestOfftakeService.ts))
- **Yield Aggregation**: Aggregates projected crop volumes across farmer cohorts by county and harvest window.
- **Institutional Offtake Matching**: Matches cooperative tonnage with certified millers, processors, and commodity buyers (e.g. Unga Farm Care, East Africa Grain Council).
- **Cooperative Premium Modeling**: Computes bulk contractual revenue gains vs. local middleman spot pricing.

---

## 6. Pillar 5: Agronomic ROI & Carbon / ESG Auditing

### Purpose
Quantifies the financial return on investment of agronomic recommendations and provides verified Soil Organic Carbon (SOC) metrics for carbon credit certification.

### Key Components

#### A. Quantifiable Yield Differential & Input ROI Calculator ([`agronomicRoiService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/agronomicRoiService.ts))
- **Control vs. Advisory Comparison**: Models financial differences between traditional practices and decision-support guided inputs (certified hybrid seeds, soil-test calibrated NPK, lime, IPM).
- **Key Metrics Computed**:
  - Yield Gain (%) and Tonnage Gain (t/ha).
  - Net Profit Gain per Hectare (in KES and USD).
  - **Benefit-Cost Ratio (BCR)**: Net revenue gain per currency unit invested.
  - Break-Even Commodity Price per Ton.

#### B. Soil Organic Carbon (SOC) IPCC Tier 2 MRV Engine ([`soilCarbonMrvService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/soilCarbonMrvService.ts))
- **IPCC Tier 2 Soil Quantification**:
  $$\text{SOC Stock (t C/ha)} = \frac{\% \text{SOM} \times 0.58}{100} \times \rho_b (\text{t/m}^3) \times d (\text{m}) \times 10,000\,\text{m}^2/\text{ha} \times (1 - f_{\text{coarse}})$$
- **Carbon Sequestration & $\text{CO}_2\text{e}$**:
  $$\text{Total } \text{CO}_2\text{e (t)} = \Delta \text{SOC} \times \text{Hectares} \times 3.667$$
- **Voluntary Carbon Market Revenue**: Estimates credit earnings at market prices ($15–$30/t $\text{CO}_2\text{e}$).

---

## 7. Pillar 6: Automated Proactive Hazard Warning Engine

### Purpose
Transforms the platform from reactive query-handling into an autonomous hazard prediction and early warning alert daemon.

### Key Components

#### A. Weather Anomaly Scanning Daemon ([`weatherHazardDaemonService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/weatherHazardDaemonService.ts))
- **Continuous Multi-Day Scan**: Ingests weather forecast parameters (min/max temp, precipitation, relative humidity, wind speed).
- **Hazard Detection Matrix**:
  1. **Severe Frost Warning**: Night temperature $\le 3.5^\circ\text{C}$ (potato/tea damage risk; triggers potassium silicate and thermal smoke recommendations).
  2. **Flash Flood & Leaching Rain**: Rainfall $\ge 55\,\text{mm}/24\,\text{h}$ (triggers drainage alerts and fertilizer spray suspensions).
  3. **Extreme Heatwave**: Max temperature $\ge 34.0^\circ\text{C}$ with low rainfall (maize pollination desiccation risk; triggers mulching advisory).
  4. **Pest & Blight Climate Window**: Warm temperature ($24\text{--}29^\circ\text{C}$) with humidity $\ge 80\%$ following rainfall (optimal sporulation/hatching window).
- **Autonomous Early Warning Broadcast**: Automatically triggers 48-hour preventive SMS, WhatsApp, and IVR broadcast campaigns to all farmers in the affected county.

---

## 8. Test Suites & Verification Matrix

| Test Suite | File | Tests | Coverage Scope |
|---|---|---|---|
| **Security Hardening** | [`securityHardening.test.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/__tests__/securityHardening.test.ts) | 16 / 16 | Base32 encoding, TOTP validation, backup codes, token hashing, session revocation, brute-force lockout |
| **Login History** | [`loginHistory.test.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/__tests__/loginHistory.test.ts) | 12 / 12 | Audit log insertions, header location parsing, user-agent parsing, 24h failure rates, timeline queries |
| **Strategic Pillars** | [`advancedPillars.test.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/__tests__/advancedPillars.test.ts) | 16 / 16 | Voice notes, IVR XML, DTMF menus, agro-dealers, batch verification, offtake matching, ROI, Soil Carbon, Hazard scans |
| **Edge Field Services** | [`edgeFieldServices.test.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/__tests__/edgeFieldServices.test.ts) | 3 / 3 | Haversine distance, WGS-84 metric Shoelace polygon acreage, RFC 7946 GeoJSON export |
| **Backend Full Suite** | 58 test files | 525 / 525 | 100% passing across all backend routes, services, queues, and security gates |
| **Frontend Full Suite** | 32 test files | 147 / 147 | 100% passing across UI components, state stores, and services |
| **Linter & Dead-Code** | `fallow:check` | 0 regressions | Clean ESLint, strict TypeScript, and Fallow dead-code gate passing |
