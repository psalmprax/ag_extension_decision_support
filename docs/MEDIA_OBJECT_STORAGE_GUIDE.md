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

## 5. Integrating with `ag_extension_decision_support`

The platform backend already supports S3 uploads via [`uploadService.ts`](file:///home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/backend/src/services/uploadService.ts). Because Cloudflare R2 and Backblaze B2 implement the standard AWS S3 REST API, zero major architectural refactoring is needed.

### A. Environment Configuration (`.env`)

#### For Cloudflare R2:
```env
STORAGE_BACKEND=s3
S3_ENDPOINT=https://<YOUR_CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ag-extension-media
S3_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
S3_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
S3_PUBLIC_URL=https://media.yourextensiondomain.org
```

#### For Backblaze B2:
```env
STORAGE_BACKEND=s3
S3_ENDPOINT=https://s3.<region>.backblazeb2.com
S3_REGION=<region>
S3_BUCKET=ag-extension-media
S3_ACCESS_KEY_ID=<B2_KEY_ID>
S3_SECRET_ACCESS_KEY=<B2_APPLICATION_KEY>
S3_PUBLIC_URL=https://media.yourextensiondomain.org
```

### B. Code Configuration Pattern

In `uploadService.ts`, pass `endpoint` and `credentials` to `S3Client`:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT, // Required for Cloudflare R2, B2, or MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: false, // Virtual-host style works with R2 & B2
});
```

---

## 6. Media Architecture Best Practices

1. **Presigned Upload URLs for Large Video Files**:
   - For large video or audio recordings, do not buffer entire multi-hundred megabyte payloads in Node.js server RAM.
   - Use `@aws-sdk/s3-request-presigner` (`getSignedUrl` with `PutObjectCommand`) so the frontend client uploads directly to R2 / B2.
2. **Video & Audio Compression**:
   - Audio: Encode farmer voice notes to **Opus** or **AAC (64–96 kbps)** (reduces storage footprint by 80% compared to raw WAV).
   - Video: Compress field footage to **H.264 / AV1 720p/1080p** with variable bitrate (VBR).
3. **Cache Headers & CDN Edge**:
   - Set `Cache-Control: public, max-age=31536000, immutable` for completed diagnostic images and uploaded attachments.
   - Once cached on edge nodes, repeated plays of training or diagnostic videos hit edge cache with near-zero latency.
