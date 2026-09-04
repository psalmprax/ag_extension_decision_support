# Cost-Effective Object Storage Guide for Video, Audio, and Document Uploads

## 1. Executive Summary & Quick Verdict

When hosting and streaming rich media (video consultations, audio recordings, field inspection clips, diagnostic imagery, and PDF guides) in an agricultural advisory platform, **egress bandwidth is almost always the single largest hidden operational cost**, far exceeding the cost of raw storage.

| Provider | Storage / GB / mo | Egress Bandwidth / GB | Free Tier | S3 Compatible? | Verdict / Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🥇 **Cloudflare R2** | **$0.015** ($15 / TB) | **$0.00 (Zero Egress)** | **10 GB storage free / mo**<br>1M Class A ops free<br>10M Class B ops free | ✅ Yes | **#1 Overall Choice** for video & audio playback. Zero egress prevents unpredictable streaming bills. |
| 🥈 **Backblaze B2** | **$0.006** ($6 / TB) | **$0.01 / GB**<br>*(or **$0.00** via Cloudflare CDN)* | **10 GB storage free** | ✅ Yes | **Cheapest Raw Storage**. Best for multi-terabyte cold/warm file archives. |
| 🥉 **Wasabi** | **$0.0069** ($6.99 / TB) | **$0.00** *(fair use: egress ≤ storage)* | 30-day trial only | ✅ Yes | Great for **> 1 TB steady data**. Caveat: $6.99/mo min bill + 90-day retention lock. |
| **Hetzner Object Storage** | **~€0.005** (~€5 / TB) | **Free** (up to 20 TB / mo) | None | ✅ Yes (Ceph S3) | Best if servers and data residency must remain strictly in Europe. |
| **AWS S3 Standard** *(Reference)* | **$0.023** ($23 / TB) | **$0.09 / GB** ⚠️ | 5 GB (1st year only) | Native | ❌ **Cost-prohibitive** for video/audio streaming due to 9¢/GB egress fees. |

---

## 2. Key Media Cost Drivers

### A. The Egress (Bandwidth Out) Trap
- A single 5-minute 1080p video is roughly **150 MB – 250 MB**.
- If 1,000 farmers or extension agents stream or download that video, it consumes **200 GB** of egress.
- On **AWS S3** or **Google Cloud Storage**, 200 GB of egress costs **~$18.00**. A viral or popular training video can cost hundreds of dollars in bandwidth alone.
- On **Cloudflare R2**, egress is **$0.00**.
- On **Backblaze B2 + Cloudflare CDN**, egress is **$0.00** via the Bandwidth Alliance.

### B. Storage Unit Cost ($/GB/month)
- Video archives scale rapidly (e.g., 500 hours of 1080p video ≈ 1 TB).
- Backblaze B2 is roughly **$6.00 / TB**, Cloudflare R2 is **$15.00 / TB**, while AWS S3 is **$23.00 / TB**.

### C. API Operations & Minimum Retention
- **Operations (PUT / GET)**: Class A (upload/modify) and Class B (download/read). Cloudflare R2 includes 1,000,000 Class A and 10,000,000 Class B requests free every month.
- **Minimum Storage Duration**:
  - Cloudflare R2 & Backblaze B2: **No minimum retention** (delete files anytime with no early deletion fee).
  - Wasabi: **90-day minimum retention** (deleting a file after 3 days still incurs charges for 87 days).
  - AWS Glacier / Infrequent Access: 30–90 day minimum + retrieval fees per GB (unsuitable for active playback).

---

## 3. Deep Dive into Top Providers

### 1. Cloudflare R2 (Recommended Primary)
- **Base Pricing**:
  - Storage: $0.015 per GB-month.
  - Egress: **$0.00 (Zero)**.
  - Class A requests: $4.50 per 1,000,000 requests.
  - Class B requests: $0.36 per 1,000,000 requests.
- **Generous Free Monthly Allowance**:
  - 10 GB of storage.
  - 1,000,000 Class A operations.
  - 10,000,000 Class B operations.
- **Key Advantages**:
  - Integrates natively with Cloudflare Cache and Global CDN edge locations.
  - Native S3 API compatibility (`@aws-sdk/client-s3`).
  - Supports Presigned URLs for direct browser-to-bucket video uploads (bypassing backend server memory).
  - No egress bandwidth caps or unexpected surprise bills.

### 2. Backblaze B2 + Cloudflare CDN (Cheapest at Scale)
- **Base Pricing**:
  - Storage: **$0.006 per GB-month** ($6 / TB / month).
  - Egress: Free up to 3× your average data stored, then $0.01 / GB.
  - **Bandwidth Alliance Zero-Egress**: Backblaze partners with Cloudflare. If you point a Cloudflare CDN worker or CNAME to a public B2 bucket, egress from B2 to Cloudflare is **100% free**.
- **When to Choose**:
  - When storage grows past **2–5 TB** and you want the absolute lowest per-gigabyte disk cost while keeping streaming free via CDN.

### 3. Wasabi Hot Cloud Storage
- **Base Pricing**:
  - Storage: $0.0069 per GB-month ($6.99 / TB / month).
  - Egress: $0.00 (under fair use where total egress does not exceed total storage).
  - API calls: Free.
- **Trade-offs**:
  - **$6.99 minimum monthly charge** (billed for at least 1 TB even if only using 50 GB).
  - **90-day minimum object retention policy**.

---

## 4. Real-World Monthly Cost Simulations

### Scenario 1: Early Stage / MVP
- **Stored Data**: 100 GB (audio recordings, PDF advisories, short field inspection clips)
- **Monthly Streaming / Egress**: 500 GB

| Provider | Storage Fee | Egress Fee | Estimated Total |
| :--- | :--- | :--- | :--- |
| **Cloudflare R2** | (100 GB - 10 GB free) × $0.015 = $1.35 | $0.00 | **~$1.35 / mo** 🏆 |
| **Backblaze B2** | (100 GB - 10 GB free) × $0.006 = $0.54 | ~$2.00 (or $0.00 via CF) | **~$0.54 – $2.54 / mo** |
| **Wasabi** | Minimum billing applies | $0.00 | **$6.99 / mo** |
| **AWS S3 Standard** | 100 GB × $0.023 = $2.30 | 500 GB × $0.09 = $45.00 | **~$47.30 / mo** 💸 |

### Scenario 2: Active Growth
- **Stored Data**: 1 TB (high-resolution crop scans, diagnostic video logs, voice notes)
- **Monthly Streaming / Egress**: 5 TB

| Provider | Storage Fee | Egress Fee | Estimated Total |
| :--- | :--- | :--- | :--- |
| **Backblaze B2 + Cloudflare** | $6.00 | $0.00 (via Alliance) | **~$6.00 / mo** 🏆 |
| **Wasabi** | $6.99 | $0.00 (within 5:1 egress cap check) | **~$6.99 / mo** |
| **Cloudflare R2** | $15.00 | $0.00 | **~$15.00 / mo** |
| **AWS S3 Standard** | $23.00 | 5,000 GB × $0.09 = $450.00 | **~$473.00 / mo** 💥 |

---

## 5. Implemented Platform Architecture

The platform provides a **universal S3-compatible driver** in [`objectStorageService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/objectStorageService.ts) that completely decouples the application code from any single cloud vendor.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Applications                           │
│  (React Web Dashboard, Offline-First PWA, Extension Officer Mobile App) │
└────────────────────┬───────────────────────────────┬────────────────────┘
                     │                               │
       Direct Upload │ (Presigned PUT)               │ Multipart Upload
       (Bypasses RAM)│                               │
                     ▼                               ▼
       ┌──────────────────────────┐    ┌──────────────────────────┐
       │   Cloud Object Storage   │    │  Express Backend Server  │
       │   (B2, R2, Wasabi, S3)   │    │  (upload.ts, auth, ACL)  │
       └─────────────▲────────────┘    └─────────────┬────────────┘
                     │                               │
                     │       S3 Client Send          │
                     └───────────────────────────────┤
                                                     ▼
                                       ┌──────────────────────────┐
                                       │   objectStorageService   │
                                       │ (resolveBackendType,     │
                                       │  local cache, stream)    │
                                       └─────────────┬────────────┘
                                                     ▼
                                       ┌──────────────────────────┐
                                       │    Dual Local Cache      │
                                       │ (uploads/ offline copy)  │
                                       └──────────────────────────┘
```

### Core Services

1. **`ObjectStorageService`** ([`objectStorageService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/objectStorageService.ts)):
   - Automatically detects provider backend: `'backblaze-b2' | 'cloudflare-r2' | 'wasabi' | 'hetzner' | 'aws-s3' | 'minio' | 'local-disk'`.
   - Methods:
     - `putObject(options)`: Uploads buffer to cloud and dual-writes to `./uploads` local cache.
     - `getObject(key)`: Reads from local cache first for sub-millisecond retrieval; falls back to cloud download if cache missed.
     - `getObjectStream(key)`: Streams binary audio/video data directly to HTTP response chunks with Range header support.
     - `hasObject(key)`: Verifies object existence across local disk and S3 `HeadObject`.
     - `deleteObject(key)`: Removes object from both cloud bucket and local cache.
     - `getPresignedUploadUrl(options)`: Generates time-limited pre-authenticated PUT URLs.
     - `getPresignedDownloadUrl(options)`: Generates time-limited pre-authenticated GET URLs with optional `Content-Disposition: attachment`.

2. **`ReportStorageService`** ([`reportStorageService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/reportStorageService.ts)):
   - Bridges the analytics reporting engine with object storage.
   - Packages generated PDF, CSV, and Excel reports, computes SHA-256 hashes, stores them under `reports/{year}/{month}/{reportId}.{ext}`, and records metadata in PostgreSQL `reports` table.

3. **Direct Browser-to-Cloud Upload Pipeline** ([`uploadService.ts` (Frontend)](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/api/uploadService.ts)):
   - `uploadLargeMediaDirect(file, farmerId, onProgress)`:
     1. Asks `/api/v1/upload/presign` for a signed URL.
     2. Directly sends an `XHR PUT` request to the bucket with real-time percentage progress callbacks.
     3. Notifies `/api/v1/upload/confirm` upon completion to run security validation and record the asset in the database.
   - Prevents memory exhaustion on Node.js API servers when multiple users upload 200 MB+ video files simultaneously.

4. **Security & Binary Content Validation** ([`uploadService.ts` (Backend)](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/uploadService.ts)):
   - **MIME Normalization**: Maps browser MIME types to canonical types and file extensions.
   - **Magic Byte Signature Matching**: Inspects raw initial byte signatures (e.g. `ftyp` for MP4, `1A 45 DF A3` for WebM, `ID3`/`FF FB` for MP3, `%PDF-` for PDF, `PK` for XLSX/DOCX) to prevent malicious executables masquerading as media.
   - **Quotas**: Enforces per-file limits (`MAX_UPLOAD_MB`) and per-user storage quotas (`UPLOAD_QUOTA_MB`).

---

## 6. Environment Configuration (`.env`)

Switching between the cheapest raw storage (Backblaze B2) and zero-egress streaming (Cloudflare R2) requires **zero code changes**—only environment variables.

### Option A: Backblaze B2 (Cheapest Raw Storage: $0.006/GB)
```env
# Backend Identifier
STORAGE_BACKEND=b2

# B2 S3 API Endpoint & Region (found in Backblaze B2 Bucket Settings)
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_BUCKET=ag-extension-media

# B2 Application Key Credentials
S3_ACCESS_KEY_ID=004xxxxxxxxxxxx0000000001
S3_SECRET_ACCESS_KEY=K004xxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional Public Custom Domain / Cloudflare CDN URL
S3_PUBLIC_URL=https://media.ag-extension.org
S3_FORCE_PATH_STYLE=false
```

### Option B: Cloudflare R2 (Cheapest for Heavy Streaming: Zero Egress)
```env
# Backend Identifier
STORAGE_BACKEND=r2

# Cloudflare R2 S3 API Endpoint
S3_ENDPOINT=https://<YOUR_CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ag-extension-media

# Cloudflare R2 API Token (S3 Credential pair)
S3_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional Custom Domain (e.g., connected via Cloudflare DNS)
S3_PUBLIC_URL=https://media.ag-extension.org
S3_FORCE_PATH_STYLE=false
```

### Option C: Hetzner Object Storage (~€0.005/GB, European Residency)
```env
STORAGE_BACKEND=hetzner
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_REGION=fsn1
S3_BUCKET=ag-extension-media
S3_ACCESS_KEY_ID=your-hetzner-key
S3_SECRET_ACCESS_KEY=your-hetzner-secret
```

### Option D: Wasabi ($0.0069/GB)
```env
STORAGE_BACKEND=wasabi
S3_ENDPOINT=https://s3.us-east-1.wasabisys.com
S3_REGION=us-east-1
S3_BUCKET=ag-extension-media
S3_ACCESS_KEY_ID=your-wasabi-key
S3_SECRET_ACCESS_KEY=your-wasabi-secret
```

### Option E: Local Disk Only (Default / Offline Testing)
```env
# If cloud credentials are left blank or STORAGE_BACKEND=local, 
# all files are saved to and served from the local disk automatically.
STORAGE_BACKEND=local
UPLOAD_DIR=./uploads
LOCAL_CACHE_ENABLED=true
```

---

## 7. API Endpoints Reference

All upload and media routes reside under `/api/v1/upload`:

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/upload/info` | Authenticated Users | Returns active storage backend name, cloud connectivity status, quotas, and supported MIME types. |
| `POST` | `/api/v1/upload` | Authenticated Users | Standard multipart/form-data upload for files up to `MAX_UPLOAD_MB`. |
| `POST` | `/api/v1/upload/multiple`| Authenticated Users | Batch upload up to 5 files simultaneously. |
| `POST` | `/api/v1/upload/presign` | Authenticated Users | Generates a presigned PUT URL for direct browser-to-bucket upload. |
| `POST` | `/api/v1/upload/confirm` | Authenticated Users | Confirms direct upload completion, performs magic-byte validation, and saves record. |
| `GET` | `/api/v1/upload/file/:key`| Authenticated Users | Streams stored media chunks with HTTP byte-range support for video/audio scrubbing. |

---

## 8. Automated Testing & Verification

The storage subsystem is covered by automated unit and integration tests in [`objectStorage.test.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/__tests__/objectStorage.test.ts):

```bash
# Run the object storage test suite
cd ag-extension-dashboard/src/backend
npx jest src/__tests__/objectStorage.test.ts
```

### Tested Scenarios (14/14 Passing):
- Provider resolution for `b2`, `backblaze-b2`, `r2`, `cloudflare-r2`, `wasabi`, `hetzner`, and `local`.
- Binary buffer storage, retrieval, and cryptographic SHA-256 verification.
- Stream chunk delivery via `getObjectStream` for video/audio scrubbing.
- Signature checking and rejection of spoofed executable files.
- Direct presigned URL generation and upload confirmation.
- Report bundle packaging (PDF, CSV, Excel) and cloud archival.

